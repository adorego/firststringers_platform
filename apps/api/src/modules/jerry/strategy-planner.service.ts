import { Injectable } from '@nestjs/common';
import {
  ConversationStrategy,
  JerryMessage,
  StrategyContext,
} from '../../shared/types';

// Ordered to match the product onboarding flow (Athlete Onboarding Process.docx)
const FIELD_PRIORITY = [
  // Section 2: Athlete Identity (Q1-7)
  'sport',
  'position',
  'graduation year',
  'location',
  'school',
  'competitive level',
  // Section 3: Athletic Snapshot (Q8-12)
  'physical profile',
  'dominant side',
  'stats',
  'league level',
  'strengths',
  'physical status',
  // Section 4: Recruiting Direction (Q13-19)
  'competitive level goal',
  'goals',
  'timeline',
  'preferred regions',
  'relocation openness',
  'GPA',
  'intended major',
  'non-negotiables',
  // Section 5: Visibility & Assets (Q20-24)
  'highlights',
  'clips',
  'social media',
  'references',
  'self-representation',
  // Section 6: Competitive Identity (Q25-27)
  'growth areas',
  'mentality',
  'motivation',
];

// The first field of each section — when the next field to ask is one of these,
// and extracted data was just received, trigger a section_transition
const SECTION_FIRST_FIELDS = new Set([
  'physical profile', // Section 3: Athletic Snapshot
  'competitive level goal', // Section 4: Recruiting Direction
  'highlights', // Section 5: Visibility & Assets
  'growth areas', // Section 6: Competitive Identity
]);

const FRUSTRATION_KEYWORDS = ["don't know", 'not sure', 'stop', 'quit'];
const FRUSTRATION_WINDOW = 4;

@Injectable()
export class StrategyPlannerService {
  decide(ctx: StrategyContext): ConversationStrategy {
    const { intent, missingFields, extractedData, session } = ctx;

    if (session.messages.length <= 1) {
      return { type: 'welcome' };
    }

    if (this.detectFrustration(session.messages)) {
      return { type: 'reset' };
    }

    if (missingFields.length === 0) {
      return { type: 'activation' };
    }

    if (intent === 'question') {
      return {
        type: 'answer_and_redirect',
        targetField: this.pickNextField(missingFields, session.messages),
      };
    }

    const isDataIntent =
      intent === 'stats' ||
      intent === 'academic' ||
      intent === 'personal' ||
      intent === 'availability' ||
      intent === 'media' ||
      intent === 'character' ||
      intent === 'recruiting';

    if (isDataIntent && extractedData === null) {
      return { type: 'clarify' };
    }

    if (extractedData && Object.keys(extractedData).length > 0) {
      const nextField = this.pickNextField(missingFields, session.messages);

      // Check if we just crossed a section boundary
      const transition = this.detectSectionTransition(nextField);
      if (transition) {
        return {
          type: 'section_transition',
          targetField: nextField,
          confirmedData: extractedData,
        };
      }

      const topKey = Object.keys(extractedData)[0];
      return {
        type: 'confirm_and_probe',
        targetField: topKey,
        confirmedData: extractedData,
      };
    }

    return {
      type: 'strategic_ask',
      targetField: this.pickNextField(missingFields, session.messages),
    };
  }

  private detectSectionTransition(
    nextField: string | undefined,
  ): boolean {
    if (!nextField) return false;
    return SECTION_FIRST_FIELDS.has(nextField);
  }

  private detectFrustration(messages: JerryMessage[]): boolean {
    const recentMessages = messages.slice(-FRUSTRATION_WINDOW);
    return recentMessages.some(
      (msg) =>
        msg.role === 'user' &&
        FRUSTRATION_KEYWORDS.some((kw) =>
          msg.content.toLowerCase().includes(kw),
        ),
    );
  }

  private pickNextField(
    missingFields: string[],
    messages: JerryMessage[],
  ): string | undefined {
    if (missingFields.length === 0) return undefined;

    const lastAsked = this.getLastAskedField(missingFields, messages);

    const sorted = [...missingFields].sort((a, b) => {
      const ai = FIELD_PRIORITY.indexOf(a);
      const bi = FIELD_PRIORITY.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return sorted.find((f) => f !== lastAsked) ?? sorted[0];
  }

  private pickNextFieldFromList(
    missingFields: string[],
  ): string | undefined {
    if (missingFields.length === 0) return undefined;
    return [...missingFields].sort((a, b) => {
      const ai = FIELD_PRIORITY.indexOf(a);
      const bi = FIELD_PRIORITY.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })[0];
  }

  private getLastAskedField(
    missingFields: string[],
    messages: JerryMessage[],
  ): string | undefined {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastAssistant) return undefined;
    return missingFields.find((field) => lastAssistant.content.includes(field));
  }
}
