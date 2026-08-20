export type UserRole = 'ATHLETE' | 'RECRUITER' | 'COACH' | 'ADMIN';

export type RepresentationStatus =
  | 'registered'
  | 'activation'
  | 'represented'
  | 'verified';

export interface InitiateJob {
  athleteId: string;
}

export interface OwnersManualData {
  motivations?: string[];
  values?: string[];
  longTermAspirations?: string[];
  communicationStyle?: string;
  learningStyle?: string;
  decisionMaking?: string;
  competitiveIdentity?: string;
  preferredEnvironments?: string[];
  limitingEnvironments?: string[];
  supportSystem?: string;
}

export type MessageRole = 'user' | 'assistant';

export type JerryIntent =
  | 'stats'
  | 'academic'
  | 'personal'
  | 'availability'
  | 'media'
  | 'character'
  | 'recruiting'
  | 'question'
  | 'other';

export interface JerryMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface JerrySessionState {
  athleteId: string;
  messages: JerryMessage[];
  dossierSnapshot: Partial<DossierData>;
  missingFields: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DossierData {
  // Section 2: Athlete Identity
  identity?: {
    sport?: string;
    position?: string;
    location?: string;
    school?: string;
    club?: string;
    competitiveLevel?: string;
    graduationYear?: number;
    nationality?: string;
  };
  // Section 3: Athletic Snapshot
  performance?: {
    stats?: Record<string, number>;
    leagueLevel?: string;
    physicalProfile?: {
      height?: string;
      weight?: string;
      speed?: string;
      vertical?: string;
      dominantSide?: string;
    };
    strengths?: string[];
    physicalStatus?: string;
    archetype?: string;
    highlightUrls?: string[];
  };
  // Section 3 cont: Academic
  academic?: {
    gpa?: number;
    satAct?: number;
    intendedMajor?: string;
    ncaaEligibility?: boolean;
    academicInterests?: string[];
  };
  // Section 4: Recruiting Direction
  availability?: {
    transferPortal?: boolean;
    preferredRegions?: string[];
    scholarshipNeed?: boolean;
    timeline?: string;
    competitiveLevelGoal?: string;
    goals?: string[];
    limitations?: string[];
    relocationOpenness?: string;
    nonNegotiables?: string[];
  };
  // Section 5: Representation Assets
  media?: {
    highlightUrls?: string[];
    clipUrls?: string[];
    socialMedia?: {
      instagram?: string;
      twitter?: string;
      hudl?: string;
      other?: string;
    };
    references?: string[];
  };
  // Section 6: Competitive Identity & Growth Signals
  character?: {
    mentality?: string;
    leadership?: string;
    coachability?: string;
    resilience?: string;
    motivation?: string;
    growthAreas?: string[];
    selfRepresentation?: string;
  };
  // Root-level recruiting fields
  fitTags?: string[];
  trajectory?: string;
  recruiterPitch?: string;
  demoMetadata?: {
    synthetic?: boolean;
    dataset?: string;
    source?: string;
  };
}

export interface MessageJob {
  athleteId: string;
  sessionId: string;
  message: string;
}

export interface DossierUpdateJob {
  athleteId: string;
  newData: Partial<DossierData>;
}

export interface DossierUpdatedEvent {
  athleteId: string;
  data: DossierData;
  completeness: number;
  changedFields: string[];
}

export interface ChatParams {
  systemPrompt: string;
  messages: JerryMessage[];
  extractedData?: Partial<DossierData> | null;
}

export type ConversationStrategyType =
  | 'welcome'
  | 'confirm_and_probe'
  | 'answer_and_redirect'
  | 'clarify'
  | 'strategic_ask'
  | 'section_transition'
  | 'summarize_dossier'
  | 'continuous'
  | 'activation'
  | 'reset';

export interface ConversationStrategy {
  type: ConversationStrategyType;
  targetField?: string;
  confirmedData?: Partial<DossierData>;
}

export interface StrategyContext {
  intent: JerryIntent;
  missingFields: string[];
  extractedData: Partial<DossierData> | null;
  session: JerrySessionState;
}
