import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMService } from '../../shared/llm/llm.service';
import type { DossierData } from '../../shared/types';

@Injectable()
export class JerryPitchService {
  private readonly logger = new Logger(JerryPitchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  // Listens to the pitch-specific event (fired once per dossier update, after
  // the narrative exists) rather than 'dossier.updated', which is UI-facing.
  @OnEvent('dossier.pitch_refresh')
  async handleDossierUpdated(payload: { athleteId: string }) {
    try {
      this.logger.log(`Regenerating pitch for athlete ${payload.athleteId}`);
      await this.buildAndSavePitch(payload.athleteId);
    } catch (error) {
      this.logger.error(
        `Failed to regenerate pitch for ${payload.athleteId}`,
        error,
      );
    }
  }

  async buildAndSavePitch(athleteId: string): Promise<string> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { dossier: true },
    });

    if (!athlete || !athlete.dossier)
      throw new Error('Athlete or dossier not found');

    const d = (athlete.dossier.data as DossierData) ?? {};

    const pitch = await this.llm.chat({
      systemPrompt: `You are Jerry, the AI recruiting agent for ${athlete.name}.
Your job is to prepare a compelling pitch that will be shown to recruiters.
Write 3-4 sentences in first person as Jerry.
Be specific about stats and strengths. Be professional, enthusiastic and concise.
Only mention facts that are provided — never invent stats or say "N/A".
End with why a program should act quickly to recruit this athlete.`,
      messages: [
        {
          role: 'user',
          content: `Generate the recruiter pitch for:
Name: ${athlete.name}
Sport: ${athlete.sport ?? d.identity?.sport ?? 'N/A'} · Position: ${athlete.position ?? d.identity?.position ?? 'N/A'}
School: ${d.identity?.school ?? 'N/A'} (${d.identity?.location ?? 'N/A'})
Competition Level: ${d.identity?.competitiveLevel ?? d.performance?.leagueLevel ?? 'N/A'}
Graduation: ${d.identity?.graduationYear ?? 'N/A'}
Physical: ${d.performance?.physicalProfile?.height ?? ''} ${d.performance?.physicalProfile?.weight ?? ''} ${d.performance?.physicalProfile?.dominantSide ?? ''}
Stats: ${JSON.stringify(d.performance?.stats ?? {})}
Key Strengths: ${(d.performance?.strengths ?? []).join(', ') || 'N/A'}
Physical Status: ${d.performance?.physicalStatus ?? 'N/A'}
GPA: ${d.academic?.gpa ?? 'N/A'} · Major: ${d.academic?.intendedMajor ?? 'N/A'}
Target Level: ${d.availability?.competitiveLevelGoal ?? 'N/A'} · Timeline: ${d.availability?.timeline ?? 'N/A'}
Transfer Portal: ${d.availability?.transferPortal ? 'Yes' : 'No'}
Mentality: ${d.character?.mentality ?? 'N/A'}
Motivation: ${d.character?.motivation ?? 'N/A'}
Bio: ${athlete.dossier.narrative ?? ''}`,
          timestamp: new Date(),
        },
      ],
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
