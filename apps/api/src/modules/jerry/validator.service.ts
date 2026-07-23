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

    // FS-CS-005A Section 2: Athlete Identity
    if (!data.identity?.sport) missing.push('sport');
    if (!data.identity?.position) missing.push('position');
    if (!data.identity?.graduationYear) missing.push('graduation year');
    if (!data.identity?.location) missing.push('location');

    // FS-CS-005A Section 3: Athletic Foundation
    if (!data.identity?.school) missing.push('school');
    if (!data.identity?.competitiveLevel) missing.push('competitive level');
    if (!data.performance?.physicalProfile?.height)
      missing.push('physical profile');
    if (!data.performance?.physicalProfile?.dominantSide)
      missing.push('dominant side');
    if (!data.performance?.stats) missing.push('stats');
    if (!data.performance?.leagueLevel) missing.push('league level');

    // Existing dossier fields that strengthen representation over time.
    if (!data.performance?.strengths?.length) missing.push('strengths');
    if (!data.performance?.physicalStatus) missing.push('physical status');

    // FS-CS-005A Section 4: Recruiting Direction
    if (!data.availability?.competitiveLevelGoal)
      missing.push('competitive level goal');
    if (!data.availability?.goals?.length) missing.push('goals');
    if (!data.availability?.preferredRegions?.length)
      missing.push('preferred regions');
    if (!data.availability?.relocationOpenness)
      missing.push('relocation openness');

    // FS-CS-005A Section 5: Academic & Personal Direction
    if (!data.academic?.gpa) missing.push('GPA');
    if (!data.academic?.intendedMajor) missing.push('intended major');
    if (!data.availability?.nonNegotiables?.length)
      missing.push('non-negotiables');

    // Timeline still helps prioritize representation, but is not a barrier.
    if (!data.availability?.timeline) missing.push('timeline');

    // FS-CS-005A Section 6: Owner's Manual Initialization
    if (!data.character?.selfRepresentation)
      missing.push('self-representation');
    if (!data.character?.growthAreas?.length) missing.push('growth areas');
    if (!data.character?.mentality) missing.push('mentality');
    if (!data.character?.motivation) missing.push('motivation');

    // FS-CS-005A Section 7: Representation Assets
    if (!data.media?.highlightUrls?.length) missing.push('highlights');
    if (!data.media?.clipUrls?.length) missing.push('clips');
    if (!data.media?.references?.length) missing.push('references');
    if (!data.media?.socialMedia) missing.push('social media');

    return missing;
  }

  private getAllRequiredFields(): string[] {
    return [
      // FS-CS-005A Section 2: Athlete Identity
      'sport',
      'position',
      'graduation year',
      'location',
      // FS-CS-005A Section 3: Athletic Foundation
      'school',
      'competitive level',
      'physical profile',
      'dominant side',
      'stats',
      'league level',
      // Existing representation-strengthening fields
      'strengths',
      'physical status',
      // FS-CS-005A Section 4: Recruiting Direction
      'competitive level goal',
      'goals',
      'preferred regions',
      'relocation openness',
      // FS-CS-005A Section 5: Academic & Personal Direction
      'GPA',
      'intended major',
      'non-negotiables',
      'timeline',
      // FS-CS-005A Section 6: Owner's Manual Initialization
      'self-representation',
      'growth areas',
      'mentality',
      'motivation',
      // FS-CS-005A Section 7: Representation Assets
      'highlights',
      'clips',
      'references',
      'social media',
    ];
  }
}
