export type BillyMessageRole = 'user' | 'assistant';

export type BillyIntent =
  | 'search_request'
  | 'refine_criteria'
  | 'question'
  | 'other';

export interface BillyMessage {
  role: BillyMessageRole;
  content: string;
  timestamp: Date;
}

export interface SearchCriteria {
  sport?: string;
  position?: string;
  leagueLevel?: string;
  minGpa?: number;
  ncaaEligible?: boolean;
  inTransferPortal?: boolean;
  preferredRegions?: string[];
  scholarshipNeed?: boolean;
  graduationYear?: number;
  keyStrengths?: string[];
}

export interface BillySessionState {
  conversationId: string;
  recruiterId: string;
  messages: BillyMessage[];
  searchCriteria: Partial<SearchCriteria>;
  missingFields: string[];
  isOnboarding: boolean;
  // Athletes already surfaced to the recruiter in this conversation — used to
  // keep "show me more" requests from repeating the same recommendations.
  shownAthleteIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BillyMessageJob {
  conversationId: string;
  recruiterId: string;
  message: string;
}

export interface BillyChatParams {
  systemPrompt: string;
  messages: BillyMessage[];
  extractedCriteria?: Partial<SearchCriteria> | null;
}
