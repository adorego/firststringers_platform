import { Controller, Get, Param, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { DossierService } from './dossier.service';

@Controller('athletes')
export class DossierController {
  constructor(private readonly dossierService: DossierService) {}

  @Get(':athleteId/dossier')
  getSections(
    @Param('athleteId') athleteId: string,
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    // Athletes can only view their own dossier
    if (user.role === 'ATHLETE' && user.athleteId !== athleteId) {
      throw new ForbiddenException('You can only view your own dossier');
    }
    return this.dossierService.getSections(athleteId);
  }
}
