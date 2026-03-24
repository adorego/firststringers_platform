import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

    this.client.on('connect', () => {
      console.log('Redis connected')
    })

    this.client.on('error', (err) => {
      console.error('Redis error:', err)
    })
  }

  async onModuleDestroy() {
    await this.client.quit()
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value)
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setex(key, ttl, value)
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  getClient(): Redis {
    return this.client
  }
}