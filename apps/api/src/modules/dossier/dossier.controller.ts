import {
  Controller,
  Get,
  Param,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    if (user.role === 'ATHLETE' && user.athleteId !== athleteId) {
      throw new ForbiddenException('You can only view your own dossier');
    }
    return this.dossierService.getSections(athleteId);
  }

  @Get(':athleteId/dossier/raw')
  getRaw(
    @Param('athleteId') athleteId: string,
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (user.role === 'ATHLETE' && user.athleteId !== athleteId) {
      throw new ForbiddenException('You can only view your own dossier');
    }
    return this.dossierService.getRaw(athleteId);
  }
}

@Controller('dossier')
export class DossierMeController {
  constructor(private readonly dossierService: DossierService) {}

  @Get('me')
  getMyDossier(
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ) {
    if (!user.athleteId) {
      throw new NotFoundException('No athlete profile linked to this user');
    }
    return this.dossierService.getRaw(user.athleteId);
  }
}
