import {
  Controller,
  Get,
  Post,
  Patch,
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

  // Athlete: accepted conversations only
  @Get('me')
  getMine(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.conversationsService.getConversationsForAthlete(user.athleteId);
  }

  // Athlete: pending connection requests
  @Get('me/requests')
  getPendingRequests(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.conversationsService.getPendingRequestsForAthlete(user.athleteId);
  }

  // Athlete: accept a connection request
  @Patch(':id/accept')
  acceptRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.conversationsService.acceptRequest(id, user.athleteId);
  }

  // Athlete: decline a connection request
  @Patch(':id/decline')
  declineRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.conversationsService.declineRequest(id, user.athleteId);
  }

  // Counts for the nav badges (JWT-authenticated, uses own identity) — shape
  // differs by role since recruiters and athletes have different nav items.
  @Get('me/counts')
  getMyCounts(
    @CurrentUser()
    user: { id: string; role: string; recruiterId: string | null; athleteId: string | null },
  ) {
    if (user.recruiterId) {
      return this.conversationsService.getCountsForRecruiter(user.recruiterId);
    }
    if (user.athleteId) {
      return this.conversationsService.getCountsForAthlete(user.athleteId);
    }
    return { connections: 0, introductions: 0, unreadConnections: 0 };
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

  // Recruiter: request an introduction from outside an active Billy conversation
  // (e.g. Pipeline, Dossier panel) — notifies the athlete via Jerry.
  @Post('request-intro')
  requestIntro(
    @CurrentUser() user: { recruiterId: string },
    @Body() dto: { athleteId: string },
  ) {
    return this.conversationsService.requestIntroduction(user.recruiterId, dto.athleteId);
  }

  @Public()
  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.conversationsService.getMessages(id);
  }
}
