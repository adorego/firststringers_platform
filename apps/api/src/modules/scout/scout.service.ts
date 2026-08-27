import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@firststringers/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RankingService, RankedAthlete } from './ranking.service';
import {
  SearchFilters,
  DossierScoutFields,
  CriteriaField,
  ZeroMatchDiagnosis,
  resolveCriteriaPriority,
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
  // Set on a fresh (non "show me more") search that came back with zero
  // athletes — tells Billy which criterion is most responsible so it can ask
  // the recruiter a reasoned trade-off question instead of going quiet or
  // silently substituting a different search.
  diagnosis?: ZeroMatchDiagnosis;
  // Set when athletes structurally matched every hard criterion but none
  // cleared MIN_CONFIDENT_FIT_SCORE — relaxing a filter wouldn't fix this
  // (it's a quality problem, not a structural one), so Billy should be
  // honest that nothing here is worth recommending rather than run the
  // criterion-diagnosis flow (FS-CS-001 "optimize for confidence, not
  // quantity").
  noConfidentMatch?: boolean;
}

// Billy never pads the result list just to make the count look bigger — an
// athlete only ships to the recruiter if their fitScore clears this bar.
// 1 excellent fit shows as 1; 0 genuine fits shows as 0. Deliberately
// conservative for the MVP: better to under-show than to manufacture
// relevance that isn't there.
export const MIN_CONFIDENT_FIT_SCORE = 0.45;

