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
    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source) as (keyof DossierData)[]) {
      const sourceVal = source[key];
      const targetVal = target[key];

      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object'
      ) {
        result[key] = { ...targetVal, ...sourceVal };
      } else if (sourceVal !== undefined && sourceVal !== null) {
        result[key] = sourceVal;
      }
    }

    return result as DossierData;
  }
}
