import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@firststringers/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMService } from '../../shared/llm/llm.service';
import type {
  DossierUpdateJob,
  DossierData,
  DossierUpdatedEvent,
} from '../../shared/types';
import {
  calculateDossierCompleteness,
  normalizeDossierData,
} from './dossier-normalizer';

@Injectable()
export class DossierWorker {
  private readonly logger = new Logger(DossierWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('dossier.update')
  async handleDossierUpdate(payload: DossierUpdateJob) {
    const { athleteId, newData } = payload;

    try {
      const current = await this.prisma.dossier.findUnique({
        where: { athleteId },
      });

      const currentData = normalizeDossierData(current?.data);
      const mergedData = this.mergeDeep(
        currentData,
        normalizeDossierData(newData),
      );
      const completeness = calculateDossierCompleteness(mergedData);
      const changedFields = this.getChangedFields(currentData, mergedData);

      await this.prisma.dossier.upsert({
        where: { athleteId },
        create: {
          athleteId,
          data: mergedData as unknown as Prisma.InputJsonValue,
          completeness,
        },
        update: {
          data: mergedData as unknown as Prisma.InputJsonValue,
          completeness,
        },
      });

      await this.recordChanges(athleteId, currentData, mergedData);

      // UI-facing event: full payload, emitted exactly once per update.
      this.eventEmitter.emit('dossier.updated', {
        athleteId,
        data: mergedData,
        completeness,
        changedFields,
      } satisfies DossierUpdatedEvent);

      this.logger.log(
        `Dossier updated for ${athleteId} — completeness: ${Math.round(completeness * 100)}%`,
      );

      if (completeness >= 0.75) {
        // Generate the narrative first so the pitch below can use it.
        try {
          await this.generateNarrative(athleteId, mergedData);
        } catch (error) {
          this.logger.error(
            `Narrative generation failed for athlete ${athleteId}`,
            error,
          );
        }
      }

      // Pitch-facing event: exactly once per update, after the narrative (if
      // any) exists — previously 'dossier.updated' fired twice and the pitch
      // was regenerated twice per athlete message.
      this.eventEmitter.emit('dossier.pitch_refresh', { athleteId });
    } catch (error) {
      this.logger.error(
        `Dossier update failed for athlete ${athleteId}`,
        error,
      );
    }
  }

  private async generateNarrative(
    athleteId: string,
    data: DossierData,
  ): Promise<void> {
    const narrative = await this.llm.chat({
      systemPrompt: `You are an elite sports representation agent.
Generate a compelling, honest, and specific recruitment pitch
for this athlete. Highlight concrete strengths, trajectory,
and development potential. Maximum 3 paragraphs in English.`,
      messages: [
        {
          role: 'user',
          content: `Generate the recruitment pitch for this athlete: ${JSON.stringify(data, null, 2)}`,
          timestamp: new Date(),
        },
      ],
    });

    await this.prisma.dossier.update({
      where: { athleteId },
      data: { narrative },
    });

    this.logger.log(`Narrative generated for athlete ${athleteId}`);
  }

  // The development timeline needs to know what actually moved, not just which
  // section did. A failure here must never cost the athlete their dossier.
  private async recordChanges(
    athleteId: string,
    before: Partial<DossierData>,
    after: DossierData,
  ): Promise<void> {
    const changes = this.diffLeaves(
      before as Record<string, unknown>,
      after as Record<string, unknown>,
    ).filter(({ field }) => !EXCLUDED_FROM_LOG.has(field.split('.')[0]));

    if (changes.length === 0) return;

    try {
      await this.prisma.dossierChange.createMany({
        data: changes.map((change) => ({
          athleteId,
          field: change.field,
          previous: change.previous as Prisma.InputJsonValue,
          current: change.current as Prisma.InputJsonValue,
        })),
      });
    } catch (error) {
      this.logger.warn(
        `Could not record dossier changes for athlete ${athleteId}`,
        error,
      );
    }
  }

  private diffLeaves(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    prefix = '',
  ): Array<{ field: string; previous: unknown; current: unknown }> {
    const changes: Array<{
      field: string;
      previous: unknown;
      current: unknown;
    }> = [];

    for (const [key, current] of Object.entries(after)) {
      const field = prefix ? `${prefix}.${key}` : key;
      const previous = before[key];

      if (isPlainObject(current) && isPlainObject(previous)) {
        changes.push(...this.diffLeaves(previous, current, field));
      } else if (isPlainObject(current)) {
        changes.push(...this.diffLeaves({}, current, field));
      } else if (JSON.stringify(current) !== JSON.stringify(previous)) {
        changes.push({ field, previous: previous ?? null, current });
      }
    }

    return changes;
  }

  private getChangedFields(
    before: Partial<DossierData>,
    after: DossierData,
  ): string[] {
    return (Object.keys(after) as (keyof DossierData)[]).filter(
      (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
    );
  }

  private mergeDeep(
    target: Partial<DossierData>,
    source: Partial<DossierData>,
  ): DossierData {
    return this.mergeObjects(
      target as Record<string, unknown>,
      source as Record<string, unknown>,
    ) as DossierData;
  }

  private mergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };

    for (const [key, sourceVal] of Object.entries(source)) {
      const targetVal = result[key];

      if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
        result[key] = this.mergeObjects(targetVal, sourceVal);
      } else if (sourceVal !== undefined && sourceVal !== null) {
        result[key] = sourceVal;
      }
    }

    return result;
  }
}

const EXCLUDED_FROM_LOG = new Set(['demoMetadata', 'recruiterPitch']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
