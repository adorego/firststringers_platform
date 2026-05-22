import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { ScoutService } from './scout.service';

@Controller()
@Roles('RECRUITER', 'ADMIN')
export class ScoutController {
  constructor(private readonly scoutService: ScoutService) {}

  @Get('matches')
  getMatches() {
    return this.scoutService.getMatches();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.scoutService.search(query || '');
  }
}
