import { Processor, Process } from '@nestjs/bull'
import type { Job } from 'bull'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SessionService } from './session.service'
import { IntentClassifierService } from './intent-classifier.service'
import { DataExtractorService } from './data-extractor.service'
import { ValidatorService } from './validator.service'
import { LLMService } from '../../shared/llm/llm.service'
import { MessageJob, JerryMessage } from '../../shared/types'

@Processor('jerry')
export class ConversationWorker {
  constructor(
    private readonly session: SessionService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly dataExtractor: DataExtractorService,
    private readonly validator: ValidatorService,
    private readonly llm: LLMService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('process.message')
  async handle(job: Job<MessageJob>) {
    const { athleteId, message } = job.data

    try {
      const sessionState = await this.session.getSession(athleteId)
      const intent = await this.intentClassifier.classify(message)
      const extractedData = await this.dataExtractor.extract(message, intent)
      const missingFields = await this.validator.getMissingFields(athleteId)

      const response = await this.llm.chat({
        systemPrompt: this.buildSystemPrompt(missingFields),
        messages: sessionState.messages,
        extractedData,
      })

      const assistantMessage: JerryMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      await this.session.appendMessage(athleteId, assistantMessage)

      if (extractedData && Object.keys(extractedData).length > 0) {
        await this.session.updateDossierSnapshot(athleteId, extractedData)

        this.eventEmitter.emit('dossier.update', {
          athleteId,
          newData: extractedData,
        })
      }

      this.eventEmitter.emit('jerry.response', {
        athleteId,
        message: response,
      })
    } catch (error) {
      this.eventEmitter.emit('jerry.error', {
        athleteId,
        error: 'Hubo un problema procesando tu mensaje. Intenta de nuevo.',
      })
      throw error
    }
  }

  private buildSystemPrompt(missingFields: string[]): string {
    const fieldsText =
      missingFields.length > 0
        ? `Campos que aún necesitas recopilar: ${missingFields.join(', ')}.`
        : 'El dossier está completo. Enfócate en refinar la narrativa.'

    return `
      Eres Jerry, el agente de representación deportiva de First Stringers.
      Tu misión es ayudar a los atletas a construir su dossier de reclutamiento.

      ${fieldsText}

      Reglas:
      - Haz solo UNA pregunta a la vez
      - Sé conversacional y empático, no un formulario
      - Si el atleta da información voluntariamente, úsala sin volver a pedirla
      - Celebra los logros del atleta
      - Responde siempre en español
      - Mensajes cortos y directos, máximo 3 oraciones
    `
  }
}