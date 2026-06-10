import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // Authenticated: athleteId comes from the JWT, not the URL
  @Get('me')
  getMine(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.conversationsService.getConversationsForAthlete(
      user.athleteId,
    );
  }

  @Public()
  @Get('recruiter/:recruiterId')
  getForRecruiter(@Param('recruiterId') recruiterId: string) {
    return this.conversationsService.getConversationsForRecruiter(recruiterId);
  }

  @Public()
  @Get('athlete/:athleteId')
  getForAthlete(@Param('athleteId') athleteId: string) {
    return this.conversationsService.getConversationsForAthlete(athleteId);
  }

  @Public()
  @Post()
  create(@Body() dto: { recruiterId: string; athleteId: string }) {
    return this.conversationsService.getOrCreateConversation(
      dto.recruiterId,
      dto.athleteId,
    );
  }

  @Public()
  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.conversationsService.getMessages(id);
  }
}
