import { StrategyPlannerService } from '../strategy-planner.service';
import {
  JerryMessage,
  JerrySessionState,
  StrategyContext,
} from '../../../shared/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMessage(
  role: 'user' | 'assistant',
  content: string,
): JerryMessage {
  return { role, content, timestamp: new Date() };
}

function makeSession(messages: JerryMessage[] = []): JerrySessionState {
  return {
    athleteId: 'athlete-test',
    messages,
    dossierSnapshot: {},
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCtx(overrides: Partial<StrategyContext> = {}): StrategyContext {
  return {
    intent: 'other',
    missingFields: ['GPA'],
    extractedData: null,
    session: makeSession([
      makeMessage('user', 'Hello'),
      makeMessage('assistant', 'Welcome'),
    ]),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('StrategyPlannerService', () => {
  let service: StrategyPlannerService;

  beforeEach(() => {
    service = new StrategyPlannerService();
  });

  // ── First session scenarios ──────────────────────────────────────────────

  describe('welcome', () => {
    it('returns "welcome" when messages.length === 0 (empty session)', () => {
      const result = service.decide(makeCtx({ session: makeSession([]) }));
      expect(result.type).toBe('welcome');
    });

    it('returns "welcome" when messages.length === 1 (only the first athlete message)', () => {
      const result = service.decide(
        makeCtx({ session: makeSession([makeMessage('user', 'Hello')]) }),
      );
      expect(result.type).toBe('welcome');
    });

    it('does NOT return "welcome" when messages.length === 2 (Jerry already replied once)', () => {
      const result = service.decide(
        makeCtx({
          session: makeSession([
            makeMessage('user', 'Hello'),
            makeMessage('assistant', 'Welcome, I am Jerry'),
          ]),
        }),
      );
      expect(result.type).not.toBe('welcome');
    });
  });

  // ── Frustration detection scenarios ─────────────────────────────────────

  describe('reset on frustration', () => {
    it('returns "reset" when the athlete says "don\'t know" in the last 4 messages', () => {
      const session = makeSession([
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'What is your sport?'),
        makeMessage('user', "I don't know what to answer honestly"),
      ]);
      const result = service.decide(makeCtx({ session }));
      expect(result.type).toBe('reset');
    });

    it('returns "reset" when the athlete says "stop"', () => {
      const session = makeSession([
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'What is your GPA?'),
        makeMessage('user', 'stop'),
      ]);
      const result = service.decide(makeCtx({ session }));
      expect(result.type).toBe('reset');
    });

    it('does NOT return "reset" when "stop" was said 6 messages ago (outside the 4-message window)', () => {
      const session = makeSession([
        makeMessage('user', 'stop'), // index 0 — outside window
        makeMessage('assistant', 'I understand...'),
        makeMessage('user', 'ok, continuing'),
        makeMessage('assistant', 'What is your sport?'),
        makeMessage('user', 'soccer'),
        makeMessage('assistant', 'What is your position?'),
      ]);
      const result = service.decide(
        makeCtx({ session, missingFields: ['GPA'] }),
      );
      expect(result.type).not.toBe('reset');
    });
  });

  // ── Next field selection scenarios ───────────────────────────────────────

  describe('pickNextField', () => {
    it('asks "sport" before "GPA" because it has higher priority', () => {
      const result = service.decide(
        makeCtx({ missingFields: ['GPA', 'sport'], intent: 'other' }),
      );
      expect(result.type).toBe('strategic_ask');
      expect(result.targetField).toBe('sport');
    });

    it('does not repeat the field Jerry asked in its last message', () => {
      const session = makeSession([
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Tell me about your position on the field'),
      ]);
      const result = service.decide(
        makeCtx({
          session,
          missingFields: ['position', 'GPA'],
          intent: 'other',
        }),
      );
      expect(result.targetField).not.toBe('position');
      expect(result.targetField).toBe('GPA');
    });

    it('returns "narrative_focus" when all fields are complete', () => {
      const result = service.decide(makeCtx({ missingFields: [] }));
      expect(result.type).toBe('narrative_focus');
    });
  });

  // ── Intent scenarios ─────────────────────────────────────────────────────

  describe('intent', () => {
    it('returns "answer_and_redirect" when intent === "question"', () => {
      const result = service.decide(makeCtx({ intent: 'question' }));
      expect(result.type).toBe('answer_and_redirect');
    });

    it('returns "confirm_and_probe" when intent === "stats" and data was extracted', () => {
      const result = service.decide(
        makeCtx({
          intent: 'stats',
          extractedData: { performance: { leagueLevel: 'NCAA D1' } },
        }),
      );
      expect(result.type).toBe('confirm_and_probe');
    });

    it('returns "strategic_ask" when intent === "other" and no data was extracted', () => {
      const result = service.decide(
        makeCtx({ intent: 'other', extractedData: null }),
      );
      expect(result.type).toBe('strategic_ask');
    });

    it('returns "clarify" when intent === "personal" but extractedData is null (vague input)', () => {
      const result = service.decide(
        makeCtx({ intent: 'personal', extractedData: null }),
      );
      expect(result.type).toBe('clarify');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns "narrative_focus" when missingFields is empty even if intent === "question"', () => {
      const result = service.decide(
        makeCtx({ missingFields: [], intent: 'question' }),
      );
      expect(result.type).toBe('narrative_focus');
    });

    it('returns "narrative_focus" when missingFields is empty even if there is extractedData', () => {
      const result = service.decide(
        makeCtx({
          missingFields: [],
          extractedData: { identity: { sport: 'soccer' } },
        }),
      );
      expect(result.type).toBe('narrative_focus');
    });
  });
});
