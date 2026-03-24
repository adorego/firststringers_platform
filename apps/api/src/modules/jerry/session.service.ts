import { Injectable } from '@nestjs/common'
import { RedisService } from '../../shared/redis/redis.service'
import { PrismaService } from '../../shared/prisma/prisma.service'
import {
  JerryMessage,
  JerrySessionState,
  DossierData,
} from '../../shared/types'

@Injectable()
export class SessionService {
  private readonly SESSION_TTL = 60 * 60 * 24
  private readonly MAX_MESSAGES_IN_MEMORY = 20

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getSession(athleteId: string): Promise<JerrySessionState> {
    const key = this.buildKey(athleteId)
    const data = await this.redis.get(key)

    if (data) {
      return JSON.parse(data) as JerrySessionState
    }

    return this.createSession(athleteId)
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

    session.dossierSnapshot = {
      ...session.dossierSnapshot,
      ...newData,
    }
    session.updatedAt = new Date()

    await this.saveSession(athleteId, session)
  }

  async persistSessionToDb(athleteId: string): Promise<void> {
    const session = await this.getSession(athleteId)

    await this.prisma.jerrySession.create({
      data: {
        athleteId,
        messages: session.messages as any,
        status: 'active',
      },
    })
  }

  async clearSession(athleteId: string): Promise<void> {
    const key = this.buildKey(athleteId)
    await this.redis.del(key)
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