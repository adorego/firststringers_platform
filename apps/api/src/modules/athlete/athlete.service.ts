import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { DossierData } from '../../shared/types';

export interface AthleteResponse {
  id: string;
  email: string;
  name: string;
  role: 'athlete';
  sport: string;
  position: string;
  graduationYear: number;
  gpa?: number;
  region?: string;
  avatarUrl?: string;
  dossier: {
    completeness: number;
    data: DossierData;
    narrative: string;
  };
}

@Injectable()
export class AthleteService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AthleteResponse[]> {
    const athletes = await this.prisma.athlete.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        sport: true,
        position: true,
        dossier: {
          select: { data: true, completeness: true, narrative: true },
        },
      },
    });

    return athletes.map((a) => this.toResponse(a));
  }

  async findOne(id: string): Promise<AthleteResponse> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id },
      include: { dossier: true },
    });

    if (!athlete) {
      throw new NotFoundException(`Athlete ${id} not found`);
    }

    return this.toResponse(athlete);
  }

  private toResponse(athlete: {
    id: string;
    email: string;
    name: string;
    sport: string | null;
    position: string | null;
    dossier: {
      data: unknown;
      completeness: number;
      narrative: string | null;
    } | null;
  }): AthleteResponse {
    const data = (athlete.dossier?.data as DossierData) || {};

    return {
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
        completeness: athlete.dossier?.completeness ?? 0,
        data,
        narrative: athlete.dossier?.narrative ?? '',
      },
    };
  }
}
