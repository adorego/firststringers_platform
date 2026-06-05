import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMService } from '../../shared/llm/llm.service';

@Injectable()
export class JerryPitchService {
  private readonly logger = new Logger(JerryPitchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  @OnEvent('dossier.updated')
  async handleDossierUpdated(payload: { athleteId: string }) {
    try {
      this.logger.log(`Regenerating pitch for athlete ${payload.athleteId}`);
      await this.buildAndSavePitch(payload.athleteId);
    } catch (error) {
      this.logger.error(`Failed to regenerate pitch for ${payload.athleteId}`, error);
    }
  }

  async buildAndSavePitch(athleteId: string): Promise<string> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { dossier: true },
    });

    if (!athlete || !athlete.dossier) throw new Error('Athlete or dossier not found');

    const d = (athlete.dossier.data as any) ?? {};

    const pitch = await this.llm.chat({
      systemPrompt: `You are Jerry, the AI recruiting agent for ${athlete.name}.
Your job is to prepare a compelling pitch that will be shown to recruiters.
Write 3-4 sentences in first person as Jerry.
Be specific about stats and strengths. Be professional, enthusiastic and concise.
End with why a program should act quickly to recruit this athlete.`,
      messages: [{
        role: 'user',
        content: `Generate the recruiter pitch for:
Name: ${athlete.name}
Sport: ${athlete.sport} · Position: ${athlete.position}
Division: ${d.leagueLevel ?? 'N/A'}
GPA: ${d.gpa ?? 'N/A'} · Major: ${d.intendedMajor ?? 'N/A'}
Graduation: ${d.graduationYear ?? 'N/A'}
NCAA Eligible: ${d.ncaaEligible ? 'Yes' : 'No'}
Transfer Portal: ${d.inTransferPortal ? 'Yes' : 'No'}
Trajectory: ${d.trajectory ?? 'STABLE'}
Key Strengths: ${(d.keyStrengths ?? []).join(', ')}
Stats: ${JSON.stringify(d.stats ?? {})}
Bio: ${athlete.dossier.narrative ?? ''}`,
        timestamp: new Date(),
      }],
    });

    // Guardar en campo dedicado
    await this.prisma.jerrySession.upsert({
      where: { athleteId },
      update: {
        currentPitch: pitch,
        pitchVersion: { increment: 1 },
        lastPitchAt: new Date(),
        status: 'active',
      },
      create: {
        athleteId,
        currentPitch: pitch,
        pitchVersion: 1,
        lastPitchAt: new Date(),
        status: 'active',
        messages: [],
      },
    });

    this.logger.log(`Pitch saved for athlete ${athlete.name} (v${1})`);
    return pitch;
  }

  async getPitchForRecruiter(
    athleteId: string,
  ): Promise<{ athleteName: string; pitch: string }> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        dossier: true,
        sessions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!athlete) throw new Error('Athlete not found');

    const session = athlete.sessions[0];
    let pitch = session?.currentPitch ?? null;

    // Si no hay pitch preparado, generarlo
    if (!pitch) {
      this.logger.log(`No pitch found for ${athlete.name}, generating now...`);
      pitch = await this.buildAndSavePitch(athleteId);
    }

    return { athleteName: athlete.name, pitch };
  }
}