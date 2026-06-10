import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillyGateway } from './billy.gateway';
import { BillySessionService } from './billy-session.service';
import { BillyWorker } from './billy.worker';
import { BillyConversationService } from './billy-conversation.service';
import { BillyConversationController } from './billy-conversation.controller';
import { ScoutModule } from '../scout/scout.module';
import { JerryModule } from '../jerry/jerry.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'billy' }),
    ScoutModule,
    JerryModule,
  ],
  controllers: [BillyConversationController],
  providers: [
    BillyGateway,
    BillySessionService,
    BillyWorker,
    BillyConversationService,
  ],
})
export class BillyModule {}
