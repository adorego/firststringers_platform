import { Injectable } from '@nestjs/common';

export interface RankedAthlete {
  id: string;
  fullName: string;
  sport: string;
  position: string;
  leagueLevel: string;
  gpa: number;
  graduationYear: number;
  ncaaEligible: boolean;
  inTransferPortal: boolean;
  preferredRegions: string[];
  trajectory: string;
  keyStrengths: string[];
  fitTags: string[];
  completenessScore: number;
  fitScore: number;
  fitExplanation: FitExplanation;
  dossier?: { summary: string | null; recruiterPitch: string | null } | null;
  matchReasons: string[];
}

export interface FitExplanation {
  similarity: number;
  completeness: number;
  trajectory: number;
  topMatchingFactors: string[];
}

@Injectable()
export class RankingService {
  private readonly WEIGHTS = {
    similarity:   0.50,
    completeness: 0.20,
    trajectory:   0.15,
    filters:      0.15,
  };

  computeFitScore(
    similarity: number,
    completenessScore: number,
    trajectory: string,
    filterMatchScore: number,
  ): number {
    const trajectoryScore = this.trajectoryToScore(trajectory);

    const fitScore =
      similarity   * this.WEIGHTS.similarity   +
      completenessScore * this.WEIGHTS.completeness +
      trajectoryScore  * this.WEIGHTS.trajectory   +
      filterMatchScore * this.WEIGHTS.filters;

    return Math.round(Math.min(fitScore, 1.0) * 1000) / 1000;
  }

  generateExplanation(
    athlete: any,
    similarity: number,
    query: string,
    filters: Record<string, any>,
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
    if (athlete.inTransferPortal && (filters.transferPortal || queryLower.includes('transfer'))) {
      topFactors.push('In transfer portal ✓');
    }

    // Regions
    athlete.preferredRegions?.forEach((region: string) => {
      if (queryLower.includes(region.toLowerCase()) || filters.region === region) {
        topFactors.push(`Region: ${region} ✓`);
      }
    });

    // Trajectory
    if (athlete.trajectory === 'IMPROVING') {
      topFactors.push('Improving trajectory ✓');
    }

    // Position
    if (athlete.position && (
      queryLower.includes(athlete.position.toLowerCase()) ||
      filters.position?.toLowerCase() === athlete.position.toLowerCase()
    )) {
      topFactors.push(`Position: ${athlete.position} ✓`);
    }

    // League level
    if (filters.leagueLevel && athlete.leagueLevel === filters.leagueLevel) {
      topFactors.push(`${athlete.leagueLevel} level ✓`);
    }

    return {
      similarity:   Math.round(similarity * 1000) / 1000,
      completeness: Math.round(athlete.completenessScore * 1000) / 1000,
      trajectory:   Math.round(trajectoryScore * 1000) / 1000,
      topMatchingFactors: topFactors.slice(0, 5),
    };
  }

  rankAthletes(
    athletes: any[],
    query: string,
    filters: Record<string, any>,
  ): RankedAthlete[] {
    return athletes
      .map(a => {
        const similarity     = a.similarity ?? 0.5;
        const filterScore    = this.calcFilterMatchScore(a, filters);

        return {
          ...a,
          fitScore: this.computeFitScore(
            similarity,
            a.completenessScore ?? 0,
            a.trajectory,
            filterScore,
          ),
          fitExplanation: this.generateExplanation(a, similarity, query, filters),
          matchReasons: this.buildMatchReasons(a, filters),
        };
      })
      .sort((a, b) => b.fitScore - a.fitScore);
  }

  private calcFilterMatchScore(athlete: any, filters: Record<string, any>): number {
    let matched = 0;
    let total   = 0;

    if (filters.sport)          { total++; if (athlete.sport === filters.sport) matched++; }
    if (filters.position)       { total++; if (athlete.position?.toLowerCase() === filters.position?.toLowerCase()) matched++; }
    if (filters.leagueLevel)    { total++; if (athlete.leagueLevel === filters.leagueLevel) matched++; }
    if (filters.minGpa)         { total++; if (athlete.gpa && athlete.gpa >= filters.minGpa) matched++; }
    if (filters.transferPortal) { total++; if (athlete.inTransferPortal) matched++; }
    if (filters.ncaaEligible)   { total++; if (athlete.ncaaEligible) matched++; }
    if (filters.region)         { total++; if (athlete.preferredRegions?.includes(filters.region)) matched++; }

    return total > 0 ? matched / total : 0.5;
  }

  private buildMatchReasons(athlete: any, filters: Record<string, any>): string[] {
    const reasons: string[] = [];
    if (filters.sport && athlete.sport === filters.sport)
      reasons.push(`Plays ${athlete.sport} ✓`);
    if (filters.position && athlete.position?.toLowerCase() === filters.position?.toLowerCase())
      reasons.push(`Position ${athlete.position} ✓`);
    if (filters.minGpa && athlete.gpa && athlete.gpa >= filters.minGpa)
      reasons.push(`GPA ${athlete.gpa} meets requirement ✓`);
    if (filters.transferPortal && athlete.inTransferPortal)
      reasons.push('In transfer portal ✓');
    if (filters.ncaaEligible && athlete.ncaaEligible)
      reasons.push('NCAA eligible ✓');
    if (athlete.trajectory === 'IMPROVING')
      reasons.push('Improving trajectory ✓');
    return reasons;
  }

  private trajectoryToScore(trajectory: string): number {
    switch (trajectory?.toUpperCase()) {
      case 'IMPROVING': return 1.0;
      case 'STABLE':    return 0.7;
      case 'DECLINING': return 0.3;
      default:          return 0.5;
    }
  }
}