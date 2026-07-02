export interface SearchFilters {
  sport?: string;
  position?: string;
  minGpa?: number;
  graduationYear?: number;
  transferPortal?: boolean;
  ncaaEligible?: boolean;
  leagueLevel?: string;
  region?: string;
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

export interface AthleteMatch {
  id: string;
  fullName: string;
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
  completenessScore: number;
  fitScore: number;
  matchReasons: string[];
  dossier?: {
    summary: string | null;
    recruiterPitch: string | null;
  } | null;
}

export interface ScoutResult {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  latencyMs: number;
  athletes: AthleteMatch[];
}