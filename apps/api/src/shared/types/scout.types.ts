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