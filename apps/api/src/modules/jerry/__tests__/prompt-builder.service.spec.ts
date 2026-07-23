import { PromptBuilderService } from '../prompt-builder.service';
import { ConversationStrategy } from '../../../shared/types';

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService();

  // The prompt always includes the Jerry header and fixed rules
  const JERRY_HEADER = 'You are Jerry';
  const RULES_MARKER = 'Ask only ONE question';

  describe('base prompt structure', () => {
    it('always includes Jerry identity and rules', () => {
      const result = service.build({ type: 'welcome' });
      expect(result).toContain(JERRY_HEADER);
      expect(result).toContain(RULES_MARKER);
    });

    it('does not frame Activation around recruiter-first jargon', () => {
      const result = service.build({ type: 'confirm_and_probe' });
      expect(result).not.toContain('Use representation language: "visibility"');
      expect(result).not.toContain('athletic narrative');
      expect(result).not.toContain('why recruiters need');
    });

    // FS-CS-002 Jerry Operating Brain (brains/FS-CS-002-jerry-operating-brain.md)
    it('declares loyalty to the athlete only, with the core decision rule', () => {
      const result = service.build({ type: 'welcome' });
      expect(result).toContain(
        'You represent the athlete — not the platform, not recruiters, not First Stringers',
      );
      expect(result).toContain('does this truly benefit the athlete?');
      expect(result).toContain('You advise; the athlete decides');
      expect(result).toContain('do not replace coaches, parents, or mentors');
    });

    it('includes the non-negotiable ethical standards', () => {
      const result = service.build({ type: 'continuous' });
      expect(result).toContain('Never pressure the athlete');
      expect(result).toContain('Never invent information');
      expect(result).toContain(
        'Never share or promise to share private information',
      );
      expect(result).toContain('never use sales language, hype');
    });

    it("includes the Owner's Manual understanding when provided", () => {
      const result = service.build(
        { type: 'continuous' },
        {
          motivations: ['be the first in my family to play D1'],
          communicationStyle: 'short, direct answers',
          preferredEnvironments: ['structured coaching'],
        },
      );
      expect(result).toContain('Your understanding of this athlete so far');
      expect(result).toContain('be the first in my family to play D1');
      expect(result).toContain('short, direct answers');
      expect(result).toContain('structured coaching');
      expect(result).toContain('never mention you keep this');
    });

    it('omits the understanding section when the manual is empty or absent', () => {
      expect(service.build({ type: 'continuous' })).not.toContain(
        'Your understanding of this athlete',
      );
      expect(service.build({ type: 'continuous' }, {})).not.toContain(
        'Your understanding of this athlete',
      );
    });

    // FS-CS-003 Communication Standards
    it('instructs honest uncertainty and invisible architecture', () => {
      const result = service.build({ type: 'strategic_ask' });
      expect(result).toContain(
        'never replace uncertainty with false confidence',
      );
      expect(result).toContain('Reason internally, communicate naturally');
      expect(result).toContain('answer openly and in plain language');
    });
  });

  describe('strategy: welcome', () => {
    it('includes the v2 introduction script and Jerry identity', () => {
      const result = service.build({ type: 'welcome' });
      expect(result).toContain('Introduce yourself');
      expect(result).toContain('Your AI agent inside First Stringers');
      expect(result).toContain('personal recruiting representative');
      expect(result).toContain('sport');
    });

    it('opens with the first pending question when targetField is present', () => {
      const result = service.build({
        type: 'welcome',
        targetField: 'graduation year',
      });
      expect(result).toContain('What year do you graduate?');
      expect(result).toContain('never ask for it again');
    });
  });

  describe('strategy: confirm_and_probe', () => {
    it('mentions the confirmed field when targetField is present', () => {
      const strategy: ConversationStrategy = {
        type: 'confirm_and_probe',
        targetField: 'GPA',
      };
      const result = service.build(strategy);
      expect(result).toContain('"GPA"');
      expect(result).toContain('Acknowledge what they said');
    });

    it('anchors extra athlete information back to the next Dossier question', () => {
      const result = service.build({
        type: 'confirm_and_probe',
        targetField: 'timeline',
      });
      expect(result).toContain('return to the Athlete Dossier');
      expect(result).toContain('must end by asking');
      expect(result).toContain(
        "What's your ideal recruiting timeline right now?",
      );
    });

    it('uses generic instruction when there is no targetField', () => {
      const strategy: ConversationStrategy = { type: 'confirm_and_probe' };
      const result = service.build(strategy);
      expect(result).toContain('Confirm the information received');
      expect(result).not.toContain('undefined');
    });
  });

  describe('strategy: answer_and_redirect', () => {
    it('mentions the pending field when targetField is present', () => {
      const strategy: ConversationStrategy = {
        type: 'answer_and_redirect',
        targetField: 'position',
      };
      const result = service.build(strategy);
      expect(result).toContain('"position"');
      expect(result).toContain("Answer the athlete's question concisely");
    });

    it('formats summary requests by Dossier section and forbids inference', () => {
      const result = service.build({
        type: 'summarize_dossier' as never,
        targetField: 'physical profile',
      });
      expect(result).toContain('Identity');
      expect(result).toContain('Athletic Profile');
      expect(result).toContain('Leadership & Character');
      expect(result).toContain('Pending Information');
      expect(result).toContain('Never infer');
      expect(result).toContain('only facts the athlete explicitly shared');
      expect(result).toContain("What's your current height and weight?");
    });

    it('uses generic instruction when there is no targetField', () => {
      const strategy: ConversationStrategy = { type: 'answer_and_redirect' };
      const result = service.build(strategy);
      expect(result).toContain('redirect toward the dossier');
      expect(result).not.toContain('undefined');
    });
  });

  describe('strategy: clarify', () => {
    it('instructs to ask for friendly clarification', () => {
      const result = service.build({ type: 'clarify' });
      expect(result).toContain('clarification');
      expect(result).toContain('friendly');
    });
  });

  describe('strategy: strategic_ask', () => {
    it('mentions the specific field when targetField is present', () => {
      const strategy: ConversationStrategy = {
        type: 'strategic_ask',
        targetField: 'sport',
      };
      const result = service.build(strategy);
      expect(result).toContain('"sport"');
      expect(result).toContain('foundation');
    });

    it('uses generic instruction when there is no targetField', () => {
      const strategy: ConversationStrategy = { type: 'strategic_ask' };
      const result = service.build(strategy);
      expect(result).toContain('next pending field in the dossier');
      expect(result).not.toContain('undefined');
    });
  });

  describe('strategy: continuous', () => {
    it('instructs Jerry to be a proactive companion, never a form', () => {
      const result = service.build({ type: 'continuous' });
      expect(result).toContain('ONGOING RELATIONSHIP');
      expect(result).toContain('NEVER as a field to fill');
      expect(result).toContain('never "done"');
    });

    it('includes the orientation hint when targetField is present', () => {
      const result = service.build({
        type: 'continuous',
        targetField: 'highlights',
      });
      expect(result).toContain('"highlights"');
    });
  });

  describe('strategy: section_transition', () => {
    it('includes summary and transition instruction with targetField', () => {
      const strategy: ConversationStrategy = {
        type: 'section_transition',
        targetField: 'physical profile',
      };
      const result = service.build(strategy);
      expect(result).toContain('summarize');
      expect(result).toContain('transition');
    });

    it('uses generic instruction when there is no targetField', () => {
      const strategy: ConversationStrategy = { type: 'section_transition' };
      const result = service.build(strategy);
      expect(result).toContain('Summarize');
      expect(result).not.toContain('undefined');
    });
  });

  describe('strategy: activation', () => {
    it('marks the representable threshold and the start of the continuous relationship', () => {
      const result = service.build({ type: 'activation' });
      expect(result).toContain('REPRESENTABLE threshold');
      expect(result).toContain('begin representing you inside First Stringers');
      expect(result).toContain("We're just getting started");
      expect(result).toContain('check-in question');
    });
  });

  describe('strategy: reset', () => {
    it('instructs to resume the conversation from the relevant point', () => {
      const result = service.build({ type: 'reset' });
      expect(result).toContain('Resume the conversation');
    });
  });
});
