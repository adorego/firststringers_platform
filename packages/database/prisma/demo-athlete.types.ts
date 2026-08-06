type CountMap = Record<string, number>;

export interface DemoDossierData {
  identity: {
    sport: string;
    position: string;
    location: string;
    school: string;
    club?: string;
    competitiveLevel: string;
    graduationYear: number;
    nationality?: string;
  };
  performance: {
    stats: Record<string, number>;
    leagueLevel: string;
    physicalProfile: {
      height: string;
      weight?: string;
      speed?: string;
      vertical?: string;
      dominantSide: string;
    };
    strengths: string[];
    physicalStatus: string;
    archetype?: string;
    highlightUrls: string[];
  };
  academic: {
    gpa: number;
    satAct?: number;
    intendedMajor: string;
    ncaaEligibility: boolean;
    academicInterests?: string[];
  };
  availability: {
    transferPortal: boolean;
    preferredRegions: string[];
    scholarshipNeed: boolean;
    timeline: string;
    competitiveLevelGoal: string;
    goals: string[];
    limitations?: string[];
    relocationOpenness: string;
    nonNegotiables: string[];
  };
  media: {
    highlightUrls: string[];
    clipUrls: string[];
    socialMedia: {
      instagram?: string;
      twitter?: string;
      hudl?: string;
      other?: string;
    };
    references: string[];
  };
  character: {
    mentality: string;
    leadership?: string;
    coachability?: string;
    resilience?: string;
    motivation: string;
    growthAreas: string[];
    selfRepresentation: string;
  };
  fitTags: string[];
  trajectory: "IMPROVING" | "STABLE" | "EMERGING";
  recruiterPitch: string;
  demoMetadata: {
    synthetic: true;
    dataset: string;
    source?: string;
  };
}

export interface DemoAthleteRecord {
  fullName: string;
  email: string;
  sport: string;
  position: string;
  scenario: string;
  narrative: string;
  advocacyScore: number;
  dossier: DemoDossierData;
}

export interface DemoAthleteDataset {
  schemaVersion: 1;
  dataset: string;
  generatedAt: string;
  athletes: DemoAthleteRecord[];
}

export interface ValidatedDemoAthlete {
  athlete: DemoAthleteRecord;
  completeness: number;
}

export interface DemoDatasetValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  athletes: ValidatedDemoAthlete[];
  distribution: {
    sports: CountMap;
    positions: CountMap;
    scenarios: CountMap;
  };
}

export type DemoImportTarget = "local" | "development";

export interface DemoImportResult {
  created: number;
  updated: number;
  total: number;
}

interface DemoTransactionClient {
  organization: {
    upsert(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  athlete: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      dossier?: { data: unknown } | null;
    } | null>;
    upsert(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  dossier: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
}

export interface DemoImportClient {
  $transaction<T>(
    callback: (client: DemoTransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
}
