import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class RepresentationService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureActivation(athleteId: string): Promise<void> {
    await this.prisma.athlete.updateMany({
      where: { id: athleteId, representationStatus: 'registered' },
      data: { representationStatus: 'activation' },
    });
  }

  async markRepresented(athleteId: string): Promise<void> {
    await this.prisma.athlete.updateMany({
      where: {
        id: athleteId,
        representationStatus: { in: ['registered', 'activation'] },
      },
      data: {
        representationStatus: 'represented',
        representedAt: new Date(),
      },
    });
  }
}
