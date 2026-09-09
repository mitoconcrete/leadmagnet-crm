import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AuthModule } from '../auth/auth.module';
import { isDocsOnly, stubDataSourceProvider } from '../common/docs-only';

@Module({
  imports: [AuthModule],
  providers: [AnalyticsService, ...(isDocsOnly() ? [stubDataSourceProvider()] : [])],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
