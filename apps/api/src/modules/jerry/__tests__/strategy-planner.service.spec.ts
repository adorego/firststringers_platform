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
    // 'sport' is a representable field → default context is in ONBOARDING mode
    missingFields: ['sport', 'GPA'],
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

    it('follows the v2 onboarding order: graduation year first, goals before target level', () => {
      const first = service.decide(
        makeCtx({
          missingFields: ['sport', 'graduation year', 'location'],
          intent: 'other',
        }),
      );
      expect(first.targetField).toBe('graduation year');

      const direction = service.decide(
        makeCtx({
          missingFields: ['competitive level goal', 'goals'],
          intent: 'other',
        }),
      );
      expect(direction.targetField).toBe('goals');
    });

    it('defers GPA and league level to the end of the flow', () => {
      const result = service.decide(
        makeCtx({
          missingFields: ['GPA', 'league level', 'motivation'],
          intent: 'other',
        }),
      );
      expect(result.targetField).toBe('motivation');
    });

    it('welcome carries the first pending field as targetField', () => {
      const result = service.decide(
        makeCtx({
          session: makeSession([]),
          missingFields: ['sport', 'graduation year'],
        }),
      );
      expect(result.type).toBe('welcome');
      expect(result.targetField).toBe('graduation year');
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

    it('returns "continuous" when the athlete is already representable', () => {
      // No representable fields missing → onboarding is over
      const result = service.decide(makeCtx({ missingFields: ['GPA'] }));
      expect(result.type).toBe('continuous');
    });
  });

  // ── Activation: Representable > Completo ─────────────────────────────────

  describe('activation', () => {
    it('fires exactly when the extraction covers the last representable field', () => {
      const result = service.decide(
        makeCtx({
          intent: 'recruiting',
          missingFields: ['goals', 'GPA'],
          extractedData: { availability: { goals: ['Play D1'] } },
        }),
      );
      expect(result.type).toBe('activation');
    });

    it('does NOT fire again once the athlete is already representable', () => {
      const result = service.decide(
        makeCtx({
          intent: 'academic',
          missingFields: ['GPA'],
          extractedData: { academic: { gpa: 3.8 } },
        }),
      );
      expect(result.type).toBe('continuous');
    });

    it('does NOT fire while representable fields are still missing', () => {
      const result = service.decide(
        makeCtx({
          intent: 'personal',
          missingFields: ['sport', 'goals'],
          extractedData: { identity: { sport: 'soccer' } },
        }),
      );
      expect(result.type).not.toBe('activation');
    });
  });

  // ── Continuous mode ──────────────────────────────────────────────────────

  describe('continuous mode', () => {
    it('returns "continuous" with confirmedData when a representable athlete shares new info', () => {
      const result = service.decide(
        makeCtx({
          intent: 'academic',
          missingFields: ['GPA', 'intended major'],
          extractedData: { academic: { intendedMajor: 'Business' } },
        }),
      );
      expect(result.type).toBe('continuous');
      expect(result.confirmedData).toEqual({
        academic: { intendedMajor: 'Business' },
      });
    });

    it('greets a returning representable athlete with "continuous", not "welcome"', () => {
      const result = service.decide(
        makeCtx({
          missingFields: ['clips'],
          session: makeSession([]),
        }),
      );
      expect(result.type).toBe('continuous');
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
          missingFields: ['strengths', 'physical status'],
          extractedData: { performance: { leagueLevel: 'NCAA D1' } },
        }),
      );
      expect(result.type).toBe('confirm_and_probe');
      // targetField is the NEXT missing field, not the extracted section
      expect(result.targetField).toBe('strengths');
    });

    it('does not re-ask a field that was just covered by the extraction', () => {
      const result = service.decide(
        makeCtx({
          intent: 'stats',
          missingFields: ['strengths', 'physical status'],
          extractedData: {
            performance: {
              strengths: ['finishing'],
              physicalStatus: 'healthy',
            },
          },
        }),
      );
      // 'strengths' was the last representable field missing → activation
      expect(result.type).toBe('activation');
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
    it('still answers questions in continuous mode', () => {
      const result = service.decide(
        makeCtx({ missingFields: [], intent: 'question' }),
      );
      expect(result.type).toBe('answer_and_redirect');
    });

    it('returns "continuous" when nothing is missing and data was extracted', () => {
      const result = service.decide(
        makeCtx({
          missingFields: [],
          extractedData: { identity: { sport: 'soccer' } },
        }),
      );
      expect(result.type).toBe('continuous');
    });
  });
});
