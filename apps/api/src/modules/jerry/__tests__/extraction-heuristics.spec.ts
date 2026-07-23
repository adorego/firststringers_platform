import { enhanceJerryExtraction } from '../extraction-heuristics';

describe('Jerry extraction heuristics', () => {
  it('returns an empty object when there is no explicit dossier signal', () => {
    const result = enhanceJerryExtraction('Thanks Jerry, sounds good.', null);

    expect(result).toEqual({});
  });

  it('captures recruiting direction from explicit region and goal language', () => {
    const result = enhanceJerryExtraction(
      'I prefer the Midwest or South. My main goal is to find a D1 or strong D2 program where I can develop and compete.',
      {},
    );

    expect(result.availability?.preferredRegions).toEqual(['Midwest', 'South']);
    expect(result.availability?.competitiveLevelGoal).toBe(
      'D1 or strong D2 program',
    );
    expect(result.availability?.goals).toContain(
      'find a D1 or strong D2 program where I can develop and compete',
    );
  });

  it('captures self-representation, strengths, leadership, and growth areas', () => {
    const result = enhanceJerryExtraction(
      "I'm team captain. What separates me is leadership, pocket presence, and staying composed under pressure. My biggest growth area is reading disguised coverages faster.",
      {},
    );

    expect(result.character?.leadership).toBe('team captain');
    expect(result.character?.selfRepresentation).toBe(
      'leadership, pocket presence, and staying composed under pressure',
    );
    expect(result.character?.growthAreas).toContain(
      'reading disguised coverages faster',
    );
    expect(result.performance?.strengths).toEqual([
      'leadership',
      'pocket presence',
      'staying composed under pressure',
    ]);
  });

  it('merges with LLM output without overwriting stronger existing values', () => {
    const result = enhanceJerryExtraction(
      'I prefer the Midwest or South. What separates me is leadership and pocket presence.',
      {
        availability: {
          preferredRegions: ['West Coast'],
        },
        character: {
          selfRepresentation: 'Existing LLM summary',
        },
        performance: {
          strengths: ['arm talent'],
        },
      },
    );

    expect(result.availability?.preferredRegions).toEqual([
      'West Coast',
      'Midwest',
      'South',
    ]);
    expect(result.character?.selfRepresentation).toBe('Existing LLM summary');
    expect(result.performance?.strengths).toEqual([
      'arm talent',
      'leadership',
      'pocket presence',
    ]);
  });
});
