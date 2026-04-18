import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { JerryGateway } from './jerry.gateway'
import { SessionService } from './session.service'
import { ConversationWorker } from './conversation.worker'
import { IntentClassifierService } from './intent-classifier.service'
import { DataExtractorService } from './data-extractor.service'
import { ValidatorService } from './validator.service'
import { StrategyPlannerService } from './strategy-planner.service'
import { PromptBuilderService } from './prompt-builder.service'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'jerry',
    }),
  ],
  providers: [
    JerryGateway,
    SessionService,
    ConversationWorker,
    IntentClassifierService,
    DataExtractorService,
    ValidatorService,
    StrategyPlannerService,
    PromptBuilderService,
  ],
})
export class JerryModule {}