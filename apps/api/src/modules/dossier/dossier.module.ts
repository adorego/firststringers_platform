import { Module } from '@nestjs/common';
import { DossierController, DossierMeController } from './dossier.controller';
import { DossierService } from './dossier.service';
import { DossierWorker } from './dossier.worker';

@Module({
  controllers: [DossierController, DossierMeController],
  providers: [DossierService, DossierWorker],
  exports: [DossierService],
})
export class DossierModule {}
