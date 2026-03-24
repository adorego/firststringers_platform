import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma/prisma.service'
import { DossierData } from '../../shared/types'

@Injectable()
export class ValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async getMissingFields(athleteId: string): Promise<string[]> {
    const dossier = await this.prisma.dossier.findUnique({
      where: { athleteId },
    })

    if (!dossier) {
      return this.getAllRequiredFields()
    }

    const data = dossier.data as DossierData
    return this.calculateMissingFields(data)
  }

  async getCompleteness(athleteId: string): Promise<number> {
    const missing = await this.getMissingFields(athleteId)
    const total = this.getAllRequiredFields().length
    return (total - missing.length) / total
  }

  private calculateMissingFields(data: DossierData): string[] {
    const missing: string[] = []

    if (!data.identity?.sport) missing.push('deporte')
    if (!data.identity?.position) missing.push('posición')
    if (!data.identity?.graduationYear) missing.push('año de graduación')
    if (!data.performance?.stats) missing.push('estadísticas')
    if (!data.performance?.leagueLevel) missing.push('nivel de liga')
    if (!data.academic?.gpa) missing.push('GPA')
    if (!data.academic?.intendedMajor) missing.push('carrera de interés')
    if (!data.availability?.transferPortal !== undefined) missing.push('disponibilidad')
    if (!data.availability?.preferredRegions) missing.push('regiones preferidas')

    return missing
  }

  private getAllRequiredFields(): string[] {
    return [
      'deporte',
      'posición',
      'año de graduación',
      'estadísticas',
      'nivel de liga',
      'GPA',
      'carrera de interés',
      'disponibilidad',
      'regiones preferidas',
    ]
  }
}