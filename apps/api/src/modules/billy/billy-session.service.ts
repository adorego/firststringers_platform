import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
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

  constructor(private readonly redis: RedisService) {}

  async getSession(recruiterId: string): Promise<BillySessionState> {
    const key = this.buildKey(recruiterId);
    const data = await this.redis.get(key);

    if (data) {
      try {
        return JSON.parse(data) as BillySessionState;
      } catch (err) {
        this.logger.warn(
          `Corrupted session for recruiter ${recruiterId}, creating new`,
          err,
        );
      }
    }

    return this.createSession(recruiterId);
  }

  async appendMessage(
    recruiterId: string,
    message: BillyMessage,
  ): Promise<void> {
    const session = await this.getSession(recruiterId);

    session.messages.push(message);
    session.updatedAt = new Date();

    if (session.messages.length > this.MAX_MESSAGES) {
      // Keep first message (welcome) + last N messages
      session.messages = [
        session.messages[0],
        ...session.messages.slice(-this.MAX_MESSAGES + 1),
      ];
    }

    await this.saveSession(recruiterId, session);
  }

  async updateSearchCriteria(
    recruiterId: string,
    newCriteria: Partial<SearchCriteria>,
  ): Promise<void> {
    const session = await this.getSession(recruiterId);
    session.searchCriteria = { ...session.searchCriteria, ...newCriteria };
    session.updatedAt = new Date();
    await this.saveSession(recruiterId, session);
  }

  async clearSession(recruiterId: string): Promise<void> {
    const key = this.buildKey(recruiterId);
    await this.redis.del(key);
  }

  private async createSession(
    recruiterId: string,
  ): Promise<BillySessionState> {
    const session: BillySessionState = {
      recruiterId,
      messages: [],
      searchCriteria: {},
      missingFields: ['sport', 'position', 'leagueLevel'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.saveSession(recruiterId, session);
    return session;
  }

  private async saveSession(
    recruiterId: string,
    session: BillySessionState,
  ): Promise<void> {
    const key = this.buildKey(recruiterId);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  private buildKey(recruiterId: string): string {
    return `billy:session:${recruiterId}`;
  }
}