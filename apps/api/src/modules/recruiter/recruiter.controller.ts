import { Controller, Get, UseGuards } from '@nestjs/common';
import { RecruiterService } from './recruiter.service';
import { CurrentUser } from '../auth/current-user.decorator';  

@Controller('recruiter')
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: { recruiterId: string }) {
    return this.recruiterService.findById(user.recruiterId);
  }
}
