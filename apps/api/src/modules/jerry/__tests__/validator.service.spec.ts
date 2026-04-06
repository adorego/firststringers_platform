import { Test, TestingModule } from '@nestjs/testing'
import { ValidatorService } from '../validator.service'
import { PrismaService } from '../../../shared/prisma/prisma.service'
import { DossierData } from '../../../shared/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  dossier: {
    findUnique: jest.fn(),
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fullDossier: DossierData = {
  identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
  performance: { stats: { td: 28 }, leagueLevel: 'D1' },
  academic: { gpa: 3.7, intendedMajor: 'Business' },
  availability: {
    transferPortal: false,
    preferredRegions: ['Midwest'],
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ValidatorService', () => {
  let service: ValidatorService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<ValidatorService>(ValidatorService)
    jest.clearAllMocks()
  })

  // ── getMissingFields ────────────────────────────────────────────────────────

  describe('getMissingFields', () => {
    it('debe NO agregar disponibilidad si transferPortal está definido como false', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue({ athleteId: 'x', data: fullDossier })

      const result = await service.getMissingFields('x')

      expect(result).not.toContain('disponibilidad')
    })

    it('debe retornar array vacío para dossier completamente lleno', async () => {
      const completeDossier: DossierData = {
        identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
        performance: { stats: { td: 28 }, leagueLevel: 'D1' },
        academic: { gpa: 3.7, intendedMajor: 'Business' },
        availability: { transferPortal: true, preferredRegions: ['Midwest'] },
      }
      mockPrisma.dossier.findUnique.mockResolvedValue({ athleteId: 'x', data: completeDossier })

      const result = await service.getMissingFields('x')

      expect(result).toEqual([])
    })

    it('debe retornar los 9 campos requeridos cuando el dossier es null', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue(null)

      const result = await service.getMissingFields('x')

      expect(result).toEqual([
        'deporte',
        'posición',
        'año de graduación',
        'estadísticas',
        'nivel de liga',
        'GPA',
        'carrera de interés',
        'disponibilidad',
        'regiones preferidas',
      ])
      expect(result).toHaveLength(9)
    })
  })

  // ── getCompleteness ─────────────────────────────────────────────────────────

  describe('getCompleteness', () => {
    it('debe ser consistente con getMissingFields para un dossier parcial (5 de 9)', async () => {
      // Completos: deporte, posición, año de graduación, estadísticas, nivel de liga (5)
      // Faltantes: GPA, carrera de interés, disponibilidad, regiones preferidas (4)
      const partialDossier: DossierData = {
        identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
        performance: { stats: { td: 28 }, leagueLevel: 'D1' },
      }
      mockPrisma.dossier.findUnique.mockResolvedValue({ athleteId: 'x', data: partialDossier })

      const completeness = await service.getCompleteness('x')

      expect(completeness).toBeCloseTo(5 / 9, 5)
    })
  })
})
