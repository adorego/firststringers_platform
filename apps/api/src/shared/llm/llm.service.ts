import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'
import { ChatParams, DossierData, JerryIntent } from '../types'

@Injectable()
export class LLMService {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async chat(params: ChatParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: params.systemPrompt,
        },
        ...params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    })

    return response.choices[0]?.message?.content ?? ''
  }

  async extract(
    text: string,
    intent: JerryIntent,
  ): Promise<Partial<DossierData> | null> {
    if (intent === 'question' || intent === 'other') {
      return null
    }

    const schema = this.getSchemaForIntent(intent)

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_data',
            description: 'Extrae datos estructurados del texto del atleta',
            parameters: schema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'extract_data' } },
      messages: [
        {
          role: 'user',
          content: `Extrae los datos de este texto: "${text}"`,
        },
      ],
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall) return null

    try {
      return JSON.parse(toolCall.function.arguments) as Partial<DossierData>
    } catch {
      return null
    }
  }

  async classify(text: string): Promise<JerryIntent> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content: `Clasifica el mensaje del atleta en exactamente una de estas categorías:
            stats, academic, personal, availability, question, other.
            Responde SOLO con la categoría, sin explicación ni puntuación.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    })

    const result =
      response.choices[0]?.message?.content?.trim().toLowerCase() ?? 'other'

    const validIntents: JerryIntent[] = [
      'stats',
      'academic',
      'personal',
      'availability',
      'question',
      'other',
    ]

    return validIntents.includes(result as JerryIntent)
      ? (result as JerryIntent)
      : 'other'
  }

  private getSchemaForIntent(intent: JerryIntent): object {
    const schemas: Record<JerryIntent, object> = {
      stats: {
        type: 'object',
        properties: {
          performance: {
            type: 'object',
            properties: {
              stats: {
                type: 'object',
                additionalProperties: { type: 'number' },
              },
              leagueLevel: { type: 'string' },
            },
          },
        },
      },
      academic: {
        type: 'object',
        properties: {
          academic: {
            type: 'object',
            properties: {
              gpa: { type: 'number' },
              satAct: { type: 'number' },
              intendedMajor: { type: 'string' },
              ncaaEligibility: { type: 'boolean' },
              graduationYear: { type: 'number' },
            },
          },
        },
      },
      personal: {
        type: 'object',
        properties: {
          identity: {
            type: 'object',
            properties: {
              sport: { type: 'string' },
              position: { type: 'string' },
              nationality: { type: 'string' },
              graduationYear: { type: 'number' },
            },
          },
        },
      },
      availability: {
        type: 'object',
        properties: {
          availability: {
            type: 'object',
            properties: {
              transferPortal: { type: 'boolean' },
              preferredRegions: {
                type: 'array',
                items: { type: 'string' },
              },
              scholarshipNeed: { type: 'boolean' },
            },
          },
        },
      },
      question: { type: 'object', properties: {} },
      other: { type: 'object', properties: {} },
    }

    return schemas[intent]
  }
}