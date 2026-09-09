import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributionLink } from '../entities/distribution-link.entity';
import { Form } from '../entities/form.entity';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { AuthModule } from '../auth/auth.module';
import { FormsModule } from '../forms/forms.module';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { loadEnv } from '../config/env';
import { isDocsOnly, stubRepositoryProviders } from '../common/docs-only';

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature([DistributionLink, Form])]), AuthModule, FormsModule],
  providers: [
    LinksService,
    { provide: PUBLIC_BASE_URL, useFactory: () => loadEnv().publicBaseUrl },
    ...(isDocsOnly() ? stubRepositoryProviders([DistributionLink, Form]) : []),
  ],
  controllers: [LinksController],
  exports: [LinksService],
})
export class LinksModule {}
