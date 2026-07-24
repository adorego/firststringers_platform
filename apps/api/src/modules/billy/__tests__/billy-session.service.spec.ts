import { BillySessionService } from '../billy-session.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { BillyConversationService } from '../billy-conversation.service';
import { BillyMessage, BillySessionState } from '../../../shared/types/billy.types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockConversations: jest.Mocked<
  Pick<BillyConversationService, 'getMessages' | 'getSearchCriteria'>
> = {
  getMessages: jest.fn(),
  getSearchCriteria: jest.fn(),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function makeMessage(role: 'user' | 'assistant', content: string): BillyMessage {
  return { role, content, timestamp: new Date() };
}

function lastSavedSession(): BillySessionState {
  const calls = mockRedisService.setex.mock.calls;
  const [, , payload] = calls[calls.length - 1] as [string, number, string];
  return JSON.parse(payload) as BillySessionState;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BillySessionService', () => {
  let service: BillySessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillySessionService(
      mockRedisService as unknown as RedisService,
      mockConversations as unknown as BillyConversationService,
    );
    mockConversations.getMessages.mockResolvedValue([]);
    mockConversations.getSearchCriteria.mockResolvedValue({});
    mockRedisService.setex.mockResolvedValue('OK');
  });

  describe('getSession', () => {
    it('returns the cached session from Redis when present', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ shownAthleteIds: ['a1'] })),
      );

      const result = await service.getSession('conv-1', 'recruiter-1');

      expect(mockRedisService.get).toHaveBeenCalledWith('billy:session:conv-1');
      expect(result.shownAthleteIds).toEqual(['a1']);
    });

    it('creates a fresh session with an empty shownAthleteIds list when none exists', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.getSession('conv-1', 'recruiter-1');

      expect(result.shownAthleteIds).toEqual([]);
      expect(result.conversationId).toBe('conv-1');
      expect(result.recruiterId).toBe('recruiter-1');
      expect(mockRedisService.setex).toHaveBeenCalled();
    });

    it('warms a fresh session from the database on a Redis miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockConversations.getMessages.mockResolvedValue([
        makeMessage('user', 'hello'),
      ]);
      mockConversations.getSearchCriteria.mockResolvedValue({ sport: 'football' });

      const result = await service.getSession('conv-1', 'recruiter-1');

      expect(result.messages).toHaveLength(1);
      expect(result.searchCriteria).toEqual({ sport: 'football' });
    });

    it('backfills shownAthleteIds on a legacy cached session that predates the field', async () => {
      const legacy = makeSession();
      delete (legacy as Partial<BillySessionState>).shownAthleteIds;
      mockRedisService.get.mockResolvedValue(JSON.stringify(legacy));

      const result = await service.getSession('conv-1', 'recruiter-1');

      expect(result.shownAthleteIds).toEqual([]);
    });

    it('recovers into a fresh session when the cached JSON is corrupted', async () => {
      mockRedisService.get.mockResolvedValue('{not valid json');

      const result = await service.getSession('conv-1', 'recruiter-1');

      expect(result.shownAthleteIds).toEqual([]);
      expect(result.messages).toEqual([]);
    });

    it('overrides isOnboarding when explicitly passed, without touching the rest of the cached session', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ isOnboarding: false, shownAthleteIds: ['a1'] })),
      );

      const result = await service.getSession('conv-1', 'recruiter-1', true);

      expect(result.isOnboarding).toBe(true);
      expect(result.shownAthleteIds).toEqual(['a1']);
    });
  });

  describe('recordShownAthletes', () => {
    it('adds new athlete ids on top of the ones already recorded', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ shownAthleteIds: ['a1'] })),
      );

      await service.recordShownAthletes('conv-1', 'recruiter-1', ['a2', 'a3']);

      expect(lastSavedSession().shownAthleteIds.sort()).toEqual(['a1', 'a2', 'a3']);
    });

    it('deduplicates ids that were already recorded', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ shownAthleteIds: ['a1', 'a2'] })),
      );

      await service.recordShownAthletes('conv-1', 'recruiter-1', ['a2', 'a3']);

      const saved = lastSavedSession().shownAthleteIds;
      expect(saved.filter((id) => id === 'a2')).toHaveLength(1);
      expect(saved.sort()).toEqual(['a1', 'a2', 'a3']);
    });

    it('does nothing (no Redis write) when given an empty list', async () => {
      await service.recordShownAthletes('conv-1', 'recruiter-1', []);

      expect(mockRedisService.get).not.toHaveBeenCalled();
      expect(mockRedisService.setex).not.toHaveBeenCalled();
    });
  });

  describe('appendMessage', () => {
    it('appends a message to the session', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(makeSession()));

      await service.appendMessage('conv-1', 'recruiter-1', makeMessage('user', 'hi'));

      const saved = lastSavedSession();
      expect(saved.messages).toHaveLength(1);
      expect(saved.messages[0].content).toBe('hi');
    });

    it('trims history once it exceeds the 30-message cap, keeping the first message', async () => {
      const session = makeSession({
        messages: Array.from({ length: 30 }, (_, i) =>
          makeMessage('user', `msg-${i}`),
        ),
      });
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));

      await service.appendMessage('conv-1', 'recruiter-1', makeMessage('user', 'msg-30'));

      const saved = lastSavedSession();
      expect(saved.messages).toHaveLength(30);
      expect(saved.messages[0].content).toBe('msg-0');
      expect(saved.messages[saved.messages.length - 1].content).toBe('msg-30');
    });
  });

  describe('updateSearchCriteria', () => {
    it('merges new criteria into the existing ones without dropping unrelated fields', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ searchCriteria: { sport: 'football' } })),
      );

      await service.updateSearchCriteria('conv-1', 'recruiter-1', { position: 'QB' });

      const saved = lastSavedSession();
      expect(saved.searchCriteria).toEqual({ sport: 'football', position: 'QB' });
    });
  });

  describe('setOnboardingComplete', () => {
    it('flips isOnboarding to false', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify(makeSession({ isOnboarding: true })),
      );

      await service.setOnboardingComplete('conv-1', 'recruiter-1');

      expect(lastSavedSession().isOnboarding).toBe(false);
    });
  });

  describe('clearSession', () => {
    it('deletes the session key from Redis', async () => {
      await service.clearSession('conv-1');

      expect(mockRedisService.del).toHaveBeenCalledWith('billy:session:conv-1');
    });
  });

  describe('pending suggestions', () => {
    it('round-trips suggestions through set and get', async () => {
      await service.setPendingSuggestions('recruiter-1', ['find a QB', 'find a WR']);
      const [key, , payload] = mockRedisService.setex.mock.calls[0] as [
        string,
        number,
        string,
      ];
      expect(key).toBe('billy:pending-suggestions:recruiter-1');

      mockRedisService.get.mockResolvedValue(payload);
      const result = await service.getAndClearPendingSuggestions('recruiter-1');

      expect(result).toEqual(['find a QB', 'find a WR']);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'billy:pending-suggestions:recruiter-1',
      );
    });

    it('returns null when there are no pending suggestions', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.getAndClearPendingSuggestions('recruiter-1');

      expect(result).toBeNull();
    });
  });
});
