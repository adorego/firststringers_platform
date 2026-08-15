import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { RecruiterService } from './recruiter.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('recruiter')
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: { recruiterId: string }) {
    return this.recruiterService.findById(user.recruiterId);
  }

  // Recruiter submits their verification info
  @Post('verify')
  async submitVerification(
    @CurrentUser() user: { recruiterId: string | null },
    @Body() dto: { title?: string; website?: string; linkedIn?: string },
  ) {
    if (!user.recruiterId) {
      throw new ForbiddenException('Not a recruiter');
    }
    return this.recruiterService.submitVerification(user.recruiterId, dto);
  }

  // Short mini-form onboarding — replaces the chat-based onboarding intro so
  // recruiters land straight in a normal Billy conversation.
  @Post('onboarding/complete')
  async completeOnboarding(
    @CurrentUser() user: { recruiterId: string | null },
    @Body()
    dto: {
      sport?: string;
      organizationType?: string;
      recruiterRole?: string;
      location?: string;
      evaluationPriority?: string;
      programNotes?: string;
    },
  ) {
    if (!user.recruiterId) {
      throw new ForbiddenException('Not a recruiter');
    }
    await this.recruiterService.updateProfile(user.recruiterId, {
      ...dto,
      onboardingCompleted: true,
    });
    return { ok: true };
  }

  // ── Admin endpoints ──

  @Get('admin/pending-verifications')
  @Roles('ADMIN')
  async listPendingVerifications() {
    return this.recruiterService.listPendingVerifications();
  }

  @Patch('admin/verify/:recruiterId')
  @Roles('ADMIN')
  async verifyRecruiter(
    @Param('recruiterId') recruiterId: string,
    @Body() dto: { status: 'verified' | 'rejected' },
  ) {
    if (dto.status !== 'verified' && dto.status !== 'rejected') {
      throw new ForbiddenException('Status must be "verified" or "rejected"');
    }
    await this.recruiterService.setVerificationStatus(recruiterId, dto.status);
    return { ok: true };
  }
}
