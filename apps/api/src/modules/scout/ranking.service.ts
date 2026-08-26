import { Injectable } from '@nestjs/common';
import {
  ScoutAthleteCandidate,
  RankedAthlete,
  FitExplanation,
  SearchFilters,
  CriteriaField,
  CriteriaPriority,
  CriterionDeviation,
  resolveCriteriaPriority,
} from '../../shared/types/scout.types';

export type { RankedAthlete, FitExplanation };

// How much a criterion's match/miss moves the blended filter score, by
// priority tier. sport/position/leagueLevel/ncaaEligible/transferPortal are
// hard-excluded upstream by ScoutService when 'required' — binary states
// where "almost" isn't meaningful. minGpa and graduationYear are graduated
// criteria that ScoutService never excludes on, so an athlete who misses one
// can still reach here; the weight below is what lets a strong-elsewhere
// athlete still rank well despite the miss, which computeDeviations then
// records so Billy can explain it instead of silently substituting them in.
const PRIORITY_WEIGHT: Record<CriteriaPriority, number> = {
  required: 3,
  important: 2,
  preference: 1,
  flexible: 0.5,
};

const PRIORITY_LABEL: Record<CriteriaPriority, string> = {
  required: 'required',
  important: 'high priority',
  preference: 'preference',
  flexible: 'flexible',
};

@Injectable()
export class RankingService {
  private readonly WEIGHTS = {
    similarity: 0.5,
    completeness: 0.2,
    trajectory: 0.15,
    filters: 0.15,
  };

  computeFitScore(
    similarity: number,
    completenessScore: number,
    trajectory: string,
    filterMatchScore: number,
  ): number {
    const trajectoryScore = this.trajectoryToScore(trajectory);

    const fitScore =
      similarity * this.WEIGHTS.similarity +
      completenessScore * this.WEIGHTS.completeness +
      trajectoryScore * this.WEIGHTS.trajectory +
      filterMatchScore * this.WEIGHTS.filters;

    return Math.round(Math.min(fitScore, 1.0) * 1000) / 1000;
  }

  generateExplanation(
    athlete: ScoutAthleteCandidate,
    similarity: number,
    query: string,
    filters: SearchFilters,
  ): FitExplanation {
    const trajectoryScore = this.trajectoryToScore(athlete.trajectory);
    const topFactors: string[] = [];
    const queryLower = query.toLowerCase();

    // GPA
    if (athlete.gpa) {
      if (filters.minGpa && athlete.gpa >= filters.minGpa) {
        topFactors.push(`GPA ${athlete.gpa} meets requirement ✓`);
      } else {
        topFactors.push(`GPA ${athlete.gpa}`);
      }
    }

    // NCAA
    if (athlete.ncaaEligible) {
      topFactors.push('NCAA eligibility confirmed ✓');
    }

    // Transfer portal
    if (
      athlete.inTransferPortal &&
      (filters.transferPortal || queryLower.includes('transfer'))
    ) {
      topFactors.push('In transfer portal ✓');
    }

    // Regions
    athlete.preferredRegions?.forEach((region: string) => {
      if (
        queryLower.includes(region.toLowerCase()) ||
        filters.region === region
      ) {
        topFactors.push(`Region: ${region} ✓`);
      }
    });

    // Trajectory
    if (athlete.trajectory === 'IMPROVING') {
      topFactors.push('Improving trajectory ✓');
    }

    // Position
    if (
      athlete.position &&
      (queryLower.includes(athlete.position.toLowerCase()) ||
        filters.position?.toLowerCase() === athlete.position.toLowerCase())
    ) {
      topFactors.push(`Position: ${athlete.position} ✓`);
    }

    // League level
    if (filters.leagueLevel && athlete.leagueLevel === filters.leagueLevel) {
      topFactors.push(`${athlete.leagueLevel} level ✓`);
    }

    return {
      similarity: Math.round(similarity * 1000) / 1000,
      completeness: Math.round(athlete.completenessScore * 1000) / 1000,
      trajectory: Math.round(trajectoryScore * 1000) / 1000,
      topMatchingFactors: topFactors.slice(0, 5),
    };
  }

  rankAthletes(
    athletes: ScoutAthleteCandidate[],
    query: string,
    filters: SearchFilters,
  ): RankedAthlete[] {
    return athletes
      .map((a) => {
        const similarity = a.similarity ?? 0.5;
        const filterScore = this.calcFilterMatchScore(a, filters);

        return {
          ...a,
          fitScore: this.computeFitScore(
            similarity,
            a.completenessScore ?? 0,
            a.trajectory,
            filterScore,
          ),
          fitExplanation: this.generateExplanation(
            a,
            similarity,
            query,
            filters,
          ),
          matchReasons: this.buildMatchReasons(a, filters),
          deviations: this.computeDeviations(a, filters),
        };
      })
      .sort((a, b) => b.fitScore - a.fitScore);
  }

