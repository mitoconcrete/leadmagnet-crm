import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from '../entities/form.entity';
import { Visitor } from '../entities/visitor.entity';
import { Visit } from '../entities/visit.entity';
import { Submission } from '../entities/submission.entity';
import { DistributionLink } from '../entities/distribution-link.entity';
import { PublicService } from './public.service';
import { PublicPageController } from './public-page.controller';
import { PublicApiController } from './public-api.controller';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { loadEnv } from '../config/env';
import { isDocsOnly, stubDataSourceProvider, stubRepositoryProviders } from '../common/docs-only';

const ENTITIES = [Form, Visitor, Visit, Submission, DistributionLink];

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature(ENTITIES)])],
  providers: [
    PublicService,
    { provide: PUBLIC_BASE_URL, useFactory: () => loadEnv().publicBaseUrl },
    ...(isDocsOnly() ? [...stubRepositoryProviders(ENTITIES), stubDataSourceProvider()] : []),
  ],
  controllers: [PublicPageController, PublicApiController],
})
export class PublicModule {}
