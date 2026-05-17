import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RankingService, RankedAthlete } from './ranking.service';
import { SearchFilters } from '../../shared/types/scout.types';

export interface ScoutResult {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  latencyMs: number;
  athletes: RankedAthlete[];
}

@Injectable()
export class ScoutService {
  private readonly logger = new Logger(ScoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RankingService,
  ) {}

  async search(query: string, filters: SearchFilters, limit = 5): Promise<ScoutResult> {
    const start = Date.now();

    // Solo filtros exactos que existen en el modelo Athlete
    const where: any = {};
    if (filters.sport)    where.sport    = { equals: filters.sport, mode: 'insensitive' };
    if (filters.position) where.position = { equals: filters.position, mode: 'insensitive' };

    this.logger.log(`Scout query: ${JSON.stringify(where)}`);

    const athletes = await this.prisma.athlete.findMany({
      where,
      take: limit * 3,
      include: {
        dossier: {
          select: {
            data: true,
            completeness: true,
            narrative: true,
            advocacyScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`Scout DB returned ${athletes.length} athletes before filter`);

    // Aplanar datos del dossier.data
    const normalized = athletes.map(a => {
      const d = (a.dossier?.data as any) ?? {};
      return {
        id: a.id,
        fullName: a.name,
        name: a.name,
        sport: a.sport ?? '',
        position: a.position ?? '',
        leagueLevel: d.leagueLevel ?? '',
        gpa: d.gpa ?? null,
        graduationYear: d.graduationYear ?? null,
        ncaaEligible: d.ncaaEligible ?? false,
        inTransferPortal: d.inTransferPortal ?? false,
        preferredRegions: d.preferredRegions ?? [],
        trajectory: d.trajectory ?? 'STABLE',
        keyStrengths: d.keyStrengths ?? [],
        fitTags: d.fitTags ?? [],
        completenessScore: a.dossier?.completeness ?? 0,
        similarity: this.calcTextSimilarity(a, d, query),
        dossier: {
          summary: a.dossier?.narrative ?? d.recruiterPitch ?? null,
          recruiterPitch: d.recruiterPitch ?? null,
        },
      };
    });

    // Filtros en memoria sobre dossier.data — más flexibles
    const filtered = normalized.filter(a => {
      if (filters.leagueLevel && a.leagueLevel.toUpperCase() !== filters.leagueLevel.toUpperCase()) return false;
      if (filters.ncaaEligible && !a.ncaaEligible) return false;
      if (filters.transferPortal && !a.inTransferPortal) return false;
      if (filters.minGpa && (!a.gpa || a.gpa < filters.minGpa)) return false;
      // No filtrar por graduationYear estrictamente — solo como boost
      return true;
    });

    this.logger.log(`Scout after filter: ${filtered.length} athletes`);

    const ranked = this.ranking.rankAthletes(
      filtered,
      query,
      filters as Record<string, any>,
    );

    return {
      query,
      filters,
      totalFound: filtered.length,
      latencyMs: Date.now() - start,
      athletes: ranked.slice(0, limit),
    };
  }

  private calcTextSimilarity(athlete: any, dossierData: any, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const athleteText = [
      athlete.sport ?? '',
      athlete.position ?? '',
      dossierData.leagueLevel ?? '',
      ...(dossierData.keyStrengths ?? []),
      ...(dossierData.fitTags ?? []),
      dossierData.narrative ?? '',
    ].join(' ').toLowerCase();

    const matches = queryWords.filter(w => w.length > 2 && athleteText.includes(w));
    return queryWords.length > 0
      ? Math.min(0.95, 0.4 + (matches.length / queryWords.length) * 0.6)
      : 0.5;
  }
}