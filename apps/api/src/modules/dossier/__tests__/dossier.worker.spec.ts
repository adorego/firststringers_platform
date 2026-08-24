import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DossierWorker } from '../dossier.worker';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LLMService } from '../../../shared/llm/llm.service';
import { calculateDossierCompleteness } from '../dossier-normalizer';
import type { DossierData } from '../../../shared/types';

jest.mock('../dossier-normalizer', () => ({
  ...jest.requireActual<Record<string, unknown>>('../dossier-normalizer'),
  calculateDossierCompleteness: jest.fn(() => 0.5),
}));

const mockCompleteness = calculateDossierCompleteness as jest.Mock;

const mockPrisma = {
  dossier: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};

const mockLlm = { chat: jest.fn() };

const UPDATE = { identity: { sport: 'Baseball' } };

describe('DossierWorker — event emissions', () => {
  let worker: DossierWorker;
  let emitter: EventEmitter2;
  let emitted: Array<[string, unknown]>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DossierWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LLMService, useValue: mockLlm },
        EventEmitter2,
      ],
    }).compile();

    worker = module.get(DossierWorker);
    emitter = module.get(EventEmitter2);
    jest.clearAllMocks();

    emitted = [];
    emitter.onAny((event, payload) => {
      emitted.push([event as string, payload]);
    });

    mockCompleteness.mockReturnValue(0.5);
    mockPrisma.dossier.findUnique.mockResolvedValue(null);
    mockPrisma.dossier.upsert.mockResolvedValue({});
    mockPrisma.dossier.update.mockResolvedValue({});
    mockLlm.chat.mockResolvedValue('A generated narrative.');
  });

  function eventsNamed(name: string): Array<[string, unknown]> {
    return emitted.filter(([event]) => event === name);
  }

  it('emits dossier.updated once with the full payload and pitch_refresh once', async () => {
    await worker.handleDossierUpdate({ athleteId: 'ath-1', newData: UPDATE });

    const updated = eventsNamed('dossier.updated');
    const refresh = eventsNamed('dossier.pitch_refresh');

    expect(updated).toHaveLength(1);
    expect(updated[0][1]).toMatchObject({
      athleteId: 'ath-1',
      completeness: 0.5,
      changedFields: expect.any(Array) as string[],
    });
    expect((updated[0][1] as { data: unknown }).data).toBeDefined();
    expect(refresh).toHaveLength(1);
    expect(refresh[0][1]).toEqual({ athleteId: 'ath-1' });
  });

  it('does not generate a narrative below the completeness threshold', async () => {
    await worker.handleDossierUpdate({ athleteId: 'ath-1', newData: UPDATE });

    expect(mockLlm.chat).not.toHaveBeenCalled();
  });

  it('generates the narrative before emitting pitch_refresh at >=75% completeness', async () => {
    mockCompleteness.mockReturnValue(0.9);
    const order: string[] = [];
    mockLlm.chat.mockImplementation(() => {
      order.push('narrative');
      return Promise.resolve('A generated narrative.');
    });
    emitter.on('dossier.pitch_refresh', () => order.push('pitch_refresh'));

    await worker.handleDossierUpdate({ athleteId: 'ath-1', newData: UPDATE });

    expect(mockLlm.chat).toHaveBeenCalledTimes(1);
    expect(mockPrisma.dossier.update).toHaveBeenCalledWith({
      where: { athleteId: 'ath-1' },
      data: { narrative: 'A generated narrative.' },
    });
    expect(order).toEqual(['narrative', 'pitch_refresh']);
    // The UI event still fires exactly once — the old double emission is gone.
    expect(eventsNamed('dossier.updated')).toHaveLength(1);
  });

  it('still emits pitch_refresh when the narrative generation fails', async () => {
    mockCompleteness.mockReturnValue(0.9);
    mockLlm.chat.mockRejectedValue(new Error('llm down'));

    await worker.handleDossierUpdate({ athleteId: 'ath-1', newData: UPDATE });

    expect(eventsNamed('dossier.pitch_refresh')).toHaveLength(1);
    expect(eventsNamed('dossier.updated')).toHaveLength(1);
  });

  it('keeps the stored recruiting fields that Jerry never sends', async () => {
    mockPrisma.dossier.findUnique.mockResolvedValue({
      athleteId: 'ath-1',
      data: {
        identity: { sport: 'football', position: 'QB' },
        fitTags: ['pro-style', 'high-academic'],
        trajectory: 'IMPROVING',
        recruiterPitch: 'Three-year starter with elite film study habits.',
        demoMetadata: { synthetic: true, dataset: 'fs-pilot-2026-08' },
      },
    });

    await worker.handleDossierUpdate({
      athleteId: 'ath-1',
      newData: { academic: { gpa: 3.8 } },
    });

    const [upsertArgs] = mockPrisma.dossier.upsert.mock.calls[0] as [
      { update: { data: Record<string, unknown> } },
    ];
    expect(upsertArgs.update.data).toMatchObject({
      fitTags: ['pro-style', 'high-academic'],
      trajectory: 'IMPROVING',
      recruiterPitch: 'Three-year starter with elite film study habits.',
      demoMetadata: { synthetic: true, dataset: 'fs-pilot-2026-08' },
      academic: { gpa: 3.8 },
    });
  });

  it('keeps height and weight when a later turn only adds the dominant side', async () => {
    mockPrisma.dossier.findUnique.mockResolvedValue({
      athleteId: 'ath-1',
      data: {
        performance: {
          leagueLevel: 'Varsity',
          physicalProfile: { height: "6'2", weight: '185 lbs' },
        },
      },
    });

    await worker.handleDossierUpdate({
      athleteId: 'ath-1',
      newData: {
        performance: { physicalProfile: { dominantSide: 'right' } },
      },
    });

    const [upsertArgs] = mockPrisma.dossier.upsert.mock.calls[0] as [
      { update: { data: DossierData } },
    ];
    expect(upsertArgs.update.data.performance?.physicalProfile).toEqual({
      height: "6'2",
      weight: '185 lbs',
      dominantSide: 'right',
    });
    expect(upsertArgs.update.data.performance?.leagueLevel).toBe('Varsity');
  });

  it('merges new stats into the stored ones instead of replacing them', async () => {
    mockPrisma.dossier.findUnique.mockResolvedValue({
      athleteId: 'ath-1',
      data: { performance: { stats: { passingYards: 3240 } } },
    });

    await worker.handleDossierUpdate({
      athleteId: 'ath-1',
      newData: { performance: { stats: { touchdowns: 28 } } },
    });

    const [upsertArgs] = mockPrisma.dossier.upsert.mock.calls[0] as [
      { update: { data: DossierData } },
    ];
    expect(upsertArgs.update.data.performance?.stats).toEqual({
      passingYards: 3240,
      touchdowns: 28,
    });
  });

  it('swallows dossier persistence failures without throwing (fire-and-forget listener)', async () => {
    mockPrisma.dossier.findUnique.mockRejectedValue(new Error('db down'));

    await expect(
      worker.handleDossierUpdate({ athleteId: 'ath-1', newData: UPDATE }),
    ).resolves.toBeUndefined();

    expect(emitted).toHaveLength(0);
  });
});
