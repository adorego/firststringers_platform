import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  list(@CurrentUser() user: { recruiterId: string }) {
    return this.pipelineService.list(user.recruiterId);
  }

  @Post()
  add(
    @CurrentUser() user: { recruiterId: string },
    @Body() body: { athleteId: string },
  ) {
    return this.pipelineService.add(user.recruiterId, body.athleteId);
  }

  @Delete(':athleteId')
  remove(
    @CurrentUser() user: { recruiterId: string },
    @Param('athleteId') athleteId: string,
  ) {
    return this.pipelineService.remove(user.recruiterId, athleteId);
  }
}
