import { Injectable } from '@nestjs/common';
import {
  ConversationStrategy,
  JerryMessage,
  StrategyContext,
} from '../../shared/types';

const FIELD_PRIORITY = [
  'sport',
  'position',
  'graduation year',
  'stats',
  'league level',
  'GPA',
  'intended major',
  'availability',
  'preferred regions',
];

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
      return { type: 'narrative_focus' };
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
      intent === 'availability';

    if (isDataIntent && extractedData === null) {
      return { type: 'clarify' };
    }

    if (extractedData && Object.keys(extractedData).length > 0) {
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
