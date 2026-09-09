import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { buildOpenApiDocument } from './openapi';

// AppModule(및 그 아래 모든 feature 모듈)은 @Module() 데코레이터 인자를 파일 로드
// 시점에 즉시 평가하므로, DOCS_ONLY 플래그는 './app.module'을 import하기 전에
// 반드시 먼저 설정돼 있어야 한다. 정적 import는 파일 상단으로 호이스팅돼 아래
// 대입문보다 먼저 실행되므로, 여기서는 동적 import()로 로드 시점을 늦춘다.
process.env.DOCS_ONLY = '1';

async function main() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const outPath = path.resolve(__dirname, '../../../docs/openapi.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`openapi.json written to ${outPath}`);
  await app.close();
}

main();
