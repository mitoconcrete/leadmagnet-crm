import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { configureApp } from './app.setup';
import { buildOpenApiDocument } from './openapi';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const document = buildOpenApiDocument(app);
  app.getHttpAdapter().get('/api/docs-json', (_req: Request, res: Response) => res.json(document));
  app.use('/api/docs', apiReference({ spec: { content: document } }));

  await app.listen(env.port);
}
bootstrap();
