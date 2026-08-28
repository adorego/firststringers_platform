import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from './session.service';
import { IntentClassifierService } from './intent-classifier.service';
import { DataExtractorService } from './data-extractor.service';
import { ValidatorService } from './validator.service';
import { StrategyPlannerService } from './strategy-planner.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RepresentationService } from './representation.service';
import { ManualExtractorService } from './manual-extractor.service';
import { OwnersManualService } from './owners-manual.service';
import { LLMService } from '../../shared/llm/llm.service';
import { MessageJob, InitiateJob, JerryMessage } from '../../shared/types';

@Processor('jerry')
export class ConversationWorker {
  private readonly logger = new Logger(ConversationWorker.name);

  constructor(
    private readonly session: SessionService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly dataExtractor: DataExtractorService,
    private readonly validator: ValidatorService,
    private readonly strategyPlanner: StrategyPlannerService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly representation: RepresentationService,
    private readonly manualExtractor: ManualExtractorService,
    private readonly ownersManual: OwnersManualService,
    private readonly llm: LLMService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('process.initiate')
  async initiate(job: Job<InitiateJob>) {
    const { athleteId } = job.data;

    try {
      const sessionState = await this.session.getSession(athleteId);
      if (sessionState.messages.length > 0) {
        return;
      }

      const missingFields = await this.validator.getMissingFields(athleteId);
      const strategy = this.strategyPlanner.decide({
        intent: 'other',
        missingFields,
        extractedData: null,
        session: sessionState,
      });

      if (strategy.type === 'continuous') {
        await this.representation.markRepresented(athleteId);
      } else {
        await this.representation.ensureActivation(athleteId);
      }

      const manual = await this.ownersManual.get(athleteId);

      const response = await this.llm.chat({
        systemPrompt: this.promptBuilder.build(strategy, manual),
        messages: sessionState.messages,
        extractedData: null,
      });

      const assistantMessage: JerryMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      await this.session.appendMessage(athleteId, assistantMessage);
      await this.persistHistorySafely(athleteId);

      this.eventEmitter.emit('jerry.response', {
        athleteId,
        message: response,
      });
    } catch (error) {
      this.logger.error(
        `Error initiating conversation for athlete ${athleteId}`,
        error,
      );
      this.eventEmitter.emit('jerry.error', {
        athleteId,
        error:
          'Hubo un problema iniciando la conversación. Escríbeme y seguimos desde ahí.',
      });
      throw error;
    }
  }

  @Process('process.message')
  async handle(job: Job<MessageJob>) {
    const { athleteId, message } = job.data;

    try {
      const sessionState = await this.session.getSession(athleteId);
      const askedQuestion = this.lastQuestionAsked(sessionState.messages);
      const intent = await this.intentClassifier.classify(
        message,
        askedQuestion,
      );
      const extractedData = await this.dataExtractor.extract(
        message,
        intent,
        askedQuestion,
      );
      const manualInsights = await this.manualExtractor.extract(
        message,
        intent,
      );
      const missingFields = await this.validator.getMissingFields(athleteId);

      const strategy = this.strategyPlanner.decide({
        intent,
        missingFields,
        extractedData,
        session: sessionState,
      });

      if (strategy.type === 'activation' || strategy.type === 'continuous') {
        await this.representation.markRepresented(athleteId);
      } else {
        await this.representation.ensureActivation(athleteId);
      }

      if (manualInsights) {
        await this.ownersManual.merge(athleteId, manualInsights);
      }

      const manual = await this.ownersManual.get(athleteId);

      const generatedResponse = await this.llm.chat({
        systemPrompt: this.promptBuilder.build(strategy, manual),
        messages: sessionState.messages,
        extractedData,
      });
      const response = this.promptBuilder.enforceConversationLeadership(
        generatedResponse,
        strategy,
      );

      const assistantMessage: JerryMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      await this.session.appendMessage(athleteId, assistantMessage);
      await this.persistHistorySafely(athleteId);

      if (extractedData && Object.keys(extractedData).length > 0) {
        await this.session.updateDossierSnapshot(athleteId, extractedData);
        await this.session.recordUpdate(athleteId, message);

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
      this.logger.error(
        `Error processing message for athlete ${athleteId}`,
        error,
      );
      this.eventEmitter.emit('jerry.error', {
        athleteId,
        error: 'Hubo un problema procesando tu mensaje. Intenta de nuevo.',
      });
      throw error;
    }
  }

  private lastQuestionAsked(messages: JerryMessage[]): string | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'assistant') continue;
      const question = message.content
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => sentence.trim().endsWith('?'))
        .join(' ')
        .trim();
      return question || undefined;
    }
    return undefined;
  }

  // History persistence must never fail the job: a DB hiccup here would
  // trigger a Bull retry that re-runs the LLM calls and duplicates messages.
  private async persistHistorySafely(athleteId: string): Promise<void> {
    try {
      await this.session.persistSessionToDb(athleteId);
    } catch (error) {
      this.logger.warn(
        `Failed to persist conversation history for athlete ${athleteId}`,
        error,
      );
    }
  }
}
