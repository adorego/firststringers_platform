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
  identity: {
    sport: 'Football',
    position: 'QB',
    graduationYear: 2025,
    location: 'Dallas, TX',
    school: 'Highland Park HS',
    competitiveLevel: 'Varsity',
  },
  performance: {
    stats: { td: 28 },
    leagueLevel: 'D1',
    strengths: ['arm strength', 'pocket presence'],
    physicalProfile: {
      height: '6\'2"',
      weight: '195 lbs',
      dominantSide: 'Right',
    },
    physicalStatus: 'Healthy, no injuries',
  },
  academic: { gpa: 3.7, intendedMajor: 'Business' },
  availability: {
    transferPortal: false,
    preferredRegions: ['Midwest'],
    competitiveLevelGoal: 'D1',
    goals: ['Start as freshman'],
    timeline: 'This year',
    relocationOpenness: 'Open to anywhere',
    nonNegotiables: ['Strong academics'],
  },
  media: {
    highlightUrls: ['https://hudl.com/highlights/123'],
    clipUrls: ['https://youtube.com/clip/456'],
    socialMedia: { instagram: '@qb1' },
    references: ['Coach Smith'],
  },
  character: {
    mentality: 'Competitive and composed under pressure',
    motivation: 'Want to play at the highest level',
    growthAreas: ['Deep ball accuracy'],
    selfRepresentation: 'A composed leader who performs under pressure',
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
    it('returns an empty array for a fully complete dossier', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue({
        athleteId: 'x',
        data: fullDossier,
      });

      const result = await service.getMissingFields('x');

      expect(result).toEqual([]);
    });

    it('returns all 28 required fields when the dossier is null', async () => {
      mockPrisma.dossier.findUnique.mockResolvedValue(null);

      const result = await service.getMissingFields('x');

      expect(result).toEqual([
        'sport',
        'position',
        'graduation year',
        'location',
        'school',
        'competitive level',
        'physical profile',
        'dominant side',
        'stats',
        'league level',
        'strengths',
        'physical status',
        'competitive level goal',
        'goals',
        'timeline',
        'preferred regions',
        'relocation openness',
        'GPA',
        'intended major',
        'non-negotiables',
        'highlights',
        'clips',
        'social media',
        'references',
        'self-representation',
        'growth areas',
        'mentality',
        'motivation',
      ]);
      expect(result).toHaveLength(28);
    });
  });

  // ── getCompleteness ─────────────────────────────────────────────────────────

  describe('getCompleteness', () => {
    it('is consistent with getMissingFields for a partial dossier (5 of 28)', async () => {
      // Complete: sport, position, graduation year, stats, league level (5)
      const partialDossier: DossierData = {
        identity: { sport: 'Football', position: 'QB', graduationYear: 2025 },
        performance: { stats: { td: 28 }, leagueLevel: 'D1' },
      };
      mockPrisma.dossier.findUnique.mockResolvedValue({
        athleteId: 'x',
        data: partialDossier,
      });

      const completeness = await service.getCompleteness('x');

      expect(completeness).toBeCloseTo(5 / 28, 5);
    });
  });
});
