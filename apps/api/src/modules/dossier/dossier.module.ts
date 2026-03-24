import { Module } from '@nestjs/common'
import { DossierWorker } from './dossier.worker'

@Module({
  providers: [DossierWorker],
})
export class DossierModule {}