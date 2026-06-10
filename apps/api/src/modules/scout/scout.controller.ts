import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ScoutService } from './scout.service';
import { SearchFilters } from '../../shared/types/scout.types';

interface SearchBody {
  query: string;
  filters: SearchFilters;
  limit?: number;
}

@Controller('scout')
export class ScoutController {
  private readonly logger = new Logger(ScoutController.name);

  constructor(private readonly scout: ScoutService) {}

  @Post('search')
  async search(@Body() body: SearchBody) {
    try {
      const { query = '', filters = {}, limit = 5 } = body;
      return await this.scout.search(query, filters, limit);
    } catch (error) {
      this.logger.error('Scout search error', error);
      throw new HttpException('Search error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
