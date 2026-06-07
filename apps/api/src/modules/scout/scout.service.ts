import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { DossierData } from '../../shared/types';

export interface ScoutAthleteResponse {
  id: string;
  email: string;
  name: string;
  role: 'athlete';
  sport: string;
  position: string;
  graduationYear: number;
  gpa?: number;
  region?: string;
  dossier: {
    completeness: number;
    data: DossierData;
    narrative: string;
  };
}

export interface MatchResult {
  athlete: ScoutAthleteResponse;
  fitScore: number;
  breakdown: { category: string; score: number }[];
  aiSummary: string;
  isNew: boolean;
}

@Injectable()
export class ScoutService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatches(limit = 20, offset = 0): Promise<MatchResult[]> {
    const athletes = await this.prisma.athlete.findMany({
      where: {
        dossier: { completeness: { gt: 0 } },
      },
      include: { dossier: true },
      orderBy: { dossier: { completeness: 'desc' } },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return athletes.map((a) => this.toMatchResult(a));
  }

  async search(query: string, limit = 20, offset = 0): Promise<MatchResult[]> {
    const q = query.toLowerCase();

    const athletes = await this.prisma.athlete.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sport: { contains: q, mode: 'insensitive' } },
          { position: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { dossier: true },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return athletes.map((a) => this.toMatchResult(a));
  }

  private toMatchResult(athlete: {
    id: string;
    email: string;
    name: string;
    sport: string | null;
    position: string | null;
    createdAt: Date;
    dossier: {
      data: unknown;
      completeness: number;
      narrative: string | null;
    } | null;
  }): MatchResult {
    const data = (athlete.dossier?.data as DossierData) || {};
    const completeness = athlete.dossier?.completeness ?? 0;

    const athleticScore = this.scoreAthletics(data);
    const academicScore = this.scoreAcademics(data);
    const regionScore = data.availability?.preferredRegions?.length ? 70 : 40;
    const positionScore = athlete.position ? 75 : 40;

    const fitScore = Math.round(
      athleticScore * 0.35 +
        academicScore * 0.25 +
        regionScore * 0.2 +
        positionScore * 0.2,
    );

    // Consider athletes created in the last 7 days as "new"
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return {
      athlete: {
        id: athlete.id,
        email: athlete.email,
        name: athlete.name,
        role: 'athlete',
        sport: athlete.sport || data.identity?.sport || '',
        position: athlete.position || data.identity?.position || '',
        graduationYear: data.identity?.graduationYear || 0,
        gpa: data.academic?.gpa,
        region: data.availability?.preferredRegions?.[0],
        dossier: {
          completeness,
          data,
          narrative: athlete.dossier?.narrative ?? '',
        },
      },
      fitScore,
      breakdown: [
        { category: 'Athletic Stats', score: athleticScore },
        { category: 'Academic', score: academicScore },
        { category: 'Region Fit', score: regionScore },
        { category: 'Position Need', score: positionScore },
      ],
      aiSummary:
        athlete.dossier?.narrative ??
        'Dossier in progress — not enough data for AI summary.',
      isNew: athlete.createdAt > sevenDaysAgo,
    };
  }

  private scoreAthletics(data: DossierData): number {
    let score = 40; // base
    if (
      data.performance?.stats &&
      Object.keys(data.performance.stats).length > 0
    )
      score += 30;
    if (data.performance?.leagueLevel) score += 15;
    if (data.performance?.highlightUrls?.length) score += 15;
    return Math.min(score, 100);
  }

  private scoreAcademics(data: DossierData): number {
    let score = 40;
    if (data.academic?.gpa) {
      score += Math.min(Math.round(data.academic.gpa * 10), 30);
    }
    if (data.academic?.intendedMajor) score += 15;
    if (data.academic?.satAct) score += 15;
    return Math.min(score, 100);
  }
}
