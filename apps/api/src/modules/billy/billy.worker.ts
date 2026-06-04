import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import { BillySessionService } from './billy-session.service';
import { BillyConversationService } from './billy-conversation.service';
import { BillyMessage, BillyMessageJob } from '../../shared/types/billy.types';
import { ScoutService } from '../scout/scout.service';

const SYSTEM_PROMPT = `You are Billy, an intelligent sports recruitment assistant helping a coach or recruiter find the right athlete.

Your job is to gather the following information through natural conversation:
1. Sport (football, basketball, soccer, baseball, etc.)
2. Position (QB, WR, PG, SF, etc.)
3. Academic requirements (minimum GPA)
4. Graduation year or eligibility year
5. Geographic preference (region or state)
6. Transfer portal preference (yes/no)
7. NCAA eligibility requirement (yes/no)
8. Any specific physical attributes or playing style

Rules:
- Ask ONE question at a time, never multiple
- Be conversational and brief — max 2 sentences per message
- After gathering enough info (at least sport + position + one more criteria), offer to search
- When you have enough information, respond with a JSON block at the end of your message in this exact format:
  [SEARCH_READY]{"query": "the full natural language query", "filters": {"sport": "...", "position": "...", "minGpa": 0.0, "graduationYear": 0, "transferPortal": true/false, "ncaaEligible": true/false}}[/SEARCH_READY]
- If the user says they want to search now, generate the search immediately
- Keep a friendly, professional tone`;

@Processor('billy')
export class BillyWorker {
  private readonly logger = new Logger(BillyWorker.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly session: BillySessionService,
    private readonly conversations: BillyConversationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly scout: ScoutService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  @Process('process.message')
  async handle(job: Job<BillyMessageJob>) {
    const { conversationId, recruiterId, message } = job.data;

    try {
      const sessionState = await this.session.getSession(conversationId, recruiterId);

      const messages = sessionState.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
        max_tokens: 300,
      });

      const rawContent = response.choices[0].message.content ?? '';

      const searchMatch = rawContent.match(/\[SEARCH_READY\](.*?)\[\/SEARCH_READY\]/s);
      let visibleContent = rawContent;
      let searchResults: unknown[] | undefined;
      let extractedFilters: Record<string, unknown> | undefined;

      if (searchMatch) {
        try {
          const parsed = JSON.parse(searchMatch[1]) as {
            query: string;
            filters: Record<string, unknown>;
          };
          visibleContent =
            rawContent.replace(/\[SEARCH_READY\].*?\[\/SEARCH_READY\]/s, '').trim() ||
            'Great! I have everything I need. Launching search...';

          extractedFilters = parsed.filters;
          await this.session.updateSearchCriteria(conversationId, recruiterId, parsed.filters as never);
          searchResults = await this.runSearch(parsed.filters);
        } catch {
          // keep raw content if parse fails
        }
      }

      const assistantMessage: BillyMessage = {
        role: 'assistant',
        content: visibleContent,
        timestamp: new Date(),
      };
      await this.session.appendMessage(conversationId, recruiterId, assistantMessage);

      // Persist full conversation to DB
      try {
        const updatedSession = await this.session.getSession(conversationId, recruiterId);
        await this.conversations.persistMessages(
          conversationId,
          updatedSession.messages,
          updatedSession.searchCriteria,
        );

        // Auto-title: use first user message if title is still default
        const firstUserMsg = updatedSession.messages.find((m) => m.role === 'user');
        if (firstUserMsg && message === firstUserMsg.content) {
          const title = firstUserMsg.content.slice(0, 50).trim();
          await this.conversations.updateTitle(conversationId, title);
        }
      } catch (dbErr) {
        this.logger.warn(`Could not persist messages for conversation ${conversationId}`, dbErr);
      }

      this.eventEmitter.emit('billy.response', {
        conversationId,
        message: visibleContent,
        searchCriteria: extractedFilters,
        searchResults,
      });
    } catch (error) {
      this.logger.error(`Error processing Billy message for conversation ${conversationId}`, error);
      this.eventEmitter.emit('billy.error', {
        conversationId,
        error: 'Error processing your message. Please try again.',
      });
      throw error;
    }
  }

  private async runSearch(filters: Record<string, unknown>): Promise<unknown[]> {
    try {
      this.logger.log(`Running search with filters: ${JSON.stringify(filters)}`);
      const result = await this.scout.search(
        (filters['query'] as string) ?? '',
        filters as any,
        5,
      );
      this.logger.log(`Scout found ${result.athletes.length} athletes`);
      return result.athletes;
    } catch (error) {
      this.logger.error('Scout search failed', error);
      return [];
    }
  }
}
