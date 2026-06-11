import { Global, Module } from '@nestjs/common';
import { RecruiterService } from './recruiter.service';
import { RecruiterController } from './recruiter.controller';

@Global()
@Module({
  controllers: [RecruiterController],
  providers: [RecruiterService],
  exports: [RecruiterService],
})
export class RecruiterModule {}
