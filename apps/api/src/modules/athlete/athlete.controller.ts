import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AthleteService } from './athlete.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('athletes')
export class AthleteController {
  constructor(private readonly athleteService: AthleteService) {}

  @Get()
  @Roles('RECRUITER')
  findAll() {
    return this.athleteService.findAll();
  }

  @Get('me')
  getMe(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.athleteService.findOne(user.athleteId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
    @Body() dto: UpdateProfileDto,
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.athleteService.updateProfile(user.athleteId, dto);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; athleteId?: string },
  ) {
    if (user.role === 'ATHLETE' && user.athleteId !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.athleteService.findOne(id);
  }
}
