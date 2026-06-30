import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { JerryController } from './jerry.controller';
import { JerryGateway } from './jerry.gateway';
import { SessionService } from './session.service';
import { ConversationWorker } from './conversation.worker';
import { IntentClassifierService } from './intent-classifier.service';
import { DataExtractorService } from './data-extractor.service';
import { ValidatorService } from './validator.service';
import { StrategyPlannerService } from './strategy-planner.service';
import { PromptBuilderService } from './prompt-builder.service';
import { JerryPitchService } from './jerry-pitch.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'jerry',
    }),
  ],
  controllers: [JerryController],
  providers: [
    JerryGateway,
    SessionService,
    ConversationWorker,
    IntentClassifierService,
    DataExtractorService,
    ValidatorService,
    StrategyPlannerService,
    PromptBuilderService,
    JerryPitchService,
  ],
  exports: [JerryPitchService],
})
export class JerryModule {}
