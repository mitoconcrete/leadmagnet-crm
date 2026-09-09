import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../entities/submission.entity';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { AuthModule } from '../auth/auth.module';
import { isDocsOnly, stubRepositoryProviders } from '../common/docs-only';

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature([Submission])]), AuthModule],
  providers: [SubmissionsService, ...(isDocsOnly() ? stubRepositoryProviders([Submission]) : [])],
  controllers: [SubmissionsController],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
