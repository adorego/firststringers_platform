// How much weight a criterion carries in Billy's search, per FS-CS-001
// ("Billy must understand priorities, not only filters"). A recruiter's
// request is rarely a flat list of equally-weighted filters — e.g. "2027
// linebacker, 6'2", Florida, good student, ready to contribute" mixes hard
// requirements (position, class) with soft signals (height, region) that
// should shift ranking rather than exclude athletes outright.
//   required   — heavily weighted; for sport/position it's a hard, disqualifying
//                filter (the search is structurally meaningless without them). For
//                every other field it never excludes an athlete outright — Billy
//                searches for fit, not just match, so a highly-relevant athlete who
//                misses a "required" field is still surfaced, with the miss recorded
//                as a CriterionDeviation the recruiter must be told about.
//   important  — materially affects fit; heavily weighted in ranking, never excludes.
//   preference — nice to have; lightly weighted.
//   flexible   — a loose signal; barely moves the ranking, mostly a tiebreaker.
export type CriteriaPriority =
  | 'required'
  | 'important'
  | 'preference'
  | 'flexible';

export type CriteriaField =
  | 'sport'
  | 'position'
  | 'minGpa'
  | 'graduationYear'
  | 'transferPortal'
  | 'ncaaEligible'
  | 'leagueLevel'
  | 'region';

// Applied when Billy extracts a criterion but doesn't (or can't) tag its
// priority explicitly. Sport, position, and class year are treated as
// disqualifying by default since a search without them isn't meaningful;
// everything else defaults to a soft signal so it shapes ranking instead of
// silently zeroing out results (this also matches the existing instruction
// in SEARCH_SYSTEM_PROMPT to never treat GPA as a hard requirement).
export const DEFAULT_CRITERIA_PRIORITY: Record<
  CriteriaField,
  CriteriaPriority
> = {
  sport: 'required',
  position: 'required',
  graduationYear: 'required',
  minGpa: 'important',
  ncaaEligible: 'important',
  transferPortal: 'preference',
  leagueLevel: 'preference',
  region: 'preference',
};

export function resolveCriteriaPriority(
  filters: Pick<SearchFilters, 'priorities'>,
  field: CriteriaField,
): CriteriaPriority {
  return filters.priorities?.[field] ?? DEFAULT_CRITERIA_PRIORITY[field];
}

export interface SearchFilters {
  sport?: string;
  position?: string;
  minGpa?: number;
  graduationYear?: number;
  transferPortal?: boolean;
  ncaaEligible?: boolean;
  leagueLevel?: string;
  region?: string;
  // Priority tier Billy assigned to each criterion above when extracting it
  // from the conversation. Missing entries fall back to
  // DEFAULT_CRITERIA_PRIORITY.
  priorities?: Partial<Record<CriteriaField, CriteriaPriority>>;
}

// Plural, human-readable labels for the position codes stored on Athlete —
// used to phrase Billy's "here's who I can introduce you to instead" fallback.
// Keyed by sport because the same code means different things across sports
// (e.g. "C" is a baseball catcher, a basketball center, and a soccer... not).
export const POSITION_LABELS: Record<string, Record<string, string>> = {
  football: {
    QB: 'quarterbacks',
    WR: 'wide receivers',
    RB: 'running backs',
    CB: 'cornerbacks',
    OL: 'offensive linemen',
    TE: 'tight ends',
    FS: 'free safeties',
    SS: 'strong safeties',
    LB: 'linebackers',
    DE: 'defensive ends',
    DT: 'defensive tackles',
    K: 'kickers',
    P: 'punters',
  },
  basketball: {
    PG: 'point guards',
    SG: 'shooting guards',
    SF: 'small forwards',
    PF: 'power forwards',
    C: 'centers',
  },
  baseball: {
    P: 'pitchers',
    C: 'catchers',
    '1B': 'first basemen',
    '2B': 'second basemen',
    '3B': 'third basemen',
    SS: 'shortstops',
    LF: 'left fielders',
    CF: 'center fielders',
    RF: 'right fielders',
    OF: 'outfielders',
    DH: 'designated hitters',
  },
  soccer: {
    GK: 'goalkeepers',
    DF: 'defenders',
    FB: 'fullbacks',
    MF: 'midfielders',
    WG: 'wingers',
    FW: 'forwards',
    ST: 'strikers',
  },
  volleyball: {
    S: 'setters',
    OH: 'outside hitters',
    OPP: 'opposite hitters',
    MB: 'middle blockers',
    L: 'liberos',
    DS: 'defensive specialists',
  },
};

// Flattened shape of Dossier.data (a Prisma Json column) as Scout reads it.
// Mirrors the subset of DossierData (see index.ts) that ranking cares about.
export interface DossierScoutFields {
  leagueLevel?: string;
  gpa?: number | null;
  graduationYear?: number | null;
  ncaaEligible?: boolean;
  inTransferPortal?: boolean;
  preferredRegions?: string[];
  trajectory?: string;
  keyStrengths?: string[];
  fitTags?: string[];
  recruiterPitch?: string | null;
}

// Athlete shape after Scout flattens dossier.data, before ranking is applied.
export interface ScoutAthleteCandidate {
  id: string;
  fullName: string;
  name: string;
  sport: string;
  position: string;
  leagueLevel: string;
  gpa: number | null;
  graduationYear: number | null;
  ncaaEligible: boolean;
  inTransferPortal: boolean;
  preferredRegions: string[];
  trajectory: string;
  keyStrengths: string[];
  fitTags: string[];
  completenessScore: number;
  similarity: number;
  dossier: { summary: string | null; recruiterPitch: string | null } | null;
}

export interface FitExplanation {
  similarity: number;
  completeness: number;
  trajectory: number;
  topMatchingFactors: string[];
}

// A stated criterion this athlete does NOT satisfy — the counterpart to
// matchReasons. Billy is expected to search for fit, not just match (per
// FS-CS-001): an athlete can still be a strong recommendation without
// meeting every criterion, but every 'required' or 'important' deviation
// must be explained to the recruiter rather than silently dropped.
export interface CriterionDeviation {
  field: CriteriaField;
  priority: CriteriaPriority;
  // Plain-language, fact-grounded description of the gap (e.g. "class of
  // 2026, one year ahead of the 2027 you're targeting") — built entirely
  // from real filter/athlete values so Billy can narrate it without
  // inventing anything.
  note: string;
}

export interface RankedAthlete extends ScoutAthleteCandidate {
  fitScore: number;
  fitExplanation: FitExplanation;
  matchReasons: string[];
  deviations: CriterionDeviation[];
}

// Built when a fresh search comes back with zero athletes, so Billy can turn
// an empty result into a recruiting conversation instead of a dead end
// (FS-CS-001 §"Fit, Not Match"). For every hard criterion actually present,
// resultCountIfDropped answers "how many athletes would match if ONLY this
// one criterion were removed?" — the field that unlocks the most results is
// the real bottleneck. broadestFitScore is the best fit score available for
// the sport with every other filter dropped — the honesty floor: if it's
// null or very low, there's truly no one worth recommending today.
export interface ZeroMatchDiagnosis {
  limitingFactors: {
    field: CriteriaField;
    priority: CriteriaPriority;
    resultCountIfDropped: number;
  }[];
  broadestFitScore: number | null;
}

export interface ScoutResult {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  latencyMs: number;
  athletes: RankedAthlete[];
  diagnosis?: ZeroMatchDiagnosis;
}
