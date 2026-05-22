import { Module } from '@nestjs/common';
import { ScoutController } from './scout.controller';
import { ScoutService } from './scout.service';

@Module({
  controllers: [ScoutController],
  providers: [ScoutService],
})
export class ScoutModule {}
