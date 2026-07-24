import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@firststringers/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RankingService, RankedAthlete } from './ranking.service';
import {
  SearchFilters,
  DossierScoutFields,
} from '../../shared/types/scout.types';
import { DossierData } from '../../shared/types';

// Jerry's real conversation pipeline (data-extractor, dossier.worker) writes
// the nested DossierData shape (identity/performance/academic/availability).
// Seed data — and older code — wrote flat DossierScoutFields directly. Search
// needs to read whichever one is actually present, nested first.
type RawDossierData = DossierScoutFields & Partial<DossierData>;

export interface ScoutResult {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  latencyMs: number;
  athletes: RankedAthlete[];
  // Set when the exact position had no matches and we broadened the search
  // to other positions in the same sport so Billy can still suggest someone.
  relaxedPosition?: string;
  // Set when this result came from dropping filters to find athletes beyond
  // the ones already shown this session ("show me more" with nothing left
  // under the original criteria) — these are real options, just looser fits.
  expanded?: boolean;
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

  async search(
    query: string,
    filters: SearchFilters,
    limit = 5,
    // Athletes already shown earlier in this conversation — excluded so a
    // "show me more" request surfaces someone new instead of repeating them.
    excludeIds: string[] = [],
  ): Promise<ScoutResult> {
    const start = Date.now();
    const isShowMore = excludeIds.length > 0;

    const primary = await this.runQuery(query, filters, limit, excludeIds);
    if (primary.athletes.length > 0) {
      return { query, filters, latencyMs: Date.now() - start, ...primary };
    }
    if (!filters.position && !isShowMore) {
      return { query, filters, latencyMs: Date.now() - start, ...primary };
    }

    // Either the exact position had no matches, or (on a "show me more"
    // request) every athlete matching it has already been shown — broaden to
    // other positions in the same sport so Billy can still offer someone.
    if (filters.position) {
      const relaxedFilters: SearchFilters = {
        ...filters,
        position: undefined,
      };
      const relaxed = await this.runQuery(
        query,
        relaxedFilters,
        limit,
        excludeIds,
      );
      if (relaxed.athletes.length > 0) {
        return {
          query,
          filters,
          latencyMs: Date.now() - start,
          ...relaxed,
          relaxedPosition: filters.position,
          expanded: isShowMore,
        };
      }
      if (!isShowMore) {
        return { query, filters, latencyMs: Date.now() - start, ...relaxed };
      }
    }

    if (!isShowMore) {
      return { query, filters, latencyMs: Date.now() - start, ...primary };
    }

    // Still nothing new — drop every soft filter and keep only sport, so a
    // "show me more" request always finds someone else if anyone exists.
    const broad = await this.runQuery(
      query,
      { sport: filters.sport },
      limit,
      excludeIds,
    );
    return {
      query,
      filters,
      latencyMs: Date.now() - start,
      ...broad,
      expanded: broad.athletes.length > 0,
    };
  }

  private async runQuery(
    query: string,
    filters: SearchFilters,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<{ totalFound: number; athletes: RankedAthlete[] }> {
    const sportMap = filters.sport
      ? POSITION_MAP[filters.sport.toLowerCase()]
      : undefined;
    const normalizedPosition = filters.position
      ? (sportMap?.[filters.position.toLowerCase()] ?? filters.position)
      : undefined;

    const where: Prisma.AthleteWhereInput = {
      representationStatus: { in: ['represented', 'verified'] },
    };
    if (filters.sport)
      where.sport = { equals: filters.sport, mode: 'insensitive' };
    if (normalizedPosition)
      where.position = { equals: normalizedPosition, mode: 'insensitive' };
    if (excludeIds.length > 0) where.id = { notIn: excludeIds };

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

    this.logger.log(
      `Scout DB returned ${athletes.length} athletes before filter`,
    );

    // Aplanar datos del dossier.data — soporta tanto el formato anidado real
    // de Jerry como el formato plano usado por el seed.
    const normalized = athletes.map((a) => {
      const d = this.flattenDossier(a.dossier?.data as RawDossierData | null);
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
    const filtered = normalized.filter((a) => {
      if (
        filters.leagueLevel &&
        a.leagueLevel.toUpperCase() !== filters.leagueLevel.toUpperCase()
      )
        return false;
      if (filters.ncaaEligible && !a.ncaaEligible) return false;
      if (filters.transferPortal && !a.inTransferPortal) return false;
      if (filters.minGpa && (!a.gpa || a.gpa < filters.minGpa)) return false;
      // No filtrar por graduationYear estrictamente — solo como boost
      return true;
    });

    this.logger.log(`Scout after filter: ${filtered.length} athletes`);

    const ranked = this.ranking.rankAthletes(filtered, query, filters);

    return {
      totalFound: filtered.length,
      athletes: ranked.slice(0, limit),
    };
  }

  // Real Jerry conversations store data nested (identity/performance/academic/
  // availability); the seed and older code store it flat. Prefer the nested
  // (real) value when present, falling back to the flat one.
  private flattenDossier(raw: RawDossierData | null): DossierScoutFields {
    const d = raw ?? {};
    return {
      leagueLevel: d.performance?.leagueLevel ?? d.leagueLevel ?? '',
      gpa: d.academic?.gpa ?? d.gpa ?? null,
      graduationYear: d.identity?.graduationYear ?? d.graduationYear ?? null,
      ncaaEligible: d.academic?.ncaaEligibility ?? d.ncaaEligible ?? false,
      inTransferPortal:
        d.availability?.transferPortal ?? d.inTransferPortal ?? false,
      preferredRegions:
        d.availability?.preferredRegions ?? d.preferredRegions ?? [],
      // No nested equivalent exists for these — Jerry never asks about them today.
      trajectory: d.trajectory ?? 'STABLE',
      keyStrengths: d.performance?.strengths ?? d.keyStrengths ?? [],
      fitTags: d.fitTags ?? [],
      recruiterPitch: d.recruiterPitch ?? null,
    };
  }

  private calcTextSimilarity(
    athlete: { sport: string | null; position: string | null },
    dossierData: DossierScoutFields,
    query: string,
  ): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const athleteText = [
      athlete.sport ?? '',
      athlete.position ?? '',
      dossierData.leagueLevel ?? '',
      ...(dossierData.keyStrengths ?? []),
      ...(dossierData.fitTags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    const matches = queryWords.filter(
      (w) => w.length > 2 && athleteText.includes(w),
    );
    return queryWords.length > 0
      ? Math.min(0.95, 0.4 + (matches.length / queryWords.length) * 0.6)
      : 0.5;
  }
}
