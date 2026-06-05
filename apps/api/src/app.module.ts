import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { LLMModule } from './shared/llm/llm.module';
import { AuthModule } from './modules/auth/auth.module';
import { AthleteModule } from './modules/athlete/athlete.module';
import { JerryModule } from './modules/jerry/jerry.module';
import { DossierModule } from './modules/dossier/dossier.module';
import { ScoutModule } from './modules/scout/scout.module';
import { JwtAuthGuard } from './modules/auth/auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { BillyModule } from './modules/billy/billy.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    PrismaModule,
    RedisModule,
    LLMModule,
    AuthModule,
    AthleteModule,
    JerryModule,
    DossierModule,
    ScoutModule,
    HealthModule,
    BillyModule,
    ScoutModule,
    ConversationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
