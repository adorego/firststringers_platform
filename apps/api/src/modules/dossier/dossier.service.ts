import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { DossierData } from '../../shared/types';
import {
  calculateDossierCompleteness,
  normalizeDossierData,
} from './dossier-normalizer';

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

    const data = normalizeDossierData(athlete.dossier?.data);
    return this.buildSections(athlete.name, data);
  }

  async getRaw(
    athleteId: string,
  ): Promise<{ data: DossierData; completeness: number }> {
    const dossier = await this.prisma.dossier.findUnique({
      where: { athleteId },
    });

    const data = normalizeDossierData(dossier?.data);

    return {
      data,
      completeness: calculateDossierCompleteness(data),
    };
  }

  private buildSections(name: string, data: DossierData): DossierSection[] {
    const identity = data.identity || {};
    const performance = data.performance || {};
    const academic = data.academic || {};
    const availability = data.availability || {};
    const media = data.media || {};
    const character = data.character || {};

    const sections: DossierSection[] = [
      {
        id: 'identity',
        title: 'Athlete Identity',
        icon: 'User',
        ...this.buildFieldList([
          { key: 'name', label: 'Full name', value: name, source: 'user' },
          {
            key: 'sport',
            label: 'Sport',
            value: identity.sport ?? null,
            source: 'jerry',
          },
          {
            key: 'position',
            label: 'Position',
            value: identity.position ?? null,
            source: 'jerry',
          },
          {
            key: 'location',
            label: 'Location',
            value: identity.location ?? null,
            source: 'jerry',
          },
          {
            key: 'school',
            label: 'School',
            value: identity.school ?? null,
            source: 'jerry',
          },
          {
            key: 'club',
            label: 'Club / Team',
            value: identity.club ?? null,
            source: 'jerry',
          },
          {
            key: 'competitiveLevel',
            label: 'Competitive level',
            value: identity.competitiveLevel ?? null,
            source: 'jerry',
          },
          {
            key: 'graduationYear',
            label: 'Graduation year',
            value: identity.graduationYear ?? null,
            source: 'jerry',
          },
        ]),
      },
      {
        id: 'performance',
        title: 'Athletic Snapshot',
        icon: 'BarChart2',
        ...this.buildFieldList([
          {
            key: 'height',
            label: 'Height',
            value: performance.physicalProfile?.height ?? null,
            source: 'jerry',
          },
          {
            key: 'weight',
            label: 'Weight',
            value: performance.physicalProfile?.weight ?? null,
            source: 'jerry',
          },
          {
            key: 'dominantSide',
            label: 'Dominant side',
            value: performance.physicalProfile?.dominantSide ?? null,
            source: 'jerry',
          },
          {
            key: 'leagueLevel',
            label: 'League level',
            value: performance.leagueLevel ?? null,
            source: 'jerry',
          },
          ...this.statsToFields(performance.stats),
          {
            key: 'strengths',
            label: 'Strengths',
            value: performance.strengths?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'physicalStatus',
            label: 'Physical status',
            value: performance.physicalStatus ?? null,
            source: 'jerry',
          },
          {
            key: 'archetype',
            label: 'Player archetype',
            value: performance.archetype ?? null,
            source: 'jerry',
          },
        ]),
      },
      {
        id: 'academic',
        title: 'Academic',
        icon: 'GraduationCap',
        ...this.buildFieldList([
          {
            key: 'gpa',
            label: 'GPA',
            value: academic.gpa ?? null,
            source: 'jerry',
          },
          {
            key: 'sat',
            label: 'SAT/ACT',
            value: academic.satAct ?? null,
            source: 'jerry',
          },
          {
            key: 'intendedMajor',
            label: 'Intended major',
            value: academic.intendedMajor ?? null,
            source: 'jerry',
          },
          {
            key: 'ncaaEligibility',
            label: 'NCAA eligibility',
            value:
              academic.ncaaEligibility !== undefined
                ? academic.ncaaEligibility
                  ? 'Yes'
                  : 'No'
                : null,
            source: 'jerry',
          },
          {
            key: 'academicInterests',
            label: 'Academic interests',
            value: academic.academicInterests?.join(', ') ?? null,
            source: 'jerry',
          },
        ]),
      },
      {
        id: 'availability',
        title: 'Recruiting Direction',
        icon: 'Target',
        ...this.buildFieldList([
          {
            key: 'competitiveLevelGoal',
            label: 'Target level',
            value: availability.competitiveLevelGoal ?? null,
            source: 'jerry',
          },
          {
            key: 'goals',
            label: 'Recruiting goals',
            value: availability.goals?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'timeline',
            label: 'Timeline',
            value: availability.timeline ?? null,
            source: 'jerry',
          },
          {
            key: 'preferredRegions',
            label: 'Preferred regions',
            value: availability.preferredRegions?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'relocationOpenness',
            label: 'Relocation openness',
            value: availability.relocationOpenness ?? null,
            source: 'jerry',
          },
          {
            key: 'transferPortal',
            label: 'Transfer portal',
            value:
              availability.transferPortal !== undefined
                ? availability.transferPortal
                  ? 'Yes'
                  : 'No'
                : null,
            source: 'jerry',
          },
          {
            key: 'scholarshipNeed',
            label: 'Scholarship need',
            value:
              availability.scholarshipNeed !== undefined
                ? availability.scholarshipNeed
                  ? 'Yes'
                  : 'No'
                : null,
            source: 'jerry',
          },
          {
            key: 'nonNegotiables',
            label: 'Non-negotiables',
            value: availability.nonNegotiables?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'limitations',
            label: 'Limitations',
            value: availability.limitations?.join(', ') ?? null,
            source: 'jerry',
          },
        ]),
      },
      {
        id: 'media',
        title: 'Representation Assets',
        icon: 'Video',
        ...this.buildFieldList([
          {
            key: 'highlightUrls',
            label: 'Highlights',
            value: media.highlightUrls?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'clipUrls',
            label: 'Clips',
            value: media.clipUrls?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'instagram',
            label: 'Instagram',
            value: media.socialMedia?.instagram ?? null,
            source: 'jerry',
          },
          {
            key: 'twitter',
            label: 'Twitter/X',
            value: media.socialMedia?.twitter ?? null,
            source: 'jerry',
          },
          {
            key: 'hudl',
            label: 'Hudl',
            value: media.socialMedia?.hudl ?? null,
            source: 'jerry',
          },
          {
            key: 'references',
            label: 'References',
            value: media.references?.join(', ') ?? null,
            source: 'jerry',
          },
        ]),
      },
      {
        id: 'character',
        title: 'Competitive Identity',
        icon: 'Brain',
        ...this.buildFieldList([
          {
            key: 'selfRepresentation',
            label: 'Self-representation',
            value: character.selfRepresentation ?? null,
            source: 'jerry',
          },
          {
            key: 'growthAreas',
            label: 'Growth areas',
            value: character.growthAreas?.join(', ') ?? null,
            source: 'jerry',
          },
          {
            key: 'mentality',
            label: 'Mentality',
            value: character.mentality ?? null,
            source: 'jerry',
          },
          {
            key: 'leadership',
            label: 'Leadership',
            value: character.leadership ?? null,
            source: 'jerry',
          },
          {
            key: 'coachability',
            label: 'Coachability',
            value: character.coachability ?? null,
            source: 'jerry',
          },
          {
            key: 'resilience',
            label: 'Resilience',
            value: character.resilience ?? null,
            source: 'jerry',
          },
          {
            key: 'motivation',
            label: 'Motivation',
            value: character.motivation ?? null,
            source: 'jerry',
          },
        ]),
      },
    ];

    return sections;
  }

  private statsToFields(
    stats: Record<string, number> | undefined,
  ): DossierField[] {
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
      completedFields: fields.filter((f) => f.value !== null && f.value !== '')
        .length,
      totalFields: fields.length,
    };
  }
}
