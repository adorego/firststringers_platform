import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../shared/redis/redis.service'
import { PrismaService } from '../../shared/prisma/prisma.service'
import {
  JerryMessage,
  JerrySessionState,
  DossierData,
} from '../../shared/types'

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)
  private readonly SESSION_TTL = 60 * 60 * 24
  private readonly MAX_MESSAGES_IN_MEMORY = 20
  private readonly locks = new Map<string, Promise<JerrySessionState>>()

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getSession(athleteId: string): Promise<JerrySessionState> {
    const existing = this.locks.get(athleteId)
    if (existing) return existing

    const promise = this.loadOrCreateSession(athleteId).finally(() => {
      this.locks.delete(athleteId)
    })

    this.locks.set(athleteId, promise)
    return promise
  }

  async appendMessage(
    athleteId: string,
    message: JerryMessage,
  ): Promise<void> {
    const session = await this.getSession(athleteId)

    session.messages.push(message)
    session.updatedAt = new Date()

    if (session.messages.length > this.MAX_MESSAGES_IN_MEMORY) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_IN_MEMORY)
    }

    await this.saveSession(athleteId, session)
  }

  async updateDossierSnapshot(
    athleteId: string,
    newData: Partial<DossierData>,
  ): Promise<void> {
    const session = await this.getSession(athleteId)

    session.dossierSnapshot = this.deepMerge(session.dossierSnapshot, newData)
    session.updatedAt = new Date()

    await this.saveSession(athleteId, session)
  }

  private deepMerge(
    target: Partial<DossierData>,
    source: Partial<DossierData>,
  ): Partial<DossierData> {
    const result = { ...target }
    for (const key of Object.keys(source) as (keyof DossierData)[]) {
      const sourceVal = source[key]
      const targetVal = target[key]
      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        targetVal &&
        typeof targetVal === 'object'
      ) {
        result[key] = { ...targetVal, ...sourceVal } as never
      } else {
        result[key] = sourceVal as never
      }
    }
    return result
  }

  async persistSessionToDb(athleteId: string): Promise<void> {
    const session = await this.getSession(athleteId)

    await this.prisma.jerrySession.create({
      data: {
        athleteId,
        messages: JSON.parse(JSON.stringify(session.messages)),
        status: 'active',
      },
    })
  }

  async clearSession(athleteId: string): Promise<void> {
    const key = this.buildKey(athleteId)
    await this.redis.del(key)
  }

  private async loadOrCreateSession(
    athleteId: string,
  ): Promise<JerrySessionState> {
    const key = this.buildKey(athleteId)
    const data = await this.redis.get(key)

    if (data) {
      try {
        return JSON.parse(data) as JerrySessionState
      } catch (err) {
        this.logger.warn(
          `Corrupted session data for athlete ${athleteId}, creating new session`,
          err,
        )
      }
    }

    return this.createSession(athleteId)
  }

  private async createSession(athleteId: string): Promise<JerrySessionState> {
    const session: JerrySessionState = {
      athleteId,
      messages: [],
      dossierSnapshot: {},
      missingFields: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.saveSession(athleteId, session)
    return session
  }

  private async saveSession(
    athleteId: string,
    session: JerrySessionState,
  ): Promise<void> {
    const key = this.buildKey(athleteId)
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session))
  }

  private buildKey(athleteId: string): string {
    return `jerry:session:${athleteId}`
  }
}