// Keyed by sport because the same short code means different things in
// different sports (e.g. "C" is a baseball catcher and a basketball center).
const POSITION_MAP: Record<string, Record<string, string>> = {
  football: {
    quarterback: 'QB',
    'wide receiver': 'WR',
    'running back': 'RB',
    cornerback: 'CB',
    'offensive lineman': 'OL',
    'offensive tackle': 'OL',
    'offensive guard': 'OL',
    'tight end': 'TE',
    safety: 'S',
    'defensive back': 'S',
    'nickel defensive back': 'S',
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

// Billy sometimes writes a "no preference" sentinel into a filter instead
// of omitting the key entirely (e.g. position: "all" for "any position is
// fine") — left as a literal value, it never equals a stored position or
// sport and silently zeroes out every result instead of broadening the
// search the way the recruiter actually asked for.
const NO_PREFERENCE_VALUES = new Set([
  'all',
  'any',
  'all positions',
  'any position',
  'anyone',
  'any sport',
]);

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
    filters = this.normalizeFilters(filters);
    const start = Date.now();
    const isShowMore = excludeIds.length > 0;

    const primary = await this.runQuery(query, filters, limit, excludeIds);
    if (primary.athletes.length > 0) {
      return { query, filters, latencyMs: Date.now() - start, ...primary };
    }

    if (!isShowMore) {
      if (primary.totalFound > 0) {
        // Athletes structurally matched every hard criterion, but none
        // cleared the confidence bar — relaxing a filter wouldn't fix a
        // quality problem, so skip the criterion diagnosis and let Billy be
        // honest instead of forcing a marginal recommendation.
        return {
          query,
          filters,
          latencyMs: Date.now() - start,
          ...primary,
          noConfidentMatch: true,
        };
      }
      // Truly zero structural matches — diagnose which criterion is most
      // responsible instead of silently substituting a broadened search.
      // Billy turns this into a question for the recruiter (FS-CS-001
      // "Fit, Not Match") rather than deciding the trade-off on its own.
      const diagnosis = await this.diagnoseZeroMatch(filters, excludeIds);
      return {
        query,
        filters,
        latencyMs: Date.now() - start,
        ...primary,
        diagnosis,
      };
    }

    // Past this point every athlete matching the current criteria has
    // already been shown this conversation ("show me more" with nothing
    // left) — broaden to other positions in the same sport so Billy can
    // still offer someone new.
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
        false,
      );
      if (relaxed.athletes.length > 0) {
        return {
          query,
          filters,
          latencyMs: Date.now() - start,
          ...relaxed,
          relaxedPosition: filters.position,
          expanded: true,
        };
      }
    }

    // Still nothing new — drop every soft filter and keep only sport, so a
    // "show me more" request always finds someone else if anyone exists.
    const broad = await this.runQuery(
      query,
      { sport: filters.sport },
      limit,
      excludeIds,
      false,
    );
    return {
      query,
      filters,
      latencyMs: Date.now() - start,
      ...broad,
      expanded: broad.athletes.length > 0,
    };
  }

  private normalizeFilters(filters: SearchFilters): SearchFilters {
    const normalized = { ...filters };
    if (
      normalized.position &&
      NO_PREFERENCE_VALUES.has(normalized.position.toLowerCase())
    ) {
      normalized.position = undefined;
    }
    if (
      normalized.sport &&
      NO_PREFERENCE_VALUES.has(normalized.sport.toLowerCase())
    ) {
      normalized.sport = undefined;
    }
    return normalized;
  }

  private isRequired(filters: SearchFilters, field: CriteriaField): boolean {
    return resolveCriteriaPriority(filters, field) === 'required';
  }

  // A diagnosis probe needs the TRUE structural count for each relaxed
  // filter combination, not a display-sized sample — runQuery's `limit`
  // controls both the DB fetch window (take: limit * 3) and the count it
  // reports (totalFound), so reusing the normal "how many to show" limit
  // here silently capped every diagnosis at ~15 records. Once the recruiter's
  // structured filters were just sport + position (the common case — most
  // detail lives in free-text query, not filters), "drop position" always
  // resolved to the identical capped query for every search sharing a sport,
  // which is why unrelated threads kept reporting the exact same headline
  // number regardless of what was actually being asked.
  private static readonly DIAGNOSIS_SAMPLE_SIZE = 500;

  // For a fresh search that came back with zero athletes: test each hard
  // criterion in isolation (drop just that one, keep everything else) to see
  // how many athletes it alone is excluding — the field that unlocks the
  // most results when dropped is the real bottleneck. Also checks the
  // broadest reasonable version of the search (sport only) so Billy can be
  // honest when even that turns up nothing worth recommending.
  private async diagnoseZeroMatch(
    filters: SearchFilters,
    excludeIds: string[],
  ): Promise<ZeroMatchDiagnosis | undefined> {
    const candidateFields = (
      [
        'position',
        'leagueLevel',
        'ncaaEligible',
        'transferPortal',
        'region',
      ] as CriteriaField[]
    ).filter((field) => {
      if (!filters[field as keyof SearchFilters]) return false;
      return field === 'position' || this.isRequired(filters, field);
    });

    if (candidateFields.length === 0) return undefined;

    const limitingFactors = await Promise.all(
      candidateFields.map(async (field) => {
        const relaxedFilters: SearchFilters = {
          ...filters,
          [field]: undefined,
        };
        const relaxed = await this.runQuery(
          '',
          relaxedFilters,
          ScoutService.DIAGNOSIS_SAMPLE_SIZE,
          excludeIds,
        );
        return {
          field,
          priority: resolveCriteriaPriority(filters, field),
          resultCountIfDropped: relaxed.totalFound,
        };
      }),
    );
    limitingFactors.sort(
      (a, b) => b.resultCountIfDropped - a.resultCountIfDropped,
    );

    const broadest = await this.runQuery(
      '',
      { sport: filters.sport },
      ScoutService.DIAGNOSIS_SAMPLE_SIZE,
      excludeIds,
    );

    return {
      limitingFactors,
      broadestFitScore: broadest.athletes[0]?.fitScore ?? null,
    };
  }

  private async runQuery(
    query: string,
    filters: SearchFilters,
    limit: number,
    excludeIds: string[] = [],
    // Off for the intentionally-loosened "show me more" broadening queries —
    // those are already explicitly framed to the recruiter as looser fits,
    // so the confidence bar that keeps a *first* search honest would defeat
    // the point of asking to see more.
    applyConfidenceFloor = true,
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
    // Sport and position are always hard DB filters when present — never
    // gated on isRequired(). They're structural boundaries the platform
    // itself guarantees (SEARCH_SYSTEM_PROMPT tells the recruiter as much),
    // not something that should silently disappear if the LLM's own
    // priority tagging for a given turn happens to mark them otherwise.
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

    // Filtros en memoria sobre dossier.data. sport/position ya se filtraron a
    // nivel de DB arriba; ncaaEligible/transferPortal/leagueLevel son estados
    // binarios reales (no existe "casi elegible"), así que siguen excluyendo
    // cuando son 'required'. minGpa y graduationYear son criterios graduales
    // — Billy busca FIT, no solo MATCH (FS-CS-001): un atleta que casi
    // cumple sigue siendo un candidato válido, así que nunca se excluyen aquí.
    // ranking.service los pondera fuerte cuando son 'required' y registra la
    // brecha como CriterionDeviation para que Billy la explique al coach.
    const filtered = normalized.filter((a) => {
      if (
        filters.leagueLevel &&
        this.isRequired(filters, 'leagueLevel') &&
        a.leagueLevel.toUpperCase() !== filters.leagueLevel.toUpperCase()
      )
        return false;
      if (
        filters.ncaaEligible &&
        this.isRequired(filters, 'ncaaEligible') &&
        !a.ncaaEligible
      )
        return false;
      if (
        filters.transferPortal &&
        this.isRequired(filters, 'transferPortal') &&
        !a.inTransferPortal
      )
        return false;
      if (
        filters.region &&
        this.isRequired(filters, 'region') &&
        !a.preferredRegions.includes(filters.region)
      )
        return false;
      return true;
    });

    this.logger.log(`Scout after filter: ${filtered.length} athletes`);

    const ranked = this.ranking.rankAthletes(filtered, query, filters);

    // Billy optimizes for confidence, not quantity (FS-CS-001): never pad
    // the list with a weak candidate just to make the result count look
    // bigger. totalFound stays the raw structural count (used for zero-match
    // diagnosis); athletes is only the ones actually worth recommending.
    const confident = applyConfidenceFloor
      ? ranked.filter((a) => a.fitScore >= MIN_CONFIDENT_FIT_SCORE)
      : ranked;

    return {
      totalFound: filtered.length,
      athletes: confident.slice(0, limit),
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
