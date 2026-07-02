import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { BillyConversationService } from './billy-conversation.service';
import { RecruiterService } from '../recruiter/recruiter.service';

@Public()
@Controller('billy/conversations')
export class BillyConversationController {
  constructor(
    private readonly service: BillyConversationService,
    private readonly recruiterService: RecruiterService,
  ) {}

  @Get()
  findAll(@Query('recruiterId') recruiterId: string) {
    return this.service.findAll(recruiterId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: { recruiterId: string }) {
    const recruiter = await this.recruiterService.findById(dto.recruiterId);
    const isOnboarding = !recruiter?.onboardingCompleted;
    return this.service.create(dto.recruiterId, isOnboarding);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: { title: string }) {
    return this.service.updateTitle(id, dto.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
