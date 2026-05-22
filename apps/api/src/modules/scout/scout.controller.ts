import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { ScoutService } from './scout.service';

@Controller()
@Roles('RECRUITER', 'ADMIN')
export class ScoutController {
  constructor(private readonly scoutService: ScoutService) {}

  @Get('matches')
  getMatches(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.scoutService.getMatches(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('search')
  search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.scoutService.search(
      query || '',
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
