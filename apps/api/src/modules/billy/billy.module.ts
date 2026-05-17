import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillyGateway } from './billy.gateway';
import { BillySessionService } from './billy-session.service';
import { BillyWorker } from './billy.worker';
import { ScoutModule } from '../scout/scout.module';
import { JerryModule } from '../jerry/jerry.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'billy' }),
    ScoutModule,
    JerryModule,
  ],
  providers: [
    BillyGateway,
    BillySessionService,
    BillyWorker,
  ],
})
export class BillyModule {}