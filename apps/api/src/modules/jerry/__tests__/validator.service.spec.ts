import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorService } from '../validator.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { DossierData } from '../../../shared/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  dossier: {
    findUnique: jest.fn(),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fullDossier: DossierData = {
  identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
  performance: { stats: { td: 28 }, leagueLevel: 'D1' },
  academic: { gpa: 3.7, intendedMajor: 'Business' },
  availability: {
    transferPortal: false,
    preferredRegions: ['Midwest'],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ValidatorService', () => {
  let service: ValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ValidatorService>(ValidatorService);
    jest.clearAllMocks();
  });

  // ── getMissingFields ────────────────────────────────────────────────────────

  describe('getMissingFields', () => {
    it('does NOT add "availability" when transferPortal is defined as false', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue({
        athleteId: 'x',
        data: fullDossier,
      });

      const result = await service.getMissingFields('x');

      expect(result).not.toContain('availability');
    });

    it('returns an empty array for a fully complete dossier', async () => {
      const completeDossier: DossierData = {
        identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
        performance: { stats: { td: 28 }, leagueLevel: 'D1' },
        academic: { gpa: 3.7, intendedMajor: 'Business' },
        availability: { transferPortal: true, preferredRegions: ['Midwest'] },
      };
      mockPrisma.dossier.findUnique.mockResolvedValue({
        athleteId: 'x',
        data: completeDossier,
      });

      const result = await service.getMissingFields('x');

      expect(result).toEqual([]);
    });

    it('returns all 9 required fields when the dossier is null', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue(null);

      const result = await service.getMissingFields('x');

      expect(result).toEqual([
        'sport',
        'position',
        'graduation year',
        'stats',
        'league level',
        'GPA',
        'intended major',
        'availability',
        'preferred regions',
      ]);
      expect(result).toHaveLength(9);
    });
  });

  // ── getCompleteness ─────────────────────────────────────────────────────────

  describe('getCompleteness', () => {
    it('is consistent with getMissingFields for a partial dossier (5 of 9)', async () => {
      // Complete: sport, position, graduation year, stats, league level (5)
      // Missing: GPA, intended major, availability, preferred regions (4)
      const partialDossier: DossierData = {
        identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
        performance: { stats: { td: 28 }, leagueLevel: 'D1' },
      };
      mockPrisma.dossier.findUnique.mockResolvedValue({
        athleteId: 'x',
        data: partialDossier,
      });

      const completeness = await service.getCompleteness('x');

      expect(completeness).toBeCloseTo(5 / 9, 5);
    });
  });
});
