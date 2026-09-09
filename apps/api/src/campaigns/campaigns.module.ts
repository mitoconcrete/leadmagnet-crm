import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../entities/campaign.entity';
import { Form } from '../entities/form.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { AuthModule } from '../auth/auth.module';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { loadEnv } from '../config/env';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Form]), AuthModule, AnalyticsModule],
  providers: [CampaignsService, { provide: PUBLIC_BASE_URL, useFactory: () => loadEnv().publicBaseUrl }],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
