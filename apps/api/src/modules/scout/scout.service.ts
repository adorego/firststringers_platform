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
  // Set when the exact position had no matches and we broadened the search
  // to other positions in the same sport so Billy can still suggest someone.
  relaxedPosition?: string;
}

// Keyed by sport because the same short code means different things in
// different sports (e.g. "C" is a baseball catcher and a basketball center).
const POSITION_MAP: Record<string, Record<string, string>> = {
  football: {
    quarterback: 'QB',
    'wide receiver': 'WR',
    'running back': 'RB',
    cornerback: 'CB',
    'offensive lineman': 'OL',
    'tight end': 'TE',
    'free safety': 'FS',
    'strong safety': 'SS',
    linebacker: 'LB',
    'defensive end': 'DE',
    'defensive tackle': 'DT',
    kicker: 'K',
    punter: 'P',
  },
  basketball: {
    'point guard': 'PG',
    'shooting guard': 'SG',
    'small forward': 'SF',
    'power forward': 'PF',
    center: 'C',
  },
  baseball: {
    pitcher: 'P',
    catcher: 'C',
    'first base': '1B',
    'second base': '2B',
    'third base': '3B',
    shortstop: 'SS',
    'left field': 'LF',
    'center field': 'CF',
    'right field': 'RF',
    outfielder: 'OF',
    'designated hitter': 'DH',
  },
  soccer: {
    goalkeeper: 'GK',
    defender: 'DF',
    'center back': 'DF',
    'full back': 'FB',
    midfielder: 'MF',
    winger: 'WG',
    forward: 'FW',
    striker: 'ST',
  },
  volleyball: {
    setter: 'S',
    'outside hitter': 'OH',
    'opposite hitter': 'OPP',
    'middle blocker': 'MB',
    libero: 'L',
    'defensive specialist': 'DS',
  },
};

@Injectable()
export class ScoutService {
  private readonly logger = new Logger(ScoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RankingService,
  ) {}

  async search(query: string, filters: SearchFilters, limit = 5): Promise<ScoutResult> {
    const start = Date.now();

    const primary = await this.runQuery(query, filters, limit);
    if (primary.athletes.length > 0 || !filters.position) {
      return { query, filters, latencyMs: Date.now() - start, ...primary };
    }

    // Nobody matched the requested position — broaden to other positions in
    // the same sport so Billy can still offer a related recommendation.
    const { position: _dropped, ...relaxedFilters } = filters;
    const relaxed = await this.runQuery(query, relaxedFilters, limit);

    return {
      query,
      filters,
      latencyMs: Date.now() - start,
      ...relaxed,
      relaxedPosition: relaxed.athletes.length > 0 ? filters.position : undefined,
    };
  }

  private async runQuery(
    query: string,
    filters: SearchFilters,
    limit: number,
  ): Promise<{ totalFound: number; athletes: RankedAthlete[] }> {
    const sportMap = filters.sport ? POSITION_MAP[filters.sport.toLowerCase()] : undefined;
    const normalizedPosition = filters.position
      ? (sportMap?.[filters.position.toLowerCase()] ?? filters.position)
      : undefined;

    const where: any = {};
    if (filters.sport)       where.sport    = { equals: filters.sport, mode: 'insensitive' };
    if (normalizedPosition)  where.position = { equals: normalizedPosition, mode: 'insensitive' };

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
      totalFound: filtered.length,
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
