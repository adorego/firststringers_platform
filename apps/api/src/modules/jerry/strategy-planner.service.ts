import { Injectable } from '@nestjs/common';
import {
  ConversationStrategy,
  DossierData,
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
      // missingFields comes from the DB BEFORE this turn's extraction is
      // merged — subtract the fields just covered so we don't re-ask them
      const covered = this.fieldsCoveredByExtraction(extractedData);
      const effectiveMissing = missingFields.filter((f) => !covered.has(f));

      if (effectiveMissing.length === 0) {
        return { type: 'activation' };
      }

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
          (msg.content ?? '').toLowerCase().includes(kw),
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
