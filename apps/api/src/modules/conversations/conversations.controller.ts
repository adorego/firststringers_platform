import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ConversationsService } from './conversations.service';

@Public()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('recruiter/:recruiterId')
  getForRecruiter(@Param('recruiterId') recruiterId: string) {
    return this.conversationsService.getConversationsForRecruiter(recruiterId);
  }

  @Get('athlete/:athleteId')
  getForAthlete(@Param('athleteId') athleteId: string) {
    return this.conversationsService.getConversationsForAthlete(athleteId);
  }

  @Post()
  create(@Body() dto: { recruiterId: string; athleteId: string }) {
    return this.conversationsService.getOrCreateConversation(dto.recruiterId, dto.athleteId);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.conversationsService.getMessages(id);
  }
}
