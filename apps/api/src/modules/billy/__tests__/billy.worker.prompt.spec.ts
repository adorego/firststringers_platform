import {
  ONBOARDING_SYSTEM_PROMPT,
  RECOMMENDATION_NARRATION_SYSTEM_PROMPT,
  SEARCH_SYSTEM_PROMPT,
  ZERO_MATCH_SYSTEM_PROMPT,
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

    it('forbids a second clarifying round-trip once a reasonable search basis already exists', () => {
      // Regression: a coach answered with position, class, a height floor,
      // location, and urgency in one message — five usable signals — and
      // Billy still asked a further GPA question before searching. "at
      // least sport + position + one more" is a floor, not a target list to
      // keep working through once it's already cleared.
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'do not add a second clarifying round-trip once a reasonable basis already exists',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'that is well past enough — search on it rather than reaching further down your list',
      );
    });

    it('never lets GPA be the reason for an extra question when a search is otherwise ready to run', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'This is the lowest-priority item on this whole list',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'offer to search first, and mention GPA afterward',
      );
    });

    it('requires disclosing an unfiltered-criterion shortfall (e.g. height) unprompted, not only when the coach pushes back', () => {
      // Regression: a coach whose floor was "6'2\" or taller" got a 6'1"
      // linebacker recommended with no mention of the gap, and even a direct
      // "why are you recommending him" follow-up didn't surface it — only
      // an explicit "which ones are below 6'2\"?" got the truth. Height
      // isn't a structured filter, so the obligation to disclose deviations
      // has to explicitly extend beyond the structured "deviations" list.
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'This obligation is not limited to criteria the platform can structurally filter on',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'A recruiter should never have to ask twice, or push back, to learn about a gap you already knew about',
      );
    });

    it('treats a confirmed trade-off as a direct instruction to search again, not something to re-confirm', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'that is a direct instruction, not something to confirm back',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'Never repeat a trade-off question the recruiter has already answered',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain('must never become a dead end');
    });

    it("grounds every turn in the conversation's actual current search filters, not just free text history", () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain('current working set');
    });

    it('never lets sport be guessed or drift from what was just discussed', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'Never guess or invent the "sport" filter',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'never let the JSON contradict the positions or sport you were just discussing',
      );
    });

    it('requires omitting the position filter instead of writing a literal "all"/"any" sentinel', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'omit the "position" key from filters entirely',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        "won't match anything in the database",
      );
    });

    it('never fills a declined or unset optional filter with a placeholder value', () => {
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'that field must be left out of the filters JSON entirely',
      );
      expect(SEARCH_SYSTEM_PROMPT).toContain(
        'never write in a placeholder or sentinel value',
      );
      // The [SEARCH_READY] template itself must not demonstrate the bad
      // pattern it's an example of — a coach once got "relax the GPA
      // requirement" offered back after explicitly declining to set one,
      // traced to this template teaching every key as always-present.
      expect(SEARCH_SYSTEM_PROMPT).not.toContain('"minGpa": 0.0');
      expect(SEARCH_SYSTEM_PROMPT).not.toContain('"graduationYear": 0,');
    });
  });

  describe('zero-match trade-off', () => {
    it('requires the two trade-offs to be labeled "Option A" and "Option B" so a one-letter reply resolves unambiguously', () => {
      expect(ZERO_MATCH_SYSTEM_PROMPT).toContain('Option A');
      expect(ZERO_MATCH_SYSTEM_PROMPT).toContain('Option B');
      expect(ZERO_MATCH_SYSTEM_PROMPT).toContain(
        'so the recruiter can reply with just the letter',
      );
    });

    it('restricts every named trade-off to fields actually present in limitingFactors, never a criterion the model merely assumes', () => {
      expect(ZERO_MATCH_SYSTEM_PROMPT).toContain(
        'is the ONLY source of truth for what can be named here',
      );
      expect(ZERO_MATCH_SYSTEM_PROMPT).toContain(
        'Never name or offer to relax GPA, graduation year, or anything else just because it sounds like a typical criterion',
      );
    });
  });

  describe('recommendation narration', () => {
    it('extends the deviation-disclosure obligation past the structured "deviations" list to criteria only present in the free-text query', () => {
      // Regression: a below-6\'2" linebacker was recommended with no mention
      // of the gap, because "deviations" has no field for height at all —
      // the narration model was never told to look past that list.
      expect(RECOMMENDATION_NARRATION_SYSTEM_PROMPT).toContain(
        'has no field for things like a minimum height, weight, or speed threshold',
      );
      expect(RECOMMENDATION_NARRATION_SYSTEM_PROMPT).toContain(
        'you must name that gap too, exactly like a structured deviation',
      );
      expect(RECOMMENDATION_NARRATION_SYSTEM_PROMPT).toContain(
        "Never let the deviations list's structural blind spot become a reason to stay silent",
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
