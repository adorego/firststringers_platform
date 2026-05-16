import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillyGateway } from './billy.gateway';
import { BillySessionService } from './billy-session.service';
import { BillyWorker } from './billy.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'billy' }),
  ],
  providers: [
    BillyGateway,
    BillySessionService,
    BillyWorker,
  ],
})
export class BillyModule {}