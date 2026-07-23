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
    it('does NOT reset when the athlete is simply unsure', () => {
      const session = makeSession([
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'What is your sport?'),
        makeMessage('user', "I don't know what to answer honestly"),
      ]);
      const result = service.decide(makeCtx({ session }));
      expect(result.type).not.toBe('reset');
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

    it('follows FS-CS-005A onboarding order: sport first, target level before goals', () => {
      const first = service.decide(
        makeCtx({
          missingFields: ['sport', 'graduation year', 'location'],
          intent: 'other',
        }),
      );
      expect(first.targetField).toBe('sport');

      const direction = service.decide(
        makeCtx({
          missingFields: ['competitive level goal', 'goals'],
          intent: 'other',
        }),
      );
      expect(direction.targetField).toBe('competitive level goal');
    });

    it('follows FS-CS-005A activation order: identity before athletic foundation', () => {
      const firstIdentity = service.decide(
        makeCtx({
          missingFields: ['graduation year', 'location', 'sport', 'position'],
          intent: 'other',
        }),
      );
      expect(firstIdentity.targetField).toBe('sport');

      const afterSport = service.decide(
        makeCtx({
          missingFields: ['graduation year', 'location', 'position'],
          intent: 'other',
        }),
      );
      expect(afterSport.targetField).toBe('position');

      const afterPosition = service.decide(
        makeCtx({
          missingFields: ['graduation year', 'location'],
          intent: 'other',
        }),
      );
      expect(afterPosition.targetField).toBe('graduation year');

      const athleticFoundation = service.decide(
        makeCtx({
          missingFields: ['school', 'competitive level', 'physical profile'],
          intent: 'other',
        }),
      );
      expect(athleticFoundation.targetField).toBe('school');
    });

    it('places Academic & Personal Direction before Owner Manual and assets', () => {
      const result = service.decide(
        makeCtx({
          missingFields: ['GPA', 'self-representation', 'highlights'],
          intent: 'other',
        }),
      );
      expect(result.targetField).toBe('GPA');
    });

    it('welcome carries the first pending field as targetField', () => {
      const result = service.decide(
        makeCtx({
          session: makeSession([]),
          missingFields: ['sport', 'graduation year'],
        }),
      );
      expect(result.type).toBe('welcome');
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

    it('returns "continuous" when the athlete is already representable', () => {
      // No representable fields missing → onboarding is over
      const result = service.decide(makeCtx({ missingFields: ['highlights'] }));
      expect(result.type).toBe('continuous');
    });
  });

  // ── Activation: Representable > Completo ─────────────────────────────────

  describe('activation', () => {
    it('fires exactly when the extraction covers the last representable field', () => {
      const result = service.decide(
        makeCtx({
          intent: 'character',
          missingFields: ['growth areas', 'highlights'],
          extractedData: { character: { growthAreas: ['finishing'] } },
        }),
      );
      expect(result.type).toBe('activation');
    });

    it('does NOT fire again once the athlete is already representable', () => {
      const result = service.decide(
        makeCtx({
          intent: 'media',
          missingFields: ['highlights'],
          extractedData: { media: { highlightUrls: ['https://hudl.com/1'] } },
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

  describe('FS-CS-005A section transitions', () => {
    it('transitions into Athletic Foundation when identity is complete', () => {
      const result = service.decide(
        makeCtx({
          intent: 'personal',
          missingFields: ['sport', 'school', 'competitive level'],
          extractedData: { identity: { sport: 'Soccer' } },
        }),
      );
      expect(result.type).toBe('section_transition');
      expect(result.targetField).toBe('school');
    });

    it('transitions into Academic & Personal Direction before GPA', () => {
      const result = service.decide(
        makeCtx({
          intent: 'recruiting',
          missingFields: ['goals', 'GPA', 'intended major'],
          extractedData: { availability: { goals: ['Find the right fit'] } },
        }),
      );
      expect(result.type).toBe('section_transition');
      expect(result.targetField).toBe('GPA');
    });

    it("transitions into Owner's Manual initialization before self-representation", () => {
      const result = service.decide(
        makeCtx({
          intent: 'academic',
          missingFields: ['GPA', 'self-representation', 'growth areas'],
          extractedData: { academic: { gpa: 3.7 } },
        }),
      );
      expect(result.type).toBe('section_transition');
      expect(result.targetField).toBe('self-representation');
    });
  });

  // ── Continuous mode ──────────────────────────────────────────────────────

  describe('continuous mode', () => {
    it('returns "continuous" with confirmedData when a representable athlete shares new info', () => {
      const result = service.decide(
        makeCtx({
          intent: 'academic',
          missingFields: ['clips', 'intended major'],
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

    it('detects summary requests and keeps the next Dossier field attached', () => {
      const session = makeSession([
        makeMessage('user', 'Hi'),
        makeMessage('assistant', 'What year do you graduate?'),
        makeMessage('user', 'Can you summarize what you know about me so far?'),
      ]);
      const result = service.decide(
        makeCtx({
          intent: 'question',
          session,
          missingFields: ['physical profile', 'timeline'],
        }),
      );
      expect(result.type).toBe('summarize_dossier');
      expect(result.targetField).toBe('physical profile');
    });

    it('returns "confirm_and_probe" when an onboarding field was extracted but representation is not active yet', () => {
      const result = service.decide(
        makeCtx({
          intent: 'recruiting',
          missingFields: ['competitive level goal', 'goals'],
          extractedData: {
            availability: { competitiveLevelGoal: 'NCAA D1' },
          },
        }),
      );
      expect(result.type).toBe('confirm_and_probe');
      // targetField is the NEXT missing field, not the extracted section
      expect(result.targetField).toBe('goals');
    });

    it('does not re-ask a field that was just covered by the extraction', () => {
      const result = service.decide(
        makeCtx({
          intent: 'personal',
          missingFields: ['school', 'competitive level'],
          extractedData: {
            identity: {
              school: 'First Stringers Academy',
            },
          },
        }),
      );
      expect(result.type).toBe('confirm_and_probe');
      expect(result.targetField).toBe('competitive level');
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
