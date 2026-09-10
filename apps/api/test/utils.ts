import 'reflect-metadata';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import type { Logger, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** 스펙 §3의 채널 enum. */
export type Channel = 'instagram' | 'x' | 'youtube' | 'threads';
export const CHANNELS: Channel[] = ['instagram', 'x', 'youtube', 'threads'];

export const DEFAULT_OPERATOR_EMAIL = 'admin@example.com';
export const DEFAULT_OPERATOR_PASSWORD = 'admin1234';

export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export const VALID_FORM_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'valid-form.html');
export const NO_FORM_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'no-form.html');
export const WARN_FORM_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'warn-form.html');

export interface TestContext {
  app: INestApplication;
  ds: DataSource;
  http: () => request.SuperTest<request.Test>;
}

/** TEST_DATABASE_URL이 없으면 DATABASE_URL의 db명에 `_test`를 붙인다. */
function resolveDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (testUrl) return testUrl;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('TEST_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요하다');
  }
  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, '');
  url.pathname = `/${dbName}_test`;
  return url.toString();
}

/**
 * TEST_DATABASE_URL로 마이그레이션을 먼저 실행하고, 그 URL을 process.env.DATABASE_URL에
 * 덮어쓴 뒤 AppModule을 부팅한다. cookieParser·ValidationPipe는 백엔드가 제공하는
 * `src/app.setup.ts`의 configureApp(app)을 그대로 적용한다.
 */
export async function createTestApp(): Promise<TestContext> {
  const databaseUrl = resolveDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  const migrationDataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [],
    migrations: [path.join(__dirname, '..', 'src', 'migrations', '*.{ts,js}')],
    synchronize: false,
  });
  await migrationDataSource.initialize();
  await migrationDataSource.runMigrations();
  await migrationDataSource.destroy();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const ds = app.get(DataSource);

  return {
    app,
    ds,
    http: () => request(app.getHttpServer()) as unknown as request.SuperTest<request.Test>,
  };
}

/** 스펙 §3 순서(자식 → 부모)로 전 테이블 TRUNCATE. */
export async function truncateAll(ds: DataSource): Promise<void> {
  await ds.query(
    `TRUNCATE TABLE submissions, visits, visitors, distribution_links, forms, campaigns, html_templates, sessions, operators CASCADE`,
  );
}

/** bcryptjs 해시를 직접 insert해 운영자를 시드한다. ADR 0020: 기본은 role=admin, is_active=true. */
export async function seedOperator(
  ds: DataSource,
  email = DEFAULT_OPERATOR_EMAIL,
  password = DEFAULT_OPERATOR_PASSWORD,
  opts: { role?: 'admin' | 'operator'; isActive?: boolean } = {},
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  const role = opts.role ?? 'admin';
  const isActive = opts.isActive ?? true;
  await ds.query(`INSERT INTO operators (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4)`, [
    email,
    passwordHash,
    role,
    isActive,
  ]);
}

/** POST /api/admin/auth/login 후 sid 쿠키를 보관한 SuperAgentTest를 반환한다. */
export async function loginAgent(
  ctx: TestContext,
): Promise<{ agent: request.SuperAgentTest; cookie: string }> {
  const agent = request.agent(ctx.app.getHttpServer()) as unknown as request.SuperAgentTest;
  const res = await agent
    .post('/api/admin/auth/login')
    .send({ email: DEFAULT_OPERATOR_EMAIL, password: DEFAULT_OPERATOR_PASSWORD });

  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (setCookie ?? []).find((c) => c.startsWith('sid=')) ?? '';

  return { agent, cookie };
}

/** 템플릿 업로드 → 캠페인 생성 → 폼 생성 → 4채널 배포 링크 생성까지 한 번에 만든다. */
export async function createFixtureFlow(
  agent: request.SuperAgentTest,
): Promise<{
  templateId: string;
  campaignId: string;
  form: { id: string; slug: string };
  links: Record<Channel, { code: string; url: string }>;
}> {
  // ADR 0014: 템플릿 이름은 살아 있는 템플릿 중 고유해야 하므로(409), 한 테스트 안에서
  // createFixtureFlow를 여러 번 호출해도 충돌하지 않도록 매번 고유한 이름을 쓴다.
  const templateRes = await agent
    .post('/api/admin/templates')
    .field('name', `테스트 템플릿 ${randomUUID()}`)
    .attach('file', VALID_FORM_FIXTURE_PATH);
  const templateId = templateRes.body.id;

  const campaignRes = await agent.post('/api/admin/campaigns').send({ name: '테스트 캠페인' });
  const campaignId = campaignRes.body.id;

  const formRes = await agent
    .post('/api/admin/forms')
    .send({ campaignId, templateId, name: '테스트 폼' });
  const form = { id: formRes.body.id as string, slug: formRes.body.slug as string };

  const links = {} as Record<Channel, { code: string; url: string }>;
  for (const channel of CHANNELS) {
    const linkRes = await agent.post(`/api/admin/forms/${form.id}/links`).send({ channel });
    links[channel] = { code: linkRes.body.code, url: linkRes.body.url };
  }

  return { templateId, campaignId, form, links };
}

const TRANSACTION_STATEMENT_PATTERN = /^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|SAVEPOINT|RELEASE SAVEPOINT)/i;

/**
 * ADR 0017 N+1 회귀 방지용 쿼리 카운터. `ds.logger`를 실행 중인 SQL 수를 세는 로거로
 * 잠깐 바꿔치기하고 fn()을 실행한 뒤 원래 로거로 복원한다. BEGIN/COMMIT 등 트랜잭션
 * 제어 구문은 세지 않는다(비즈니스 쿼리 수만 비교하기 위함).
 */
export async function countQueries<T>(ds: DataSource, fn: () => Promise<T>): Promise<{ result: T; count: number }> {
  const original = ds.logger;
  let count = 0;
  const countingLogger: Logger = {
    logQuery(query: string, _parameters?: unknown[], _queryRunner?: QueryRunner) {
      if (!TRANSACTION_STATEMENT_PATTERN.test(query.trim())) count += 1;
    },
    logQueryError() {},
    logQuerySlow() {},
    logSchemaBuild() {},
    logMigration() {},
    log() {},
  };
  ds.logger = countingLogger;
  try {
    const result = await fn();
    return { result, count };
  } finally {
    ds.logger = original;
  }
}
