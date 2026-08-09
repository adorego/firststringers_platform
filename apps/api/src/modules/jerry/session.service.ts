import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@firststringers/database';
import { RedisService } from '../../shared/redis/redis.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  JerryMessage,
  JerrySessionState,
  DossierData,
} from '../../shared/types';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_TTL = 60 * 60 * 24;
  private readonly MAX_MESSAGES_IN_MEMORY = 20;
  private readonly locks = new Map<string, Promise<JerrySessionState>>();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getSession(athleteId: string): Promise<JerrySessionState> {
    const existing = this.locks.get(athleteId);
    if (existing) return existing;

    const promise = this.loadOrCreateSession(athleteId).finally(() => {
      this.locks.delete(athleteId);
    });

    this.locks.set(athleteId, promise);
    return promise;
  }

  async appendMessage(athleteId: string, message: JerryMessage): Promise<void> {
    const session = await this.getSession(athleteId);

    session.messages.push(message);
    session.updatedAt = new Date();

    if (session.messages.length > this.MAX_MESSAGES_IN_MEMORY) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_IN_MEMORY);
    }

    await this.saveSession(athleteId, session);
  }

  async updateDossierSnapshot(
    athleteId: string,
    newData: Partial<DossierData>,
  ): Promise<void> {
    const session = await this.getSession(athleteId);

    session.dossierSnapshot = this.deepMerge(session.dossierSnapshot, newData);
    session.updatedAt = new Date();

    await this.saveSession(athleteId, session);
  }

  private deepMerge(
    target: Partial<DossierData>,
    source: Partial<DossierData>,
  ): Partial<DossierData> {
    const result = { ...target };
    for (const key of Object.keys(source) as (keyof DossierData)[]) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        targetVal &&
        typeof targetVal === 'object'
      ) {
        result[key] = { ...targetVal, ...sourceVal } as never;
      } else {
        result[key] = sourceVal as never;
      }
    }
    return result;
  }

  // Logs the athlete's own words whenever Jerry extracts something concrete
  // from them (stats, a game result, an achievement, etc.) — this is what the
  // recruiter's Pipeline shows as "latest update" before falling back to
  // Jerry's AI-generated pitch.
  async recordUpdate(athleteId: string, content: string): Promise<void> {
    const trimmed = content.trim().slice(0, 500);
    if (!trimmed) return;

    await this.prisma.athleteUpdate.create({
      data: { athleteId, content: trimmed },
    });
  }

  async persistSessionToDb(athleteId: string): Promise<void> {
    const session = await this.getSession(athleteId);

    const existing = await this.prisma.jerrySession.findUnique({
      where: { athleteId },
      select: { messages: true },
    });
    const stored = Array.isArray(existing?.messages)
      ? (existing.messages as unknown as JerryMessage[])
      : [];
    const merged = this.mergeHistories(stored, session.messages);

    await this.prisma.jerrySession.upsert({
      where: { athleteId },
      update: {
        messages: merged as unknown as Prisma.InputJsonValue,
        status: 'active',
      },
      create: {
        athleteId,
        messages: merged as unknown as Prisma.InputJsonValue,
        status: 'active',
      },
    });
  }

  // Redis keeps only the last MAX_MESSAGES_IN_MEMORY messages, while the DB row
  // holds the full history — append only what the DB has not seen yet.
  private mergeHistories(
    stored: JerryMessage[],
    recent: JerryMessage[],
  ): JerryMessage[] {
    if (stored.length === 0) return [...recent];

    const lastStoredTime = this.messageTime(stored[stored.length - 1]);
    const storedTail = stored.filter(
      (message) => this.messageTime(message) === lastStoredTime,
    );

    const fresh = recent.filter((message) => {
      const time = this.messageTime(message);
      if (time > lastStoredTime) return true;
      if (time < lastStoredTime) return false;
      return !storedTail.some(
        (tail) => tail.role === message.role && tail.content === message.content,
      );
    });

    return [...stored, ...fresh];
  }

  private messageTime(message: JerryMessage): number {
    const time = new Date(
      message.timestamp as unknown as string | Date,
    ).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  async clearSession(athleteId: string): Promise<void> {
    const key = this.buildKey(athleteId);
    await this.redis.del(key);
  }

  private async loadOrCreateSession(
    athleteId: string,
  ): Promise<JerrySessionState> {
    const key = this.buildKey(athleteId);
    const data = await this.redis.get(key);

    if (data) {
      try {
        return JSON.parse(data) as JerrySessionState;
      } catch (err) {
        this.logger.warn(
          `Corrupted session data for athlete ${athleteId}, creating new session`,
          err,
        );
      }
    }

    const restored = await this.restoreSessionFromDb(athleteId);
    if (restored) return restored;

    return this.createSession(athleteId);
  }

  // The Redis session expires after SESSION_TTL; the DB row is the durable
  // history, so a returning athlete resumes their conversation instead of
  // being greeted from scratch.
  private async restoreSessionFromDb(
    athleteId: string,
  ): Promise<JerrySessionState | null> {
    try {
      const stored = await this.prisma.jerrySession.findUnique({
        where: { athleteId },
        select: { messages: true, createdAt: true },
      });
      const messages = Array.isArray(stored?.messages)
        ? (stored.messages as unknown as JerryMessage[])
        : [];
      if (messages.length === 0) return null;

      const session: JerrySessionState = {
        athleteId,
        messages: messages.slice(-this.MAX_MESSAGES_IN_MEMORY),
        dossierSnapshot: {},
        missingFields: [],
        createdAt: stored.createdAt,
        updatedAt: new Date(),
      };
      await this.saveSession(athleteId, session);
      return session;
    } catch (err) {
      this.logger.warn(
        `Could not restore session from DB for athlete ${athleteId}`,
        err,
      );
      return null;
    }
  }

  private async createSession(athleteId: string): Promise<JerrySessionState> {
    const session: JerrySessionState = {
      athleteId,
      messages: [],
      dossierSnapshot: {},
      missingFields: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveSession(athleteId, session);
    return session;
  }

  private async saveSession(
    athleteId: string,
    session: JerrySessionState,
  ): Promise<void> {
    const key = this.buildKey(athleteId);
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  private buildKey(athleteId: string): string {
    return `jerry:session:${athleteId}`;
  }
}
