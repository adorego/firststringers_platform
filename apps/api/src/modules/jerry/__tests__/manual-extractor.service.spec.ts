import { ManualExtractorService } from '../manual-extractor.service';
import type { LLMService } from '../../../shared/llm/llm.service';
import { JerryIntent } from '../../../shared/types';

describe('ManualExtractorService', () => {
  const extractManualInsights = jest.fn();
  const llm = { extractManualInsights } as unknown as LLMService;
  const service = new ManualExtractorService(llm);

  beforeEach(() => {
    extractManualInsights.mockReset();
    extractManualInsights.mockResolvedValue({ values: ['family'] });
  });

  it.each<JerryIntent>([
    'personal',
    'character',
    'recruiting',
    'availability',
    'other',
  ])('extracts understanding signals for %s messages', async (intent) => {
    const result = await service.extract('my family comes first', intent);
    expect(extractManualInsights).toHaveBeenCalledWith('my family comes first');
    expect(result).toEqual({ values: ['family'] });
  });

  it.each<JerryIntent>(['question', 'stats', 'academic', 'media'])(
    'skips extraction for %s messages',
    async (intent) => {
      const result = await service.extract('I ran a 4.5 forty', intent);
      expect(extractManualInsights).not.toHaveBeenCalled();
      expect(result).toBeNull();
    },
  );
});
