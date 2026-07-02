import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DossierData } from '../../shared/types';

export interface PipelineEntryDto {
  pipelineId: string;
  athleteId: string;
  fullName: string;
  sport: string | null;
  position: string | null;
  school: string | null;
  graduationYear: number | null;
  completenessScore: number;
  addedAt: Date;
  latestUpdate: {
    content: string;
    publishedAt: Date;
    source: 'athlete' | 'jerry_pitch';
  } | null;
}

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async add(recruiterId: string, athleteId: string): Promise<{ id: string }> {
    const entry = await this.prisma.pipelineEntry.upsert({
      where: { recruiterId_athleteId: { recruiterId, athleteId } },
      update: {},
      create: { recruiterId, athleteId },
    });
    return { id: entry.id };
  }

  async remove(recruiterId: string, athleteId: string): Promise<void> {
    await this.prisma.pipelineEntry.deleteMany({
      where: { recruiterId, athleteId },
    });
  }

  async list(recruiterId: string): Promise<PipelineEntryDto[]> {
    const entries = await this.prisma.pipelineEntry.findMany({
      where: { recruiterId },
      orderBy: { createdAt: 'desc' },
      include: {
        athlete: {
          include: {
            dossier: { select: { data: true, completeness: true } },
            sessions: { orderBy: { updatedAt: 'desc' }, take: 1 },
            updates: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    return entries.map((entry) => {
      const athlete = entry.athlete;
      const d = (athlete.dossier?.data as DossierData) ?? {};
      const session = athlete.sessions[0];
      const latestAthleteUpdate = athlete.updates[0];

      // Prefer what the athlete actually reported (training, games, achievements);
      // fall back to Jerry's AI-authored pitch when there's nothing newer.
      const latestUpdate: PipelineEntryDto['latestUpdate'] = latestAthleteUpdate
        ? {
            content: latestAthleteUpdate.content,
            publishedAt: latestAthleteUpdate.createdAt,
            source: 'athlete',
          }
        : session?.currentPitch && session.lastPitchAt
          ? {
              content: session.currentPitch,
              publishedAt: session.lastPitchAt,
              source: 'jerry_pitch',
            }
          : null;

      return {
        pipelineId: entry.id,
        athleteId: athlete.id,
        fullName: athlete.name,
        sport: athlete.sport,
        position: athlete.position,
        school: d.identity?.school ?? null,
        graduationYear: d.identity?.graduationYear ?? null,
        completenessScore: athlete.dossier?.completeness ?? 0,
        addedAt: entry.createdAt,
        latestUpdate,
      };
    });
  }
}
