import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DossierData } from '../../shared/types';

@Injectable()
export class ValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async getMissingFields(athleteId: string): Promise<string[]> {
    const dossier = await this.prisma.dossier.findUnique({
      where: { athleteId },
    });

    if (!dossier) {
      return this.getAllRequiredFields();
    }

    const data = dossier.data as DossierData;
    return this.calculateMissingFields(data);
  }

  async getCompleteness(athleteId: string): Promise<number> {
    const missing = await this.getMissingFields(athleteId);
    const total = this.getAllRequiredFields().length;
    return (total - missing.length) / total;
  }

  private calculateMissingFields(data: DossierData): string[] {
    const missing: string[] = [];

    // Section 2: Athlete Identity (Q1-7)
    if (!data.identity?.sport) missing.push('sport');
    if (!data.identity?.position) missing.push('position');
    if (!data.identity?.graduationYear) missing.push('graduation year');
    if (!data.identity?.location) missing.push('location');
    if (!data.identity?.school) missing.push('school');
    if (!data.identity?.competitiveLevel) missing.push('competitive level');
    // Section 3: Athletic Snapshot (Q8-12)
    if (!data.performance?.physicalProfile?.height)
      missing.push('physical profile');
    if (!data.performance?.physicalProfile?.dominantSide)
      missing.push('dominant side');
    if (!data.performance?.stats) missing.push('stats');
    if (!data.performance?.leagueLevel) missing.push('league level');
    if (!data.performance?.strengths?.length) missing.push('strengths');
    if (!data.performance?.physicalStatus) missing.push('physical status');
    // Section 4: Recruiting Direction (Q13-19)
    if (!data.availability?.competitiveLevelGoal)
      missing.push('competitive level goal');
    if (!data.availability?.goals?.length) missing.push('goals');
    if (!data.availability?.timeline) missing.push('timeline');
    if (!data.availability?.preferredRegions?.length)
      missing.push('preferred regions');
    if (!data.availability?.relocationOpenness)
      missing.push('relocation openness');
    if (!data.academic?.gpa) missing.push('GPA');
    if (!data.academic?.intendedMajor) missing.push('intended major');
    if (!data.availability?.nonNegotiables?.length)
      missing.push('non-negotiables');
    // Section 5: Visibility & Assets (Q20-24)
    if (!data.media?.highlightUrls?.length) missing.push('highlights');
    if (!data.media?.clipUrls?.length) missing.push('clips');
    if (!data.media?.socialMedia) missing.push('social media');
    if (!data.media?.references?.length) missing.push('references');
    if (!data.character?.selfRepresentation)
      missing.push('self-representation');
    // Section 6: Competitive Identity (Q25-27)
    if (!data.character?.growthAreas?.length) missing.push('growth areas');
    if (!data.character?.mentality) missing.push('mentality');
    if (!data.character?.motivation) missing.push('motivation');

    return missing;
  }

  private getAllRequiredFields(): string[] {
    return [
      // Section 2: Athlete Identity
      'sport',
      'position',
      'graduation year',
      'location',
      'school',
      'competitive level',
      // Section 3: Athletic Snapshot
      'physical profile',
      'dominant side',
      'stats',
      'league level',
      'strengths',
      'physical status',
      // Section 4: Recruiting Direction
      'competitive level goal',
      'goals',
      'timeline',
      'preferred regions',
      'relocation openness',
      'GPA',
      'intended major',
      'non-negotiables',
      // Section 5: Visibility & Assets
      'highlights',
      'clips',
      'social media',
      'references',
      'self-representation',
      // Section 6: Competitive Identity
      'growth areas',
      'mentality',
      'motivation',
    ];
  }
}
