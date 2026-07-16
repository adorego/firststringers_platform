import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { OwnersManualData } from '../../shared/types';

const ARRAY_FIELDS = [
  'motivations',
  'values',
  'longTermAspirations',
  'preferredEnvironments',
  'limitingEnvironments',
] as const;

const TEXT_FIELDS = [
  'communicationStyle',
  'learningStyle',
  'decisionMaking',
  'competitiveIdentity',
  'supportSystem',
] as const;

@Injectable()
export class OwnersManualService {
  constructor(private readonly prisma: PrismaService) {}

  async get(athleteId: string): Promise<OwnersManualData> {
    const manual = await this.prisma.ownersManual.findUnique({
      where: { athleteId },
    });
    return (manual?.data as OwnersManualData) ?? {};
  }

  async merge(
    athleteId: string,
    insights: Partial<OwnersManualData>,
  ): Promise<void> {
    const current = await this.get(athleteId);
    const merged = this.mergeData(current, insights);

    await this.prisma.ownersManual.upsert({
      where: { athleteId },
      create: {
        athleteId,
        data: merged as unknown as Prisma.InputJsonValue,
      },
      update: { data: merged as unknown as Prisma.InputJsonValue },
    });
  }

  private mergeData(
    current: OwnersManualData,
    insights: Partial<OwnersManualData>,
  ): OwnersManualData {
    const merged: OwnersManualData = { ...current };

    for (const field of ARRAY_FIELDS) {
      const incoming = insights[field];
      if (!incoming?.length) continue;

      const existing = merged[field] ?? [];
      const combined = [...existing];
      for (const item of incoming) {
        const normalized = item.trim();
        if (
          normalized &&
          !combined.some((e) => e.toLowerCase() === normalized.toLowerCase())
        ) {
          combined.push(normalized);
        }
      }
      if (combined.length > existing.length || existing.length > 0) {
        merged[field] = combined;
      }
    }

    for (const field of TEXT_FIELDS) {
      const incoming = insights[field];
      if (incoming?.trim()) {
        merged[field] = incoming.trim();
      }
    }

    return merged;
  }
}
