import { Injectable } from '@nestjs/common'
import { LLMService } from '../../shared/llm/llm.service'
import { JerryIntent } from '../../shared/types'

@Injectable()
export class IntentClassifierService {
  constructor(private readonly llm: LLMService) {}

  // istanbul ignore next — delegación directa sin lógica propia; cubierto vía LLMService
  async classify(message: string): Promise<JerryIntent> {
    return this.llm.classify(message)
  }
}