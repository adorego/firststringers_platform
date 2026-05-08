export interface User {
  id: string;
  email: string;
  name: string;
  role: "athlete" | "recruiter" | "admin";
  avatarUrl?: string;
}

export interface Dossier {
  completeness: number; // 0–1
  data: {
    identity: {
      sport: string;
      position: string;
      graduationYear: number;
      height?: string;
      weight?: string;
      hometown?: string;
      dateOfBirth?: string;
    };
    performance: {
      stats: Record<string, number>;
      leagueLevel: string;
      highlights?: string[];
    };
    academic: {
      gpa: number;
      sat?: number;
      act?: number;
      intendedMajor?: string;
      highSchool?: string;
    };
    availability: {
      transferPortal: boolean;
      preferredRegions: string[];
      eligibleSeasons?: number;
    };
  };
  narrative: string;
}

export interface Athlete extends User {
  role: "athlete";
  sport: string;
  position: string;
  graduationYear: number;
  gpa?: number;
  region?: string;
  dossier: Dossier;
}

export interface Recruiter extends User {
  role: "recruiter";
  organization: string;
  sportsFocus: string[];
}

export interface DossierSection {
  id: string;
  title: string;
  icon: string;
  completedFields: number;
  totalFields: number;
  fields: DossierField[];
}

export interface DossierField {
  key: string;
  label: string;
  value: string | number | null;
  source: "user" | "jerry";
}

export interface ChatMessage {
  id: string;
  sender: "athlete" | "jerry";
  content: string;
  timestamp: string;
  isAiGenerated?: boolean;
}

export interface MatchResult {
  athlete: Athlete;
  fitScore: number;
  breakdown: { category: string; score: number }[];
  aiSummary: string;
  isNew: boolean;
}

export interface SearchFilters {
  query: string;
  sport?: string;
  position?: string;
  minGpa?: number;
  region?: string;
  graduationYear?: number;
}
