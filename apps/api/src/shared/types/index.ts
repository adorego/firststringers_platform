export type UserRole = 'ATHLETE' | 'RECRUITER' | 'COACH' | 'ADMIN';

export type MessageRole = 'user' | 'assistant';

export type JerryIntent =
  | 'stats'
  | 'academic'
  | 'personal'
  | 'availability'
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
  identity?: {
    sport?: string;
    position?: string;
    nationality?: string;
    graduationYear?: number;
  };
  performance?: {
    stats?: Record<string, number>;
    leagueLevel?: string;
    highlightUrls?: string[];
  };
  academic?: {
    gpa?: number;
    satAct?: number;
    intendedMajor?: string;
    ncaaEligibility?: boolean;
  };
  availability?: {
    transferPortal?: boolean;
    preferredRegions?: string[];
    scholarshipNeed?: boolean;
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
  | 'narrative_focus'
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
