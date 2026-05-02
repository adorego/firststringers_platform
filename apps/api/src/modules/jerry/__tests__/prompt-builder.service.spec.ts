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
    it('includes introduction instruction and asks about sport/position', () => {
      const result = service.build({ type: 'welcome' });
      expect(result).toContain('Introduce yourself briefly');
      expect(result).toContain('sport');
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
      expect(result).toContain('Confirm what you understood');
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
      expect(result).toContain('Only that information');
    });

    it('uses generic instruction when there is no targetField', () => {
      const strategy: ConversationStrategy = { type: 'strategic_ask' };
      const result = service.build(strategy);
      expect(result).toContain('next pending field in the dossier');
      expect(result).not.toContain('undefined');
    });
  });

  describe('strategy: narrative_focus', () => {
    it('indicates the dossier is complete and asks to refine the narrative', () => {
      const result = service.build({ type: 'narrative_focus' });
      expect(result).toContain('dossier is complete');
      expect(result).toContain('recruitment narrative');
    });
  });

  describe('strategy: reset', () => {
    it('instructs to resume the conversation from the relevant point', () => {
      const result = service.build({ type: 'reset' });
      expect(result).toContain('Resume the conversation');
    });
  });
});
