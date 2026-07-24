import { RankingService } from '../ranking.service';
import { ScoutAthleteCandidate, SearchFilters } from '../../../shared/types/scout.types';

function makeAthlete(
  overrides: Partial<ScoutAthleteCandidate> = {},
): ScoutAthleteCandidate {
  return {
    id: 'athlete-1',
    fullName: 'Test Athlete',
    name: 'Test Athlete',
    sport: 'football',
    position: 'QB',
    leagueLevel: 'D1',
    gpa: 3.5,
    graduationYear: 2027,
    ncaaEligible: true,
    inTransferPortal: false,
    preferredRegions: [],
    trajectory: 'STABLE',
    keyStrengths: [],
    fitTags: [],
    completenessScore: 0.5,
    similarity: 0.5,
    dossier: null,
    ...overrides,
  };
}

describe('RankingService', () => {
  const service = new RankingService();

  describe('computeFitScore', () => {
    it('weighs similarity, completeness, trajectory, and filter match by their documented weights', () => {
      // similarity*0.5 + completeness*0.2 + trajectory*0.15 + filters*0.15
      const score = service.computeFitScore(1, 1, 'IMPROVING', 1);
      expect(score).toBeCloseTo(1.0, 3);
    });

    it('never exceeds 1.0 even if inputs are inflated', () => {
      const score = service.computeFitScore(2, 2, 'IMPROVING', 2);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('scores an improving trajectory higher than a declining one, all else equal', () => {
      const improving = service.computeFitScore(0.6, 0.6, 'IMPROVING', 0.6);
      const declining = service.computeFitScore(0.6, 0.6, 'DECLINING', 0.6);
      expect(improving).toBeGreaterThan(declining);
    });

    it('falls back to a 0.5 trajectory score (distinct from STABLE) for an unknown value', () => {
      // Isolate the trajectory term by zeroing every other input (weight 0.15).
      const unknown = service.computeFitScore(0, 0, 'WEIRD_VALUE', 0);
      const stable = service.computeFitScore(0, 0, 'STABLE', 0);
      expect(unknown).toBeCloseTo(0.5 * 0.15, 3);
      expect(unknown).not.toBeCloseTo(stable, 3);
    });
  });

  describe('generateExplanation', () => {
    const filters: SearchFilters = { minGpa: 3.0, position: 'QB' };

    it('flags GPA as meeting the requirement when it does', () => {
      const athlete = makeAthlete({ gpa: 3.8 });
      const explanation = service.generateExplanation(athlete, 0.7, 'qb', filters);
      expect(
        explanation.topMatchingFactors.some((f) => f.includes('meets requirement')),
      ).toBe(true);
    });

    it('reports GPA without the requirement flag when there is no minGpa filter', () => {
      const athlete = makeAthlete({ gpa: 2.5 });
      const explanation = service.generateExplanation(athlete, 0.7, 'qb', {});
      expect(explanation.topMatchingFactors).toContain('GPA 2.5');
      expect(
        explanation.topMatchingFactors.some((f) => f.includes('meets requirement')),
      ).toBe(false);
    });

    it('only credits transfer portal status when the search actually cares about it', () => {
      const athlete = makeAthlete({ inTransferPortal: true });
      const withInterest = service.generateExplanation(
        athlete,
        0.7,
        'transfer portal qb',
        {},
      );
      const withoutInterest = service.generateExplanation(
        athlete,
        0.7,
        'qb',
        {},
      );
      expect(
        withInterest.topMatchingFactors.some((f) => f.includes('transfer portal')),
      ).toBe(true);
      expect(
        withoutInterest.topMatchingFactors.some((f) => f.includes('transfer portal')),
      ).toBe(false);
    });

    it('caps topMatchingFactors at 5 entries', () => {
      const athlete = makeAthlete({
        gpa: 3.8,
        ncaaEligible: true,
        inTransferPortal: true,
        preferredRegions: ['Florida'],
        trajectory: 'IMPROVING',
        position: 'QB',
        leagueLevel: 'D1',
      });
      const explanation = service.generateExplanation(
        athlete,
        0.7,
        'qb transfer portal florida',
        { minGpa: 3.0, position: 'QB', leagueLevel: 'D1' },
      );
      expect(explanation.topMatchingFactors.length).toBeLessThanOrEqual(5);
    });
  });

  describe('rankAthletes', () => {
    it('sorts athletes by fitScore, highest first', () => {
      const strong = makeAthlete({ id: 'strong', similarity: 0.9, completenessScore: 0.9 });
      const weak = makeAthlete({ id: 'weak', similarity: 0.1, completenessScore: 0.1 });

      const ranked = service.rankAthletes([weak, strong], 'qb', {});

      expect(ranked[0].id).toBe('strong');
      expect(ranked[1].id).toBe('weak');
      expect(ranked[0].fitScore).toBeGreaterThan(ranked[1].fitScore);
    });

    it('includes a matchReasons entry for every filter the athlete actually satisfies', () => {
      const athlete = makeAthlete({
        sport: 'football',
        position: 'QB',
        gpa: 3.8,
        ncaaEligible: true,
      });

      const [ranked] = service.rankAthletes(
        [athlete],
        'qb',
        { sport: 'football', position: 'QB', minGpa: 3.5, ncaaEligible: true },
      );

      expect(ranked.matchReasons.some((r) => r.includes('football'))).toBe(true);
      expect(ranked.matchReasons.some((r) => r.includes('QB'))).toBe(true);
      expect(ranked.matchReasons.some((r) => r.includes('NCAA eligible'))).toBe(true);
    });

    it('does not credit a filter the athlete fails to satisfy', () => {
      const athlete = makeAthlete({ sport: 'football', gpa: 2.0 });

      const [ranked] = service.rankAthletes(
        [athlete],
        'qb',
        { minGpa: 3.5 },
      );

      expect(ranked.matchReasons.some((r) => r.includes('GPA'))).toBe(false);
    });
  });
});
