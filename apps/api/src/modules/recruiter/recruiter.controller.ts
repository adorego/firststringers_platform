<<<<<<< Updated upstream
<<<<<<< HEAD
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
=======
import { Controller, Get, Post, Body } from '@nestjs/common';
import { RecruiterService, UpdateRecruiterProfileDto } from './recruiter.service';
=======
import { Controller, Get } from '@nestjs/common';
import { RecruiterService } from './recruiter.service';
>>>>>>> Stashed changes
import { CurrentUser } from '../auth/current-user.decorator';
>>>>>>> 905f8b0 (modifica el onboarding del reclutador)

@Controller('recruiter')
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: { recruiterId: string }) {
    return this.recruiterService.findById(user.recruiterId);
  }
<<<<<<< Updated upstream

<<<<<<< HEAD
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
=======
  @Post('onboarding/complete')
  async completeOnboarding(
    @CurrentUser() user: { recruiterId: string },
    @Body() body: Omit<UpdateRecruiterProfileDto, 'onboardingCompleted' | 'pitch'>,
  ) {
    const suggestedSearches = await this.recruiterService.completeOnboarding(
      user.recruiterId,
      body,
    );
    return { suggestedSearches };
>>>>>>> 905f8b0 (modifica el onboarding del reclutador)
  }
=======
>>>>>>> Stashed changes
}
