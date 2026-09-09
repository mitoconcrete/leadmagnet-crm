import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

process.env.DOCS_ONLY = '1';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const outPath = path.resolve(__dirname, '../../../docs/openapi.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`openapi.json written to ${outPath}`);
  await app.close();
}

main();
