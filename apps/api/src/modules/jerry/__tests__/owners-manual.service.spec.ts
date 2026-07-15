import { OwnersManualService } from '../owners-manual.service';
import type { PrismaService } from '../../../shared/prisma/prisma.service';

describe('OwnersManualService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const prisma = {
    ownersManual: { findUnique, upsert },
  } as unknown as PrismaService;

  const service = new OwnersManualService(prisma);

  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
  });

  describe('get', () => {
    it('returns empty object when the athlete has no manual yet', async () => {
      const result = await service.get('athlete-1');
      expect(result).toEqual({});
    });

    it('returns the stored data', async () => {
      findUnique.mockResolvedValue({ data: { values: ['family'] } });
      const result = await service.get('athlete-1');
      expect(result).toEqual({ values: ['family'] });
    });
  });

  describe('merge', () => {
    it('creates the manual on first insight', async () => {
      await service.merge('athlete-1', { motivations: ['be the first D1 in my family'] });

      expect(upsert).toHaveBeenCalledWith({
        where: { athleteId: 'athlete-1' },
        create: {
          athleteId: 'athlete-1',
          data: { motivations: ['be the first D1 in my family'] },
        },
        update: { data: { motivations: ['be the first D1 in my family'] } },
      });
    });

    it('unions array fields without case-insensitive duplicates', async () => {
      findUnique.mockResolvedValue({
        data: { values: ['Family', 'discipline'] },
      });

      await service.merge('athlete-1', { values: ['family', 'loyalty'] });

      const data = upsert.mock.calls[0][0].update.data;
      expect(data.values).toEqual(['Family', 'discipline', 'loyalty']);
    });

    it('overwrites text fields with the latest understanding', async () => {
      findUnique.mockResolvedValue({
        data: { communicationStyle: 'short answers' },
      });

      await service.merge('athlete-1', {
        communicationStyle: 'opens up when asked about games',
      });

      const data = upsert.mock.calls[0][0].update.data;
      expect(data.communicationStyle).toBe('opens up when asked about games');
    });

    it('preserves existing fields not present in the new insights', async () => {
      findUnique.mockResolvedValue({
        data: { motivations: ['prove myself'], learningStyle: 'visual' },
      });

      await service.merge('athlete-1', { values: ['work ethic'] });

      const data = upsert.mock.calls[0][0].update.data;
      expect(data.motivations).toEqual(['prove myself']);
      expect(data.learningStyle).toBe('visual');
      expect(data.values).toEqual(['work ethic']);
    });

    it('ignores empty or whitespace-only incoming values', async () => {
      await service.merge('athlete-1', {
        values: ['  '],
        communicationStyle: '   ',
      });

      const data = upsert.mock.calls[0][0].update.data;
      expect(data.values).toBeUndefined();
      expect(data.communicationStyle).toBeUndefined();
    });
  });
});
