import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../shared/prisma/prisma.service'
import { LLMService } from '../../shared/llm/llm.service'
import type { DossierUpdateJob, DossierData } from '../../shared/types'

@Injectable()
export class DossierWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  @OnEvent('dossier.update')
  async handleDossierUpdate(payload: DossierUpdateJob) {
    const { athleteId, newData } = payload

    const current = await this.prisma.dossier.findUnique({
      where: { athleteId },
    })

    const currentData = (current?.data as DossierData) || {}
    const mergedData = this.mergeDeep(currentData, newData)
    const completeness = this.calculateCompleteness(mergedData)

    await this.prisma.dossier.upsert({
      where: { athleteId },
      create: {
        athleteId,
        data: mergedData as any,
        completeness,
      },
      update: {
        data: mergedData as any,
        completeness,
      },
    })

    console.log(
      `Dossier updated for ${athleteId} — completeness: ${Math.round(completeness * 100)}%`,
    )

    if (completeness >= 0.75 && !current?.narrative) {
      await this.generateNarrative(athleteId, mergedData)
    }
  }

  private async generateNarrative(
    athleteId: string,
    data: DossierData,
  ): Promise<void> {
    const narrative = await this.llm.chat({
      systemPrompt: `Eres un agente de representación deportiva de élite.
        Genera un pitch de reclutamiento convincente, honesto y específico
        para este atleta. Destaca fortalezas concretas, trayectoria
        y potencial de desarrollo. Máximo 3 párrafos en español.`,
      messages: [
        {
          role: 'user',
          content: `Genera el pitch para este atleta: ${JSON.stringify(data, null, 2)}`,
          timestamp: new Date(),
        },
      ],
    })

    await this.prisma.dossier.update({
      where: { athleteId },
      data: { narrative },
    })

    console.log(`Narrative generated for athlete ${athleteId}`)
  }

  private calculateCompleteness(data: DossierData): number {
    const checks = [
      !!data.identity?.sport,
      !!data.identity?.position,
      !!data.identity?.graduationYear,
      !!data.performance?.stats,
      !!data.performance?.leagueLevel,
      !!data.academic?.gpa,
      !!data.academic?.intendedMajor,
      data.availability?.transferPortal !== undefined,
      !!data.availability?.preferredRegions,
    ]

    const filled = checks.filter(Boolean).length
    return filled / checks.length
  }

  private mergeDeep(
    target: Partial<DossierData>,
    source: Partial<DossierData>,
  ): DossierData {
    const result = { ...target }

    for (const key of Object.keys(source) as (keyof DossierData)[]) {
      const sourceVal = source[key]
      const targetVal = target[key]

      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object'
      ) {
        result[key] = { ...targetVal, ...sourceVal } as any
      } else if (sourceVal !== undefined && sourceVal !== null) {
        result[key] = sourceVal as any
      }
    }

    return result as DossierData
  }
}