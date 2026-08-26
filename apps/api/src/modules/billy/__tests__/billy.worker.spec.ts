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
        deviations: [],
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

  describe('handleSearch — recommendation narration', () => {
    it('grounds the message in real deviations when an athlete misses a required/important criterion', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      const baseAthlete = makeScoutResult().athletes[0];
      mockScout.search.mockResolvedValue(
        makeScoutResult({
          athletes: [
            {
              ...baseAthlete,
              graduationYear: 2026,
              deviations: [
                {
                  field: 'graduationYear',
                  priority: 'required',
                  note: "Class of 2026, 1 year ahead of the 2027 class you're targeting",
                },
              ],
            },
          ],
        }),
      );
      createCompletion
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            '[SEARCH_READY]{"query":"linebacker","filters":{"sport":"football","position":"LB","graduationYear":2027}}[/SEARCH_READY]',
          ),
        )
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            "This linebacker is class of 2026, a year ahead of what you're targeting, but everything else about the profile lines up well.",
          ),
        );

      await worker.handle(makeJob());

      expect(createCompletion).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          message: expect.stringContaining(
            'class of 2026',
          ) as unknown as string,
        }),
      );
    });

    it('always explains the recommendation, grounded in dossier context, even when every athlete fully matches', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      const baseAthlete = makeScoutResult().athletes[0];
      mockScout.search.mockResolvedValue(
        makeScoutResult({
          athletes: [
            {
              ...baseAthlete,
              keyStrengths: ['quick release', 'reads coverage well'],
              matchReasons: [
                'Plays football ✓ (required)',
                'Position QB ✓ (required)',
              ],
              dossier: {
                summary: 'Strong academic profile and locker-room leader.',
                recruiterPitch: null,
              },
            },
          ],
        }),
      );
      createCompletion
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            'Here you go. [SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
          ),
        )
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            'I found one quarterback I think you should look at — he fits your position and class, and stands out academically and as a leader. Want me to pull up his dossier?',
          ),
        );

      await worker.handle(makeJob());

      expect(createCompletion).toHaveBeenCalledTimes(2);
      const calls = createCompletion.mock.calls as unknown as unknown[][];
      const narrationCall = calls[1][0] as {
        messages: { content: string }[];
      };
      expect(narrationCall.messages[1].content).toContain('locker-room leader');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          message: expect.stringContaining(
            'pull up his dossier',
          ) as unknown as string,
        }),
      );
    });
  });

  describe('handleSearch — malformed [SEARCH_READY] payload', () => {
    it('never leaks the raw internal tag into the visible chat, even when the JSON inside it fails to parse', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      createCompletion.mockResolvedValue(
        mockOpenAiResponse(
          'One moment. [SEARCH_READY]{"query": "linebacker", "filters": {sport: "football",}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(mockScout.search).not.toHaveBeenCalled();
      const emittedCall = mockEventEmitter.emit.mock.calls.find(
        ([event]) => event === 'billy.response',
      );
      const payload = emittedCall?.[1] as { message: string };
      expect(payload.message).not.toContain('[SEARCH_READY]');
      expect(payload.message).not.toContain('filters');
      expect(payload.message).toContain('try asking again');
    });
  });

  describe('handleSearch — zero-match diagnosis', () => {
    it('asks a grounded trade-off question when Scout diagnosed a limiting criterion', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(
        makeScoutResult({
          athletes: [],
          diagnosis: {
            limitingFactors: [
              {
                field: 'region',
                priority: 'required',
                resultCountIfDropped: 3,
              },
              {
                field: 'position',
                priority: 'required',
                resultCountIfDropped: 0,
              },
            ],
            broadestFitScore: 0.6,
          },
        }),
      );
      createCompletion
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            '[SEARCH_READY]{"query":"linebacker in Puebla","filters":{"sport":"football","position":"LB","region":"Puebla"}}[/SEARCH_READY]',
          ),
        )
        .mockResolvedValueOnce(
          mockOpenAiResponse(
            'No exact match today — location in Puebla is the most limiting criterion. I could keep position and class and expand to all of Mexico, or keep Puebla and loosen something else. Which would you rather prioritize?',
          ),
        );

      await worker.handle(makeJob());

      expect(createCompletion).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          message: expect.stringContaining(
            'most limiting criterion',
          ) as unknown as string,
        }),
      );
    });

    it('falls back to the generic message when Scout had nothing structural to diagnose', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(makeScoutResult({ athletes: [] }));
      createCompletion.mockResolvedValueOnce(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(createCompletion).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          message: expect.stringContaining(
            "couldn't find an athlete",
          ) as unknown as string,
        }),
      );
    });
  });

  describe('handleSearch — confidence floor', () => {
    it('gives the honest no-confident-match message without an extra LLM call', async () => {
      mockSession.getSession.mockResolvedValue(makeSession());
      mockScout.search.mockResolvedValue(
        makeScoutResult({ athletes: [], noConfidentMatch: true }),
      );
      createCompletion.mockResolvedValueOnce(
        mockOpenAiResponse(
          '[SEARCH_READY]{"query":"quarterback","filters":{"sport":"football","position":"QB"}}[/SEARCH_READY]',
        ),
      );

      await worker.handle(makeJob());

      expect(createCompletion).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'billy.response',
        expect.objectContaining({
          message: expect.stringContaining(
            "I'd feel confident",
          ) as unknown as string,
        }),
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
