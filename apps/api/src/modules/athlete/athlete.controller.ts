import { Controller, Get, Param, ForbiddenException } from '@nestjs/common';
import { AthleteService } from './athlete.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('athletes')
export class AthleteController {
  constructor(private readonly athleteService: AthleteService) {}

  @Get()
  @Roles('RECRUITER')
  findAll() {
    return this.athleteService.findAll();
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
