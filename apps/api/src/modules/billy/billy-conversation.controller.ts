import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillyConversationService } from './billy-conversation.service';
import { RecruiterService } from '../recruiter/recruiter.service';

interface AuthenticatedRecruiter {
  id: string;
  recruiterId: string | null;
}

@Roles('RECRUITER')
@Controller('billy/conversations')
export class BillyConversationController {
  constructor(
    private readonly service: BillyConversationService,
    private readonly recruiterService: RecruiterService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedRecruiter) {
    return this.service.findAll(this.recruiterIdOf(user));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthenticatedRecruiter) {
    const recruiterId = this.recruiterIdOf(user);
    const recruiter = await this.recruiterService.findById(recruiterId);
    const isOnboarding = !recruiter?.onboardingCompleted;
    return this.service.create(recruiterId, isOnboarding);
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: AuthenticatedRecruiter,
    @Param('id') id: string,
    @Body() dto: { title: string },
  ) {
    await this.assertOwnership(id, this.recruiterIdOf(user));
    return this.service.updateTitle(id, dto.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedRecruiter,
    @Param('id') id: string,
  ) {
    await this.assertOwnership(id, this.recruiterIdOf(user));
    return this.service.delete(id);
  }

  private recruiterIdOf(user: AuthenticatedRecruiter): string {
    if (!user.recruiterId) {
      throw new ForbiddenException('Recruiter profile required');
    }
    return user.recruiterId;
  }

  private async assertOwnership(
    conversationId: string,
    recruiterId: string,
  ): Promise<void> {
    const conversation = await this.service.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.recruiterId !== recruiterId) {
      throw new ForbiddenException('Conversation belongs to another recruiter');
    }
  }
}
