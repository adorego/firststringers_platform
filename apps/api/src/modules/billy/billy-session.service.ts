import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { BillyConversationService } from './billy-conversation.service';
import {
  BillyMessage,
  BillySessionState,
  SearchCriteria,
} from '../../shared/types/billy.types';

@Injectable()
export class BillySessionService {
  private readonly logger = new Logger(BillySessionService.name);
  private readonly SESSION_TTL = 60 * 60 * 24; // 24h
  private readonly MAX_MESSAGES = 30;
  private readonly PENDING_SUGGESTIONS_TTL = 60 * 10; // 10min

  constructor(
    private readonly redis: RedisService,
    private readonly conversations: BillyConversationService,
  ) {}

  // `isOnboarding` is only known authoritatively by the caller (the gateway, which
  // reads it fresh from the recruiter's DB record) — pass it explicitly to override
  // the cached value. Internal callers that just need the current session (appendMessage,
  // the worker, etc.) omit it so they don't accidentally clobber the flag back to false.
  async getSession(
    conversationId: string,
    recruiterId: string,
    isOnboarding?: boolean,
  ): Promise<BillySessionState> {
    const key = this.buildKey(conversationId);
    const data = await this.redis.get(key);

    if (data) {
      try {
        const cached = JSON.parse(data) as BillySessionState;
        if (isOnboarding !== undefined) {
          cached.isOnboarding = isOnboarding;
        }
        return cached;
      } catch (err) {
        this.logger.warn(
          `Corrupted session for conversation ${conversationId}, loading from DB`,
          err,
        );
      }
    }

    // Redis miss — warm from DB
    const messages = await this.conversations.getMessages(conversationId);
    const searchCriteria =
      await this.conversations.getSearchCriteria(conversationId);

    const session: BillySessionState = {
      conversationId,
      recruiterId,
      messages,
      searchCriteria,
      missingFields: ['sport', 'position', 'leagueLevel'],
      isOnboarding: isOnboarding ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveSession(conversationId, session);
    return session;
  }

  async appendMessage(
    conversationId: string,
    recruiterId: string,
    message: BillyMessage,
  ): Promise<void> {
    const session = await this.getSession(conversationId, recruiterId);
    session.messages.push(message);
    session.updatedAt = new Date();

    if (session.messages.length > this.MAX_MESSAGES) {
      session.messages = [
        session.messages[0],
        ...session.messages.slice(-this.MAX_MESSAGES + 1),
      ];
    }

    await this.saveSession(conversationId, session);
  }

  async updateSearchCriteria(
    conversationId: string,
    recruiterId: string,
    newCriteria: Partial<SearchCriteria>,
  ): Promise<void> {
    const session = await this.getSession(conversationId, recruiterId);
    session.searchCriteria = { ...session.searchCriteria, ...newCriteria };
    session.updatedAt = new Date();
    await this.saveSession(conversationId, session);
  }

  async setOnboardingComplete(
    conversationId: string,
    recruiterId: string,
  ): Promise<void> {
    const session = await this.getSession(conversationId, recruiterId);
    session.isOnboarding = false;
    await this.saveSession(conversationId, session);
  }

  async clearSession(conversationId: string): Promise<void> {
    await this.redis.del(this.buildKey(conversationId));
  }

  // Bridges onboarding completion (old conversation) to the first message of the
  // fresh conversation Billy opens right after — short-lived, consumed on next connect.
  async setPendingSuggestions(
    recruiterId: string,
    suggestions: string[],
  ): Promise<void> {
    await this.redis.setex(
      this.buildPendingKey(recruiterId),
      this.PENDING_SUGGESTIONS_TTL,
      JSON.stringify(suggestions),
    );
  }

  async getAndClearPendingSuggestions(
    recruiterId: string,
  ): Promise<string[] | null> {
    const key = this.buildPendingKey(recruiterId);
    const data = await this.redis.get(key);
    if (!data) return null;
    await this.redis.del(key);
    try {
      return JSON.parse(data) as string[];
    } catch {
      return null;
    }
  }

  private async saveSession(
    conversationId: string,
    session: BillySessionState,
  ): Promise<void> {
    await this.redis.setex(
      this.buildKey(conversationId),
      this.SESSION_TTL,
      JSON.stringify(session),
    );
  }

  private buildKey(conversationId: string): string {
    return `billy:session:${conversationId}`;
  }

  private buildPendingKey(recruiterId: string): string {
    return `billy:pending-suggestions:${recruiterId}`;
  }
}
