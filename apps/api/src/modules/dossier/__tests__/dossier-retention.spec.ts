import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DossierWorker } from '../dossier.worker';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LLMService } from '../../../shared/llm/llm.service';
import type { DossierData } from '../../../shared/types';

type Json = Record<string, unknown>;

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.length > 0 ? [prefix] : [];
  if (typeof value === 'object') {
    return Object.entries(value as Json).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function valueAt(target: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object') {
      return (value as Json)[key];
    }
    return undefined;
  }, target);
}

// Each entry is one athlete turn: what the extractor produced for that message.
// Drawn from real Jerry conversations — the order matters, since the bugs this
// guards against only appear when a later turn touches a section an earlier
// turn already filled.
const CONVERSATION: Array<{ turn: string; extracted: Partial<DossierData> }> = [
  {
    turn: 'I play baseball, catcher, class of 2027',
    extracted: {
      identity: {
        sport: 'baseball',
        position: 'Catcher',
        graduationYear: 2027,
      },
    },
  },
  {
    turn: 'Westminster Christian in Miami, varsity',
    extracted: {
      identity: {
        school: 'Westminster Christian',
        location: 'Miami, FL',
        competitiveLevel: 'Varsity',
      },
    },
  },
  {
    turn: "6'2 and 185 lbs",
    extracted: {
      performance: { physicalProfile: { height: "6'2", weight: '185 lbs' } },
    },
  },
  {
    turn: 'Right',
    extracted: {
      performance: { physicalProfile: { dominantSide: 'Right' } },
    },
  },
  {
    turn: 'I hit 5 home runs this past weekend',
    extracted: { performance: { stats: { homeRuns: 5 } } },
  },
  {
    turn: 'I batted .410 this season',
    extracted: { performance: { stats: { battingAverage: 0.41 } } },
  },
  {
    turn: 'My GPA is 3.8 and I want to study engineering',
    extracted: {
      academic: { gpa: 3.8, intendedMajor: 'Engineering' },
    },
  },
  {
    turn: 'Scholarship is my main goal, D1 level',
    extracted: {
      availability: {
        goals: ['Secure a scholarship'],
        competitiveLevelGoal: 'D1',
      },
    },
  },
  {
    turn: 'Here is my Hudl profile',
    extracted: { media: { socialMedia: { hudl: 'https://hudl.com/demo' } } },
  },
  {
    turn: 'My Instagram is @demo',
    extracted: { media: { socialMedia: { instagram: '@demo' } } },
  },
];

describe('Dossier data retention across a conversation', () => {
  let worker: DossierWorker;
  let stored: { data: Json } | null;

  const mockPrisma = {
    dossier: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    stored = null;

    mockPrisma.dossier.findUnique.mockImplementation(() =>
      Promise.resolve(stored),
    );
    mockPrisma.dossier.upsert.mockImplementation(
      (args: { create: { data: Json }; update: { data: Json } }) => {
        stored = { data: stored ? args.update.data : args.create.data };
        return Promise.resolve(stored);
      },
    );
    mockPrisma.dossier.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DossierWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LLMService, useValue: { chat: jest.fn() } },
        EventEmitter2,
      ],
    }).compile();

    worker = module.get(DossierWorker);
  });

  it('never drops a field it accepted on an earlier turn', async () => {
    const seen = new Map<string, unknown>();

    for (const { turn, extracted } of CONVERSATION) {
      await worker.handleDossierUpdate({
        athleteId: 'ath-1',
        newData: extracted,
      });

      const data = stored?.data ?? {};
      for (const [path, value] of seen) {
        expect({ turn, path, value: valueAt(data, path) }).toEqual({
          turn,
          path,
          value,
        });
      }
      for (const path of leafPaths(data)) {
        seen.set(path, valueAt(data, path));
      }
    }
  });

  it('ends the conversation holding every field the athlete provided', async () => {
    for (const { extracted } of CONVERSATION) {
      await worker.handleDossierUpdate({
        athleteId: 'ath-1',
        newData: extracted,
      });
    }

    const data = stored?.data as DossierData;

    expect(data.identity).toMatchObject({
      sport: 'baseball',
      position: 'Catcher',
      graduationYear: 2027,
      school: 'Westminster Christian',
      competitiveLevel: 'Varsity',
    });
    expect(data.performance?.physicalProfile).toEqual({
      height: "6'2",
      weight: '185 lbs',
      dominantSide: 'Right',
    });
    expect(data.performance?.stats).toEqual({
      homeRuns: 5,
      battingAverage: 0.41,
    });
    expect(data.academic).toMatchObject({ gpa: 3.8 });
    expect(data.media?.socialMedia).toEqual({
      hudl: 'https://hudl.com/demo',
      instagram: '@demo',
    });
  });

  it('keeps the recruiting fields the seed and the demo importer write', async () => {
    stored = {
      data: {
        identity: { sport: 'baseball' },
        fitTags: ['pro-style', 'high-academic'],
        trajectory: 'IMPROVING',
        recruiterPitch: 'Three-year starter.',
        demoMetadata: { synthetic: true, dataset: 'fs-pilot-2026-08' },
      },
    };

    for (const { extracted } of CONVERSATION) {
      await worker.handleDossierUpdate({
        athleteId: 'ath-1',
        newData: extracted,
      });
    }

    const data = stored.data as DossierData;
    expect(data.fitTags).toEqual(['pro-style', 'high-academic']);
    expect(data.trajectory).toBe('IMPROVING');
    expect(data.recruiterPitch).toBe('Three-year starter.');
    expect(data.demoMetadata).toEqual({
      synthetic: true,
      dataset: 'fs-pilot-2026-08',
    });
  });
});
