import { RepresentationService } from '../representation.service';
import type { PrismaService } from '../../../shared/prisma/prisma.service';

type UpdateManyArgs = {
  where: {
    id: string;
    representationStatus: string | { in: string[] };
  };
  data: {
    representationStatus: string;
    representedAt?: Date;
  };
};

describe('RepresentationService', () => {
  const updateMany = jest.fn<Promise<{ count: number }>, [UpdateManyArgs]>();
  const prisma = {
    athlete: { updateMany },
  } as unknown as PrismaService;

  const service = new RepresentationService(prisma);

  beforeEach(() => {
    updateMany.mockReset();
    updateMany.mockResolvedValue({ count: 1 });
  });

  describe('ensureActivation', () => {
    it('moves a registered athlete into activation', async () => {
      await service.ensureActivation('athlete-1');

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'athlete-1', representationStatus: 'registered' },
        data: { representationStatus: 'activation' },
      });
    });
  });

  describe('markRepresented', () => {
    it('promotes registered or activation athletes and stamps representedAt', async () => {
      await service.markRepresented('athlete-1');

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'athlete-1',
          representationStatus: { in: ['registered', 'activation'] },
        },
        data: {
          representationStatus: 'represented',
          representedAt: expect.any(Date) as Date,
        },
      });
    });

    it('never targets athletes already represented or verified', async () => {
      await service.markRepresented('athlete-1');

      const { where } = updateMany.mock.calls[0][0];
      const status = where.representationStatus as { in: string[] };
      expect(status.in).not.toContain('represented');
      expect(status.in).not.toContain('verified');
    });
  });
});
