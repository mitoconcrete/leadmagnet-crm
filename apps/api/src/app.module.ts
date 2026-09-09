import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FormsModule } from './forms/forms.module';
import { LinksModule } from './links/links.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ...(process.env.DOCS_ONLY === '1' ? [] : [DatabaseModule]),
    AuthModule,
    TemplatesModule,
    CampaignsModule,
    FormsModule,
    LinksModule,
    PublicModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
