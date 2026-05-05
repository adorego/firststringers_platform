import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from './session.service';
import { IntentClassifierService } from './intent-classifier.service';
import { DataExtractorService } from './data-extractor.service';
import { ValidatorService } from './validator.service';
import { StrategyPlannerService } from './strategy-planner.service';
import { PromptBuilderService } from './prompt-builder.service';
import { LLMService } from '../../shared/llm/llm.service';
import { MessageJob, JerryMessage } from '../../shared/types';

@Processor('jerry')
export class ConversationWorker {
  constructor(
    private readonly session: SessionService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly dataExtractor: DataExtractorService,
    private readonly validator: ValidatorService,
    private readonly strategyPlanner: StrategyPlannerService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly llm: LLMService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('process.message')
  async handle(job: Job<MessageJob>) {
    const { athleteId, message } = job.data;

    try {
      const sessionState = await this.session.getSession(athleteId);
      const intent = await this.intentClassifier.classify(message);
      const extractedData = await this.dataExtractor.extract(message, intent);
      const missingFields = await this.validator.getMissingFields(athleteId);

      const strategy = this.strategyPlanner.decide({
        intent,
        missingFields,
        extractedData,
        session: sessionState,
      });

      const response = await this.llm.chat({
        systemPrompt: this.promptBuilder.build(strategy),
        messages: sessionState.messages,
        extractedData,
      });

      const assistantMessage: JerryMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      await this.session.appendMessage(athleteId, assistantMessage);

      if (extractedData && Object.keys(extractedData).length > 0) {
        await this.session.updateDossierSnapshot(athleteId, extractedData);

        this.eventEmitter.emit('dossier.update', {
          athleteId,
          newData: extractedData,
        });
      }

      this.eventEmitter.emit('jerry.response', {
        athleteId,
        message: response,
      });
    } catch (error) {
      this.eventEmitter.emit('jerry.error', {
        athleteId,
        error: 'Hubo un problema procesando tu mensaje. Intenta de nuevo.',
      });
      throw error;
    }
  }
}
