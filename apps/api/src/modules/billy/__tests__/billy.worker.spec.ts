import type { Job } from 'bull';
import type { BillySessionService } from '../billy-session.service';
import type { BillyConversationService } from '../billy-conversation.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { ScoutService, ScoutResult } from '../../scout/scout.service';
import type { RecruiterService } from '../../recruiter/recruiter.service';
import {
  BillyMessageJob,
  BillySessionState,
} from '../../../shared/types/billy.types';
import { BillyWorker } from '../billy.worker';

// The worker builds its own OpenAI client inside its constructor (no DI seam) —
// give it a dummy key so construction never touches the real API.
process.env.OPENAI_API_KEY = 'test-key';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeJob(data: Partial<BillyMessageJob> = {}): Job<BillyMessageJob> {
  return {
    data: {
      conversationId: 'conv-1',
      recruiterId: 'recruiter-1',
      message: 'show me more athletes',
      ...data,
    },
  } as Job<BillyMessageJob>;
}

function makeSession(
  overrides: Partial<BillySessionState> = {},
): BillySessionState {
  return {
    conversationId: 'conv-1',
    recruiterId: 'recruiter-1',
    messages: [],
    searchCriteria: {},
    missingFields: [],
    isOnboarding: false,
    shownAthleteIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeScoutResult(overrides: Partial<ScoutResult> = {}): ScoutResult {
  return {
    query: 'quarterback',
    filters: { sport: 'football', position: 'QB' },
    totalFound: 1,
    latencyMs: 10,
    athletes: [
      {
        id: 'athlete-1',
        fullName: 'Test Athlete',
        name: 'Test Athlete',
        sport: 'football',
        position: 'QB',
        leagueLevel: 'D1',
        gpa: 3.5,
        graduationYear: 2027,
        ncaaEligible: true,
        inTransferPortal: false,
        preferredRegions: [],
        trajectory: 'STABLE',
        keyStrengths: [],
        fitTags: [],
        completenessScore: 0.8,
        similarity: 0.7,
        dossier: null,
        fitScore: 0.75,
        fitExplanation: {
          similarity: 0.7,
          completeness: 0.8,
          trajectory: 0.7,
          topMatchingFactors: [],
        },
        matchReasons: [],
      },
    ],
    ...overrides,
  };
}

function mockOpenAiResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

// ─── Shared mocks ───────────────────────────────────────────────────────────

const mockSession: jest.Mocked<
  Pick<
    BillySessionService,
    | 'getSession'
    | 'appendMessage'
    | 'updateSearchCriteria'
    | 'recordShownAthletes'
    | 'setOnboardingComplete'
    | 'setPendingSuggestions'
  >
> = {
  getSession: jest.fn(),
  appendMessage: jest.fn(),
  updateSearchCriteria: jest.fn(),
  recordShownAthletes: jest.fn(),
  setOnboardingComplete: jest.fn(),
  setPendingSuggestions: jest.fn(),
};

const mockConversations: jest.Mocked<
  Pick<BillyConversationService, 'persistMessages' | 'updateTitle' | 'create'>
> = {
  persistMessages: jest.fn(),
  updateTitle: jest.fn(),
  create: jest.fn(),
};

const mockEventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>> = {
  emit: jest.fn(),
};

const mockScout: jest.Mocked<Pick<ScoutService, 'search'>> = {
  search: jest.fn(),
};

const mockRecruiterService: jest.Mocked<
  Pick<RecruiterService, 'findById' | 'updateProfile'>
> = {
  findById: jest.fn(),
  updateProfile: jest.fn(),
};

describe('BillyWorker', () => {
  let worker: BillyWorker;
  let createCompletion: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    worker = new BillyWorker(
      mockSession as unknown as BillySessionService,
      mockConversations as unknown as BillyConversationService,
      mockEventEmitter as unknown as EventEmitter2,
      mockScout as unknown as ScoutService,
      mockRecruiterService as unknown as RecruiterService,
    );

    createCompletion = jest.fn();
    // The worker builds its own OpenAI client in the constructor (no DI seam) —
    // swap it out for a mock so tests never hit the network.
    (
      worker as unknown as {
        openai: { chat: { completions: { create: jest.Mock } } };
      }
    ).openai = {
      chat: { completions: { create: createCompletion } },
    };

    mockRecruiterService.findById.mockResolvedValue(null);
    mockConversations.persistMessages.mockResolvedValue(undefined);
  });

  describe('handleSearch — "show me more" deduplication', () => {
    it("passes the session's shownAthleteIds to Scout so it excludes them", async () => {
      const session = makeSession({ shownAthleteIds: ['already-shown-1'] });
      mockSession.getSession.mockResolvedValue(session);
      mockScout.search.mockResolvedValue(makeScoutResult());
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          'Here you go. [SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockScout.search).toHaveBeenCalledWith(
        'quarterback',
        { sport: 'football', position: 'QB' },
        5,
        ['already-shown-1'],
      );
    });

    it('records the newly returned athletes as shown, on top of what was already shown', async () => {
      const session = makeSession({ shownAthleteIds: ['already-shown-1'] });
      mockSession.getSession.mockResolvedValue(session);
      mockScout.search.mockResolvedValue(makeScoutResult());
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockSession.recordShownAthletes).toHaveBeenCalledWith(
        'conv-1',
        'recruiter-1',
        ['athlete-1'],
      );
    });

    it('does not record anything shown when the search comes back empty', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(makeScoutResult({ athletes: [] }));
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockSession.recordShownAthletes).not.toHaveBeenCalled();
    });

    it('flags the response as an expanded search and adjusts the message when Scout had to broaden filters', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(makeScoutResult({ expanded: true }));
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          isExpandedSearch: true,
          message: expect.stringContaining(
            "You've already seen the closest matches",
          ) as unknown as string,
        }),
      );
    });

    it('does not flag a normal (non-expanded) search result', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(makeScoutResult());
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({ isExpandedSearch: false }),
      );
    });
  });

  describe('handleSearch — profile updates', () => {
    it('cherry-picks known fields from a [PROFILE_UPDATE] tag and ignores unknown keys', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          'Updated your sport. [PROFILE_UPDATE]{"sport":"basketball","notARealField":"x"}[/PROFILE_UPDATE]',
        ),
      );

      await worker.handle(makeJob({ message: 'switch me to basketball' }));

      expect(mockRecruiterService.updateProfile).toHaveBeenCalledWith(
        'recruiter-1',
        expect.objectContaining({ sport: 'basketball' }),
      );
      const updateArg = mockRecruiterService.updateProfile.mock
        .calls[0][1] as Record<string, unknown>;
      expect(updateArg).not.toHaveProperty('notARealField');
    });
  });

  describe('error handling', () => {
    it('emits billy.error and rethrows when something in the pipeline throws', async () => {
      mockSession.getSession.mockRejectedValue(new Error('redis down'));

      await expect(worker.handle(makeJob())).rejects.toThrow('redis down');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.error',
        expect.objectContaining({ conversationId: 'conv-1' }),
      );
    });
  });
});
