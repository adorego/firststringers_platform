import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { LLMModule } from './shared/llm/llm.module';
import { JerryModule } from './modules/jerry/jerry.module';
import { DossierModule } from './modules/dossier/dossier.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    PrismaModule,
    RedisModule,
    LLMModule,
    JerryModule,
    DossierModule,
    HealthModule,
  ],
})
export class AppModule {}
