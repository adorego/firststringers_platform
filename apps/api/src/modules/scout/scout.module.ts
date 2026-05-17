import { Module } from '@nestjs/common';
import { ScoutController } from './scout.controller';
import { ScoutService } from './scout.service';
import { RankingService } from './ranking.service';

@Module({
  controllers: [ScoutController],
  providers: [ScoutService, RankingService],
  exports: [ScoutService, RankingService],
})
export class ScoutModule {}