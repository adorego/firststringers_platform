import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@firststringers/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMService } from '../../shared/llm/llm.service';
import type { DossierUpdateJob, DossierData } from '../../shared/types';

@Injectable()
export class DossierWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  @OnEvent('dossier.update')
  async handleDossierUpdate(payload: DossierUpdateJob) {
    const { athleteId, newData } = payload;

    const current = await this.prisma.dossier.findUnique({
      where: { athleteId },
    });

    const currentData = (current?.data as DossierData) || {};
    const mergedData = this.mergeDeep(currentData, newData);
    const completeness = this.calculateCompleteness(mergedData);

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

    console.log(
      `Dossier updated for ${athleteId} — completeness: ${Math.round(completeness * 100)}%`,
    );

    if (completeness >= 0.75 && !current?.narrative) {
      await this.generateNarrative(athleteId, mergedData);
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

    console.log(`Narrative generated for athlete ${athleteId}`);
  }

  private calculateCompleteness(data: DossierData): number {
    const checks = [
      !!data.identity?.sport,
      !!data.identity?.position,
      !!data.identity?.graduationYear,
      !!data.performance?.stats,
      !!data.performance?.leagueLevel,
      !!data.academic?.gpa,
      !!data.academic?.intendedMajor,
      data.availability?.transferPortal !== undefined,
      !!data.availability?.preferredRegions,
    ];

    const filled = checks.filter(Boolean).length;
    return filled / checks.length;
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
