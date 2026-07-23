import { Injectable } from '@nestjs/common';
import {
  ConversationStrategy,
  DossierData,
  JerryMessage,
  StrategyContext,
} from '../../shared/types';

const FIELD_PRIORITY = [
  'sport',
  'position',
  'graduation year',
  'location',
  'school',
  'competitive level',
  'physical profile',
  'dominant side',
  'stats',
  'competitive level goal',
  'goals',
  'preferred regions',
  'relocation openness',
  'GPA',
  'intended major',
  'non-negotiables',
  'self-representation',
  'growth areas',
  'mentality',
  'motivation',
  'highlights',
  'clips',
  'references',
  'social media',
  'strengths',
  'physical status',
  'timeline',
  'league level',
];

const SECTION_FIRST_FIELDS = new Set([
  'school',
  'competitive level goal',
  'GPA',
  'self-representation',
  'highlights',
]);

const FRUSTRATION_KEYWORDS = ['stop', 'quit'];
const FRUSTRATION_WINDOW = 4;

// "Representable > Completo": Jerry can start representing the athlete once
// he knows enough — identity, initial athletic snapshot and general goals.
// The dossier keeps growing forever; this is just the activation threshold.
const REPRESENTABLE_FIELDS = new Set([
  'sport',
  'position',
  'graduation year',
  'location',
  'school',
  'competitive level',
  'competitive level goal',
  'goals',
  'GPA',
  'self-representation',
  'growth areas',
]);

@Injectable()
export class StrategyPlannerService {
  decide(ctx: StrategyContext): ConversationStrategy {
    const { intent, missingFields, extractedData, session } = ctx;

    // missingFields reflects the DB BEFORE this turn's extraction is merged
    const representableMissing = missingFields.filter((f) =>
      REPRESENTABLE_FIELDS.has(f),
    );
    const alreadyRepresentable = representableMissing.length === 0;

    if (session.messages.length <= 1) {
      return alreadyRepresentable
        ? { type: 'continuous' }
        : {
            type: 'welcome',
            targetField: this.pickNextField(missingFields, session.messages),
          };
    }

    if (this.detectFrustration(session.messages)) {
      return { type: 'reset' };
    }

    const covered = extractedData
      ? this.fieldsCoveredByExtraction(extractedData)
      : new Set<string>();
    const effectiveMissing = missingFields.filter((f) => !covered.has(f));

    // Activation fires exactly on the turn that crosses the representable
    // threshold — once. After that the athlete is always "representable"
    // and conversations run in continuous mode.
    const crossedThreshold =
      !alreadyRepresentable &&
      representableMissing.every((f) => covered.has(f)) &&
      extractedData !== null &&
      Object.keys(extractedData ?? {}).length > 0;

    if (crossedThreshold) {
      return { type: 'activation', confirmedData: extractedData ?? undefined };
    }

    if (intent === 'question' && this.isSummaryRequest(session.messages)) {
      return {
        type: 'summarize_dossier',
        targetField: this.pickNextField(effectiveMissing, session.messages),
      };
    }

    if (intent === 'question') {
      return {
        type: 'answer_and_redirect',
        targetField: this.pickNextField(effectiveMissing, session.messages),
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

    // ── Continuous mode: onboarding is over, Jerry accompanies ──
    if (alreadyRepresentable) {
      return {
        type: 'continuous',
        confirmedData:
          extractedData && Object.keys(extractedData).length > 0
            ? extractedData
            : undefined,
        // Orientation hint (conversational, never a form field)
        targetField: this.pickNextField(effectiveMissing, session.messages),
      };
    }

    // ── Onboarding mode ──
    if (extractedData && Object.keys(extractedData).length > 0) {
      const nextField = this.pickNextField(effectiveMissing, session.messages);

      // Check if we just crossed a section boundary
      const transition = this.detectSectionTransition(nextField);
      if (transition) {
        return {
          type: 'section_transition',
          targetField: nextField,
          confirmedData: extractedData,
        };
      }

      return {
        type: 'confirm_and_probe',
        targetField: nextField,
        confirmedData: extractedData,
      };
    }

    return {
      type: 'strategic_ask',
      targetField: this.pickNextField(missingFields, session.messages),
    };
  }

  private detectSectionTransition(nextField: string | undefined): boolean {
    if (!nextField) return false;
    return SECTION_FIRST_FIELDS.has(nextField);
  }

  private detectFrustration(messages: JerryMessage[]): boolean {
    const recentMessages = messages.slice(-FRUSTRATION_WINDOW);
    return recentMessages.some(
      (msg) =>
        msg.role === 'user' &&
        FRUSTRATION_KEYWORDS.some((kw) =>
          (msg.content ?? '').toLowerCase().includes(kw),
        ),
    );
  }

  private isSummaryRequest(messages: JerryMessage[]): boolean {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const content = lastUser?.content.toLowerCase() ?? '';
    return [
      'summary',
      'summarize',
      'recap',
      'what do you know',
      'what you know',
      'resumen',
      'resumir',
      'qué sabes',
      'que sabes',
    ].some((phrase) => content.includes(phrase));
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

  // Maps extracted dossier data to the field labels it satisfies,
  // mirroring ValidatorService.calculateMissingFields
  private fieldsCoveredByExtraction(data: Partial<DossierData>): Set<string> {
    const covered = new Set<string>();

    if (data.identity?.sport) covered.add('sport');
    if (data.identity?.position) covered.add('position');
    if (data.identity?.graduationYear) covered.add('graduation year');
    if (data.identity?.location) covered.add('location');
    if (data.identity?.school) covered.add('school');
    if (data.identity?.competitiveLevel) covered.add('competitive level');
    if (data.performance?.physicalProfile?.height)
      covered.add('physical profile');
    if (data.performance?.physicalProfile?.dominantSide)
      covered.add('dominant side');
    if (data.performance?.stats) covered.add('stats');
    if (data.performance?.leagueLevel) covered.add('league level');
    if (data.performance?.strengths?.length) covered.add('strengths');
    if (data.performance?.physicalStatus) covered.add('physical status');
    if (data.availability?.competitiveLevelGoal)
      covered.add('competitive level goal');
    if (data.availability?.goals?.length) covered.add('goals');
    if (data.availability?.timeline) covered.add('timeline');
    if (data.availability?.preferredRegions?.length)
      covered.add('preferred regions');
    if (data.availability?.relocationOpenness)
      covered.add('relocation openness');
    if (data.academic?.gpa) covered.add('GPA');
    if (data.academic?.intendedMajor) covered.add('intended major');
    if (data.availability?.nonNegotiables?.length)
      covered.add('non-negotiables');
    if (data.media?.highlightUrls?.length) covered.add('highlights');
    if (data.media?.clipUrls?.length) covered.add('clips');
    if (data.media?.socialMedia) covered.add('social media');
    if (data.media?.references?.length) covered.add('references');
    if (data.character?.selfRepresentation) covered.add('self-representation');
    if (data.character?.growthAreas?.length) covered.add('growth areas');
    if (data.character?.mentality) covered.add('mentality');
    if (data.character?.motivation) covered.add('motivation');

    return covered;
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
