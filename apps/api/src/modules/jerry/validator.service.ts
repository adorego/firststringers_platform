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

    if (!data.identity?.sport) missing.push('sport');
    if (!data.identity?.position) missing.push('position');
    if (!data.identity?.graduationYear) missing.push('graduation year');
    if (!data.performance?.stats) missing.push('stats');
    if (!data.performance?.leagueLevel) missing.push('league level');
    if (!data.academic?.gpa) missing.push('GPA');
    if (!data.academic?.intendedMajor) missing.push('intended major');
    if (data.availability?.transferPortal === undefined)
      missing.push('availability');
    if (!data.availability?.preferredRegions) missing.push('preferred regions');

    return missing;
  }

  private getAllRequiredFields(): string[] {
    return [
      'sport',
      'position',
      'graduation year',
      'stats',
      'league level',
      'GPA',
      'intended major',
      'availability',
      'preferred regions',
    ];
  }
}
