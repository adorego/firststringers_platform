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
  });

  describe('strategy: welcome', () => {
    it('includes introduction instruction and Jerry identity', () => {
      const result = service.build({ type: 'welcome' });
      expect(result).toContain('Introduce yourself');
      expect(result).toContain('sport');
      expect(result).toContain('representation agent');
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
      expect(result).toContain('enough to start representing you');
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
