import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HtmlTemplate } from '../entities/html-template.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { AuthModule } from '../auth/auth.module';
import { isDocsOnly, stubRepositoryProviders } from '../common/docs-only';

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature([HtmlTemplate])]), AuthModule],
  providers: [TemplatesService, ...(isDocsOnly() ? stubRepositoryProviders([HtmlTemplate]) : [])],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
