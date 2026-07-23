import { Injectable } from '@nestjs/common';
import { LLMService } from '../../shared/llm/llm.service';
import { DossierData, JerryIntent } from '../../shared/types';
import { enhanceJerryExtraction } from './extraction-heuristics';

@Injectable()
export class DataExtractorService {
  constructor(private readonly llm: LLMService) {}

  async extract(
    text: string,
    intent: JerryIntent,
  ): Promise<Partial<DossierData> | null> {
    if (intent === 'question' || intent === 'other') {
      return null;
    }

    const extractedData = await this.llm.extract(text, intent);
    return enhanceJerryExtraction(text, extractedData);
  }
}
