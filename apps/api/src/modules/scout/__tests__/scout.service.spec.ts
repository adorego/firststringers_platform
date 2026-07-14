import { ScoutService } from '../scout.service';
import { RankingService } from '../ranking.service';
import type { PrismaService } from '../../../shared/prisma/prisma.service';

describe('ScoutService', () => {
  const findMany = jest.fn();
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
    const where = findMany.mock.calls[0][0].where;
    expect(where.representationStatus).toEqual({
      in: ['represented', 'verified'],
    });
  });

  it('keeps the representation gate even with no other filters', async () => {
    await service.search('any athlete', {});

    const where = findMany.mock.calls[0][0].where;
    expect(where.representationStatus).toEqual({
      in: ['represented', 'verified'],
    });
    expect(where.sport).toBeUndefined();
  });
});
