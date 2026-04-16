import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RedisModule } from './shared/redis/redis.module'
import { LLMModule } from './shared/llm/llm.module'
import { AuthModule } from './modules/auth/auth.module'
import { JerryModule } from './modules/jerry/jerry.module'
import { DossierModule } from './modules/dossier/dossier.module'
import { JwtAuthGuard } from './modules/auth/auth.guard'
import { RolesGuard } from './modules/auth/roles.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    RedisModule,
    LLMModule,
    AuthModule,
    JerryModule,
    DossierModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
