import { Module } from '@nestjs/common';
import { DossierController } from './dossier.controller';
import { DossierService } from './dossier.service';
import { DossierWorker } from './dossier.worker';

@Module({
  controllers: [DossierController],
  providers: [DossierService, DossierWorker],
  exports: [DossierService],
})
export class DossierModule {}
