import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { DossierData } from '../../shared/types';

export interface DossierField {
  key: string;
  label: string;
  value: string | number | null;
  source: 'user' | 'jerry';
}

export interface DossierSection {
  id: string;
  title: string;
  icon: string;
  completedFields: number;
  totalFields: number;
  fields: DossierField[];
}

@Injectable()
export class DossierService {
  constructor(private readonly prisma: PrismaService) {}

  async getSections(athleteId: string): Promise<DossierSection[]> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { dossier: true },
    });

    if (!athlete) {
      throw new NotFoundException(`Athlete ${athleteId} not found`);
    }

    const data = (athlete.dossier?.data as DossierData) || {};
    return this.buildSections(athlete.name, data);
  }

  private buildSections(name: string, data: DossierData): DossierSection[] {
    const identity = data.identity || {};
    const performance = data.performance || {};
    const academic = data.academic || {};
    const availability = data.availability || {};

    const sections: DossierSection[] = [
      {
        id: 'identity',
        title: 'Identity',
        icon: 'User',
        ...this.buildFieldList([
          { key: 'name', label: 'Full name', value: name, source: 'user' },
          { key: 'sport', label: 'Sport', value: identity.sport ?? null, source: 'jerry' },
          { key: 'position', label: 'Position', value: identity.position ?? null, source: 'jerry' },
          { key: 'graduationYear', label: 'Graduation year', value: identity.graduationYear ?? null, source: 'user' },
        ]),
      },
      {
        id: 'performance',
        title: 'Performance',
        icon: 'BarChart2',
        ...this.buildFieldList([
          { key: 'leagueLevel', label: 'League level', value: performance.leagueLevel ?? null, source: 'user' },
          ...this.statsToFields(performance.stats),
          { key: 'highlights', label: 'Highlight reel URL', value: performance.highlightUrls?.[0] ?? null, source: 'user' },
        ]),
      },
      {
        id: 'academic',
        title: 'Academic',
        icon: 'GraduationCap',
        ...this.buildFieldList([
          { key: 'gpa', label: 'GPA', value: academic.gpa ?? null, source: 'user' },
          { key: 'sat', label: 'SAT Score', value: academic.satAct ?? null, source: 'user' },
          { key: 'intendedMajor', label: 'Intended major', value: academic.intendedMajor ?? null, source: 'user' },
        ]),
      },
      {
        id: 'availability',
        title: 'Availability',
        icon: 'Calendar',
        ...this.buildFieldList([
          {
            key: 'transferPortal',
            label: 'Transfer portal',
            value: availability.transferPortal !== undefined
              ? (availability.transferPortal ? 'Yes' : 'No')
              : null,
            source: 'user',
          },
          {
            key: 'preferredRegions',
            label: 'Preferred regions',
            value: availability.preferredRegions?.join(', ') ?? null,
            source: 'jerry',
          },
          { key: 'gradYear', label: 'Graduation year', value: identity.graduationYear ?? null, source: 'user' },
        ]),
      },
    ];

    return sections;
  }

  private statsToFields(stats: Record<string, number> | undefined): DossierField[] {
    if (!stats) return [];
    return Object.entries(stats).map(([key, value]) => ({
      key,
      label: this.camelToLabel(key),
      value,
      source: 'jerry' as const,
    }));
  }

  private camelToLabel(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
  }

  private buildFieldList(fields: DossierField[]): {
    fields: DossierField[];
    completedFields: number;
    totalFields: number;
  } {
    return {
      fields,
      completedFields: fields.filter((f) => f.value !== null && f.value !== '').length,
      totalFields: fields.length,
    };
  }
}
