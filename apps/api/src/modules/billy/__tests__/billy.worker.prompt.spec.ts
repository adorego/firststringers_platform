import {
  ONBOARDING_SYSTEM_PROMPT,
  SEARCH_SYSTEM_PROMPT,
} from '../billy.worker';

describe('BillyWorker prompts', () => {
  describe('search conversation', () => {
    it('anchors Billy as a Director of Recruiting Intelligence, not a basic search assistant', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'Director of Recruiting Intelligence',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'Billy does not exist to search for athletes',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'help recruiters make better decisions',
      );
      expect(SEARCH_SYSTEM_PROMPT).not.toContain(
        'sports recruitment assistant',
      );
    });

    it('requires Billy to clarify recruiting objective before recommendations', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain('recruiting objective');
      expect(SEARCH_SYSTEM_PROMPT).toContain('reduce uncertainty');
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'If the recruiter gives a broad or ambiguous request',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'ask the single highest-value clarifying question',
      );
    });

    it('requires reasoned recommendations with explicit uncertainty', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain('why the athlete fits');
      expect(SEARCH_SYSTEM_PROMPT).toContain('what uncertainty remains');
      expect(SEARCH_SYSTEM_PROMPT).toContain('Never invent information');
      expect(SEARCH_SYSTEM_PROMPT).toContain('Do not rank athletes');
    });

    it('treats "show me more" as a repeat search rather than asking again', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain('show me more');
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'excludes athletes already shown in this conversation',
      );
    });
  });

  describe('onboarding conversation', () => {
    it('frames onboarding as recruiter understanding, not form completion', () => {
      expect(ONBOARDING_SYSTEM_PROMPT).toContain(
        'learn how this recruiter thinks',
      );
      expect(ONBOARDING_SYSTEM_PROMPT).toContain('not to complete a form');
      expect(ONBOARDING_SYSTEM_PROMPT).toContain(
        'understand their recruiting responsibilities',
      );
    });
  });
});
