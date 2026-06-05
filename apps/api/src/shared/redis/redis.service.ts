import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      // Exponential backoff: 500ms → 1s → 2s → … capped at 30s
      retryStrategy: (times) => Math.min(500 * 2 ** times, 30_000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting…'));
    this.client.on('error', (err: Error) => this.logger.error('Redis error', err.message));

    try {
      await this.client.connect();
    } catch {
      // Redis not reachable yet — retryStrategy will keep retrying in background.
      // ioredis queues commands until the connection is established (enableOfflineQueue: true by default).
      this.logger.warn('Redis unavailable on startup — retrying in background');
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setex(key, ttl, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  getClient(): Redis {
    return this.client;
  }
}
