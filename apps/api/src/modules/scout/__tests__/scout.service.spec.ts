import { ScoutService } from '../scout.service';
import { RankingService } from '../ranking.service';
import type { PrismaService } from '../../../shared/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

type FindManyArgs = {
  where: Prisma.AthleteWhereInput;
};

describe('ScoutService', () => {
  const findMany = jest.fn<Promise<unknown[]>, [FindManyArgs]>();
  const prisma = {
    athlete: { findMany },
  } as unknown as PrismaService;

  const service = new ScoutService(prisma, new RankingService());

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('only searches athletes whose representation is active (FS-CS-005 gate)', async () => {
    await service.search('quarterback in Florida', { sport: 'football' });

    expect(findMany).toHaveBeenCalledTimes(1);
    const { where } = findMany.mock.calls[0][0];
    expect(where.representationStatus).toEqual({
      in: ['represented', 'verified'],
    });
  });

  it('keeps the representation gate even with no other filters', async () => {
    await service.search('any athlete', {});

    const { where } = findMany.mock.calls[0][0];
    expect(where.representationStatus).toEqual({
      in: ['represented', 'verified'],
    });
    expect(where.sport).toBeUndefined();
  });

  describe('"show me more" (excludeIds)', () => {
    it('excludes previously shown athletes from the query', async () => {
      await service.search(
        'quarterback',
        { sport: 'football', position: 'quarterback' },
        5,
        ['already-shown-1', 'already-shown-2'],
      );

      const { where } = findMany.mock.calls[0][0];
      expect(where.id).toEqual({ notIn: ['already-shown-1', 'already-shown-2'] });
    });

    it('does not filter by id when nothing has been shown yet', async () => {
      await service.search('quarterback', { sport: 'football' });

      const { where } = findMany.mock.calls[0][0];
      expect(where.id).toBeUndefined();
    });

    it('broadens to other positions (still excluding shown athletes) when the exact position is exhausted', async () => {
      const otherPositionAthlete = {
        id: 'rb-1',
        name: 'Someone Else',
        sport: 'football',
        position: 'RB',
        dossier: null,
        createdAt: new Date(),
      };
      findMany
        .mockResolvedValueOnce([]) // exact position, excluding shown
        .mockResolvedValueOnce([otherPositionAthlete]); // position relaxed

      const result = await service.search(
        'quarterback',
        { sport: 'football', position: 'quarterback' },
        5,
        ['already-shown-1'],
      );

      expect(result.relaxedPosition).toBe('quarterback');
      expect(result.expanded).toBe(true);
      expect(result.athletes.map((a) => a.id)).toEqual(['rb-1']);
    });

    it('drops every soft filter as a last resort when even the relaxed position is exhausted', async () => {
      const anyAthlete = {
        id: 'wr-1',
        name: 'Someone New',
        sport: 'football',
        position: 'WR',
        dossier: null,
        createdAt: new Date(),
      };
      findMany
        .mockResolvedValueOnce([]) // exact position, excluding shown
        .mockResolvedValueOnce([]) // position relaxed, excluding shown
        .mockResolvedValueOnce([anyAthlete]); // sport-only, excluding shown

      const result = await service.search(
        'quarterback',
        { sport: 'football', position: 'quarterback', minGpa: 3.5 },
        5,
        ['already-shown-1'],
      );

      expect(findMany).toHaveBeenCalledTimes(3);
      const lastWhere = findMany.mock.calls[2][0].where;
      expect(lastWhere.position).toBeUndefined();
      expect(lastWhere.id).toEqual({ notIn: ['already-shown-1'] });
      expect(result.expanded).toBe(true);
      expect(result.athletes.map((a) => a.id)).toEqual(['wr-1']);
    });

    it('does not mark a fresh search as expanded even if it comes back empty', async () => {
      const result = await service.search('quarterback', {
        sport: 'football',
        position: 'quarterback',
      });

      expect(result.expanded).toBeUndefined();
      expect(result.athletes).toEqual([]);
    });
  });
});
