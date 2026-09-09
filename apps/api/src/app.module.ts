import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FormsModule } from './forms/forms.module';
import { LinksModule } from './links/links.module';
import { PublicModule } from './public/public.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ...(process.env.DOCS_ONLY === '1' ? [] : [DatabaseModule]),
    AuthModule,
    TemplatesModule,
    CampaignsModule,
    FormsModule,
    LinksModule,
    PublicModule,
    SubmissionsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
