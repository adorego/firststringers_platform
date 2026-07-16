import { Injectable } from '@nestjs/common';
import { LLMService } from '../../shared/llm/llm.service';
import { JerryIntent, OwnersManualData } from '../../shared/types';

const UNDERSTANDING_INTENTS: JerryIntent[] = [
  'personal',
  'character',
  'recruiting',
  'availability',
  'other',
];

@Injectable()
export class ManualExtractorService {
  constructor(private readonly llm: LLMService) {}

  async extract(
    message: string,
    intent: JerryIntent,
  ): Promise<Partial<OwnersManualData> | null> {
    if (!UNDERSTANDING_INTENTS.includes(intent)) {
      return null;
    }

    return this.llm.extractManualInsights(message);
  }
}
