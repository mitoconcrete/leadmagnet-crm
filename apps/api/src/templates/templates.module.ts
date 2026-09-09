import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HtmlTemplate } from '../entities/html-template.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { AuthModule } from '../auth/auth.module';
import { isDocsOnly, stubRepositoryProviders } from '../common/docs-only';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { loadEnv } from '../config/env';

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature([HtmlTemplate])]), AuthModule],
  providers: [
    TemplatesService,
    { provide: PUBLIC_BASE_URL, useFactory: () => loadEnv().publicBaseUrl },
    ...(isDocsOnly() ? stubRepositoryProviders([HtmlTemplate]) : []),
  ],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
