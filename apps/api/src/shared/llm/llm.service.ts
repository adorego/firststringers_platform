import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  ChatParams,
  DossierData,
  JerryIntent,
  OwnersManualData,
} from '../types';

const LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing required environment variable: OPENAI_API_KEY');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: LLM_TIMEOUT_MS,
    });
  }

  async chat(params: ChatParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      this.logger.warn('LLM chat returned empty content');
      return '';
    }

    return content;
  }

  async extract(
    text: string,
    intent: JerryIntent,
  ): Promise<Partial<DossierData> | null> {
    if (intent === 'question' || intent === 'other') {
      return null;
    }

    const schema = this.getSchemaForIntent(intent);

    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      max_tokens: 1024,
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_data',
            description: 'Extracts structured data from the athlete text',
            parameters: schema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'extract_data' } },
      messages: [
        {
          role: 'user',
          content: `Extract the data from this text: "${text}"`,
        },
      ],
    });

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') return null;

    try {
      return JSON.parse(toolCall.function.arguments) as Partial<DossierData>;
    } catch {
      return null;
    }
  }

  async extractManualInsights(
    text: string,
  ): Promise<Partial<OwnersManualData> | null> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      max_tokens: 1024,
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_understanding',
            description:
              'Extracts signals about who the athlete is as a person: what motivates them, what they value, how they communicate and make decisions, which environments help or limit them, and what they aspire to become. Only include a field when the text genuinely reveals it. Return an empty object when the text contains no such signal. Never infer or invent.',
            parameters: this.manualInsightsSchema(),
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'extract_understanding' },
      },
      messages: [
        {
          role: 'user',
          content: `Extract understanding signals from this athlete message: "${text}"`,
        },
      ],
    });

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') return null;

    try {
      const parsed = JSON.parse(
        toolCall.function.arguments,
      ) as Partial<OwnersManualData>;
      return Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  private manualInsightsSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        motivations: { type: 'array', items: { type: 'string' } },
        values: { type: 'array', items: { type: 'string' } },
        longTermAspirations: { type: 'array', items: { type: 'string' } },
        communicationStyle: { type: 'string' },
        learningStyle: { type: 'string' },
        decisionMaking: { type: 'string' },
        competitiveIdentity: { type: 'string' },
        preferredEnvironments: { type: 'array', items: { type: 'string' } },
        limitingEnvironments: { type: 'array', items: { type: 'string' } },
        supportSystem: { type: 'string' },
      },
    };
  }

  async classify(text: string): Promise<JerryIntent> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content: `Classify the athlete's message into exactly one of these categories:
            stats, academic, personal, availability, media, character, recruiting, question, other.
            - stats: athletic performance, metrics, records, game statistics, physical measurables (height, weight, dominant side), injury/physical status
            - academic: GPA, test scores, major, academic interests
            - personal: name, sport, position, location, school, club, graduation year
            - availability: transfer portal, regions, scholarship needs
            - media: highlights, clips, social media, references, training content
            - character: mentality, leadership, coachability, resilience, motivation, growth
            - recruiting: goals, timeline, target programs, competitive level preferences, limitations
            - question: athlete asking a question
            - other: anything else
            Respond with ONLY the category, no explanation or punctuation.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const result =
      response.choices?.[0]?.message?.content?.trim().toLowerCase() ?? 'other';

    const validIntents: JerryIntent[] = [
      'stats',
      'academic',
      'personal',
      'availability',
      'media',
      'character',
      'recruiting',
      'question',
      'other',
    ];

    return validIntents.includes(result as JerryIntent)
      ? (result as JerryIntent)
      : 'other';
  }

  private getSchemaForIntent(intent: JerryIntent): Record<string, unknown> {
    const schemas: Record<JerryIntent, Record<string, unknown>> = {
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
              physicalProfile: {
                type: 'object',
                properties: {
                  height: { type: 'string' },
                  weight: { type: 'string' },
                  speed: { type: 'string' },
                  vertical: { type: 'string' },
                  dominantSide: { type: 'string' },
                },
              },
              strengths: {
                type: 'array',
                items: { type: 'string' },
              },
              physicalStatus: { type: 'string' },
              archetype: { type: 'string' },
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
              academicInterests: {
                type: 'array',
                items: { type: 'string' },
              },
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
              location: { type: 'string' },
              school: { type: 'string' },
              club: { type: 'string' },
              competitiveLevel: { type: 'string' },
              nationality: { type: 'string' },
              graduationYear: { type: 'number' },
            },
          },
          performance: {
            type: 'object',
            properties: {
              physicalProfile: {
                type: 'object',
                properties: {
                  height: { type: 'string' },
                  weight: { type: 'string' },
                  dominantSide: { type: 'string' },
                },
              },
              physicalStatus: { type: 'string' },
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
              timeline: { type: 'string' },
              relocationOpenness: { type: 'string' },
              nonNegotiables: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      media: {
        type: 'object',
        properties: {
          media: {
            type: 'object',
            properties: {
              highlightUrls: {
                type: 'array',
                items: { type: 'string' },
              },
              clipUrls: {
                type: 'array',
                items: { type: 'string' },
              },
              socialMedia: {
                type: 'object',
                properties: {
                  instagram: { type: 'string' },
                  twitter: { type: 'string' },
                  hudl: { type: 'string' },
                  other: { type: 'string' },
                },
              },
              references: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      character: {
        type: 'object',
        properties: {
          character: {
            type: 'object',
            properties: {
              mentality: { type: 'string' },
              leadership: { type: 'string' },
              coachability: { type: 'string' },
              resilience: { type: 'string' },
              motivation: { type: 'string' },
              growthAreas: {
                type: 'array',
                items: { type: 'string' },
              },
              selfRepresentation: { type: 'string' },
            },
          },
        },
      },
      recruiting: {
        type: 'object',
        properties: {
          availability: {
            type: 'object',
            properties: {
              timeline: { type: 'string' },
              competitiveLevelGoal: { type: 'string' },
              goals: {
                type: 'array',
                items: { type: 'string' },
              },
              limitations: {
                type: 'array',
                items: { type: 'string' },
              },
              relocationOpenness: { type: 'string' },
              nonNegotiables: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      question: { type: 'object', properties: {} },
      other: { type: 'object', properties: {} },
    };

    return schemas[intent];
  }
}
