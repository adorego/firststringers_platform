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

export interface RankedAthlete extends ScoutAthleteCandidate {
  fitScore: number;
  fitExplanation: FitExplanation;
  matchReasons: string[];
}

export interface ScoutResult {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  latencyMs: number;
  athletes: RankedAthlete[];
}