  // The counterpart to buildMatchReasons: every stated criterion this athlete
  // does NOT satisfy, described in plain language built only from real
  // filter/athlete values. Billy searches for fit, not just match (FS-CS-001)
  // — a strong-elsewhere athlete who misses a criterion still belongs in the
  // results, but the recruiter must always be told why.
  private computeDeviations(
    athlete: ScoutAthleteCandidate,
    filters: SearchFilters,
  ): CriterionDeviation[] {
    const deviations: CriterionDeviation[] = [];
    const add = (field: CriteriaField, note: string) =>
      deviations.push({
        field,
        priority: resolveCriteriaPriority(filters, field),
        note,
      });

    if (filters.graduationYear && athlete.graduationYear) {
      const diff = athlete.graduationYear - filters.graduationYear;
      if (diff !== 0) {
        const years = Math.abs(diff);
        const direction = diff > 0 ? 'behind' : 'ahead of';
        add(
          'graduationYear',
          `Class of ${athlete.graduationYear}, ${years} year${years > 1 ? 's' : ''} ${direction} the ${filters.graduationYear} class you're targeting`,
        );
      }
    } else if (filters.graduationYear && !athlete.graduationYear) {
      add(
        'graduationYear',
        `Graduation year not on file (you're targeting class of ${filters.graduationYear})`,
      );
    }

    if (filters.minGpa) {
      if (athlete.gpa && athlete.gpa < filters.minGpa) {
        add(
          'minGpa',
          `GPA ${athlete.gpa}, below the ${filters.minGpa} you're looking for`,
        );
      } else if (!athlete.gpa) {
        add('minGpa', `GPA not on file (looking for ${filters.minGpa}+)`);
      }
    }

    if (
      filters.leagueLevel &&
      athlete.leagueLevel &&
      athlete.leagueLevel !== filters.leagueLevel
    ) {
      add(
        'leagueLevel',
        `Plays at the ${athlete.leagueLevel} level, not ${filters.leagueLevel}`,
      );
    }

    if (
      filters.region &&
      athlete.preferredRegions?.length &&
      !athlete.preferredRegions.includes(filters.region)
    ) {
      add(
        'region',
        `Prefers ${athlete.preferredRegions.join('/')}, not ${filters.region}`,
      );
    }

    if (filters.transferPortal && !athlete.inTransferPortal) {
      add('transferPortal', 'Not currently in the transfer portal');
    }

    if (filters.ncaaEligible && !athlete.ncaaEligible) {
      add('ncaaEligible', 'NCAA eligibility not yet confirmed');
    }

    return deviations;
  }

  private calcFilterMatchScore(
    athlete: ScoutAthleteCandidate,
    filters: SearchFilters,
  ): number {
    let matchedWeight = 0;
    let totalWeight = 0;

    const score = (
      field: CriteriaField,
      isPresent: boolean,
      isMatch: boolean,
    ) => {
      if (!isPresent) return;
      const weight = PRIORITY_WEIGHT[resolveCriteriaPriority(filters, field)];
      totalWeight += weight;
      if (isMatch) matchedWeight += weight;
    };

    score('sport', !!filters.sport, athlete.sport === filters.sport);
    score(
      'position',
      !!filters.position,
      athlete.position?.toLowerCase() === filters.position?.toLowerCase(),
    );
    score(
      'leagueLevel',
      !!filters.leagueLevel,
      athlete.leagueLevel === filters.leagueLevel,
    );
    score(
      'minGpa',
      !!filters.minGpa,
      !!athlete.gpa && athlete.gpa >= filters.minGpa!,
    );
    score('transferPortal', !!filters.transferPortal, athlete.inTransferPortal);
    score('ncaaEligible', !!filters.ncaaEligible, athlete.ncaaEligible);
    score(
      'region',
      !!filters.region,
      !!athlete.preferredRegions?.includes(filters.region!),
    );
    score(
      'graduationYear',
      !!filters.graduationYear,
      athlete.graduationYear === filters.graduationYear,
    );

    return totalWeight > 0 ? matchedWeight / totalWeight : 0.5;
  }

  private buildMatchReasons(
    athlete: ScoutAthleteCandidate,
    filters: SearchFilters,
  ): string[] {
    const reasons: string[] = [];
    const tag = (field: CriteriaField) =>
      `(${PRIORITY_LABEL[resolveCriteriaPriority(filters, field)]})`;

    if (filters.sport && athlete.sport === filters.sport)
      reasons.push(`Plays ${athlete.sport} ✓ ${tag('sport')}`);
    if (
      filters.position &&
      athlete.position?.toLowerCase() === filters.position?.toLowerCase()
    )
      reasons.push(`Position ${athlete.position} ✓ ${tag('position')}`);
    if (
      filters.graduationYear &&
      athlete.graduationYear === filters.graduationYear
    )
      reasons.push(
        `Class of ${athlete.graduationYear} ✓ ${tag('graduationYear')}`,
      );
    if (filters.minGpa && athlete.gpa && athlete.gpa >= filters.minGpa)
      reasons.push(`GPA ${athlete.gpa} meets requirement ✓ ${tag('minGpa')}`);
    if (filters.transferPortal && athlete.inTransferPortal)
      reasons.push(`In transfer portal ✓ ${tag('transferPortal')}`);
    if (filters.ncaaEligible && athlete.ncaaEligible)
      reasons.push(`NCAA eligible ✓ ${tag('ncaaEligible')}`);
    if (filters.region && athlete.preferredRegions?.includes(filters.region))
      reasons.push(`Region: ${filters.region} ✓ ${tag('region')}`);
    if (athlete.trajectory === 'IMPROVING')
      reasons.push('Improving trajectory ✓');
    return reasons;
  }

  private trajectoryToScore(trajectory: string): number {
    switch (trajectory?.toUpperCase()) {
      case 'IMPROVING':
        return 1.0;
      case 'STABLE':
        return 0.7;
      case 'DECLINING':
        return 0.3;
      default:
        return 0.5;
    }
  }
}
