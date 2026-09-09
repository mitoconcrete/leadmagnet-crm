# 리드마그넷 CRM 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 HTML을 등록해 캠페인·폼·채널별 배포 링크를 만들고, 방문자가 격리된 공개 폼에서 신청하며, 운영자가 캠페인별·채널별 방문/방문자/신청/전환율을 확인하는 시스템을 docker compose로 실행·테스트 가능하게 만든다.

**Architecture:** pnpm 모노레포. `apps/api`(NestJS 11 + TypeORM 0.3 + PostgreSQL 16)가 관리자 API(`/api/admin/*`, 세션 쿠키), 공개 API(`/api/public/*`), 공개 폼 래퍼(`/p/:slug`)를 제공한다. `apps/web`(Next.js 16)은 rewrite로 관리자 API를 호출한다. 등록 HTML은 sandbox iframe + CSP로 격리된다.

**Tech Stack:** Node 22, pnpm 10, NestJS 11, TypeORM 0.3, pg, bcryptjs, class-validator, @nestjs/swagger + Scalar, Jest + supertest, Next.js 16 + React 19 + Tailwind + shadcn/ui + vitest, Bruno CLI, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-leadmagnet-crm-design.md` (근거 명세 `docs/ouroboros/seed.yaml`, 결정 `docs/adr/`). 계약(경로·필드명·상태 코드)은 스펙 §3·§4가 최종 권위다. 이 계획과 충돌하면 스펙을 따른다.

## Global Constraints

- Node 22 / pnpm 10 (`packageManager: "pnpm@10.15.0"`). 이미지 `node:22-alpine`, `corepack enable`.
- PostgreSQL 16만 사용. `synchronize: false`. 스키마는 `apps/api/src/migrations/*.ts`로만 변경.
- 관리자 API 접두사 `/api/admin`, 공개 API `/api/public`, 공개 폼 `/p/:slug`, 문서 `/api/docs`, `/api/docs-json`.
- 세션 쿠키 이름 `sid`, `Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=604800`. 방문자 쿠키 `vid`, `Path=/p; HttpOnly; SameSite=Lax; Max-Age=31536000`.
- 채널 enum: `instagram | x | youtube | threads`. 집계 채널 목록은 항상 `direct, instagram, x, youtube, threads` 순 5행.
- 전환율 = `visitors === 0 ? 0 : round(submissions / visitors, 4)`.
- HTML 등록 검증: 확장자 `.html`, `≤ 524288` bytes, 본문에 `<form` 포함(대소문자 무시).
- 오류 형식은 Nest 기본 `{statusCode, message, error}`. 400/401/404/409.
- 커밋: 기능 단위. 테스트 먼저 `test: …` 커밋, 구현 `feat: …` 커밋으로 분리. 스캐폴드/도커는 `chore:`, 문서는 `docs:`.
- TDD(ADR 0011): 제품 코드는 실패 테스트를 본 뒤에만 쓴다(superpowers `test-driven-development` 스킬). 커버리지 게이트 `pnpm --filter api test:cov`(단위+e2e 합산, `apps/api/jest.cov.config.ts`), `pnpm --filter web test:cov`(`@vitest/coverage-v8`, `components/ui/**` 제외): lines/statements/functions 90%, branches 80%. 미달이면 테스트를 추가한다. 임계값을 낮추지 않는다.
- 문서·주석·커밋 본문은 한국어. 코드 식별자는 영어.
- 워크스페이스 패키지 이름: `api`, `web`. 루트 스크립트는 `pnpm --filter api …`, `pnpm --filter web …` 형태.
- CI(`.github/workflows/ci.yml`)는 검증 인프라이며 Seed 범위 밖의 기능이 아니다(ADR 0010). guardian은 이를 범위 이탈로 판정하지 않는다.
- **저장소에 넣지 않는 것**: API 키·토큰·비밀번호 실값, 개인·회사 계정명, 회사명, 사용자 홈 절대 경로, 개인 이메일, 도구 세션 링크. 이런 값이 필요하면 `.env`(gitignore)나 저장소 밖 `../rizz-notes/`에 둔다. 커밋 전 가드(git hook + Claude 훅)가 자동으로 차단하며, 차단되면 값을 빼고 다시 커밋한다. 우회(`--no-verify`) 금지.
- 서브에이전트는 자기 트랙의 파일만 만진다. 공유 파일(`pnpm-lock.yaml`, `apps/api/package.json`)은 Track A가 확정하며, 의존성 추가가 꼭 필요하면 보고서에 적고 통합 단계에서 반영한다.

---

## 에이전트 구성 (`.claude/agents/`)

| 에이전트 | 모델 | 역할 |
|---|---|---|
| `orchestrator` | fable | 전 과정 조율. 트랙 디스패치, 원장 기록, 통합·검증 |
| `architect` | fable | 설계 소유자. 스펙·ADR 해석과 갱신, 설계 질문 응답 |
| `guardian` | fable | 방향 감시. 트랙 diff를 Seed·스펙·ADR과 대조해 PASS / FIX_REQUIRED / ESCALATE 판정 |
| `infra-dev` | sonnet | Track A |
| `backend-dev` | sonnet | Track B |
| `frontend-dev` | sonnet | Track C |
| `test-dev` | sonnet | Track D |

흐름: orchestrator → infra-dev(A) → guardian → [backend-dev(B) ∥ frontend-dev(C) ∥ test-dev(D)] → guardian(트랙별) → orchestrator(E 통합·수정 위임) → guardian(최종) → 사용자 보고. 설계 질문은 어느 단계든 architect로.

## 실행 순서와 병렬 구조

```
Track A (인프라, 단독 선행) ──▶ Track B (백엔드) ─┐
                              Track C (프론트)  ─┼─▶ Track E (통합·검증·문서)
                              Track D (테스트)  ─┘
```

- Track A는 `main`에서 순차 실행 후 커밋. B/C/D는 각각 `.worktrees/<track>` 워크트리, 브랜치 `track/backend`, `track/frontend`, `track/test`에서 병렬 실행.
- Track D의 e2e는 Track A의 스켈레톤 API에 대해 **빨간 상태**로 커밋된다. 초록은 Track E에서 확인한다.
- Track E는 컨트롤러가 브랜치를 `main`에 순서대로 머지(backend → test → frontend)하고, `docker compose --profile test run --rm api-test`로 검증한다.

---

# Track A. 인프라 스캐폴드 (선행, 단일 에이전트)

### Task A1: 워크스페이스 루트

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.node-version`, `.editorconfig`

**Interfaces:**
- Produces: 루트 스크립트 `dev:api`, `dev:web`, `test`, `test:e2e`, `bruno:run`, `openapi:export`

- [ ] **Step 1: 파일 작성**

`package.json`
```json
{
  "name": "leadmagnet-crm",
  "private": true,
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev:api": "pnpm --filter api start:dev",
    "dev:web": "pnpm --filter web dev",
    "build": "pnpm -r build",
    "test": "pnpm --filter api test && pnpm --filter web test",
    "test:e2e": "pnpm --filter api test:e2e",
    "openapi:export": "pnpm --filter api openapi:export",
    "bruno:run": "cd bruno/leadmagnet-crm && bru run --env local"
  },
  "devDependencies": { "@usebruno/cli": "^2.0.0" }
}
```

`pnpm-workspace.yaml`
```yaml
packages:
  - apps/*
```

`tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "commonjs", "moduleResolution": "node",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "experimentalDecorators": true, "emitDecoratorMetadata": true,
    "resolveJsonModule": true, "forceConsistentCasingInFileNames": true
  }
}
```

`.env.example`
```env
# PostgreSQL (docker compose 기본값)
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=leadmagnet
DATABASE_URL=postgres://app:app@localhost:5432/leadmagnet
# 테스트 DB (없으면 DATABASE_URL의 db명 + _test)
TEST_DATABASE_URL=postgres://app:app@localhost:5433/leadmagnet_test
# 운영자 시드 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin1234
SESSION_TTL_SECONDS=604800
# 공개 폼/공개 API가 노출되는 오리진 (배포 링크 URL, CSP connect-src에 사용)
PUBLIC_BASE_URL=http://localhost:3001
# web → api 서버 내부 주소 (Next.js rewrite)
API_INTERNAL_URL=http://localhost:3001
PORT=3001
```

`.node-version`: `22`

`.editorconfig`: `root = true`, `[*]` indent_style=space, indent_size=2, end_of_line=lf, charset=utf-8, insert_final_newline=true.

pnpm 10은 의존성의 빌드 스크립트를 기본 차단한다. 설치 시 경고가 나오면 루트 `package.json`에 `"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp", "@tailwindcss/oxide", "unrs-resolver"] }`를 추가한다(경고에 나온 패키지 이름으로).

- [ ] **Step 2: 커밋**
```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .env.example .node-version .editorconfig
git commit -m "chore: pnpm 워크스페이스 루트 구성"
```

### Task A2: apps/api 스켈레톤 (의존성 확정)

**Files:**
- Create: `apps/api/package.json`, `apps/api/nest-cli.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/jest.config.ts`, `apps/api/test/jest-e2e.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/config/env.ts`, `apps/api/src/health.controller.ts`

**Interfaces:**
- Produces: `loadEnv(): Env` (`apps/api/src/config/env.ts`), `bootstrap()`이 `/api/health` → `{status:'ok'}` 응답. Track B가 `app.module.ts`/`main.ts`를 확장한다.

- [ ] **Step 1: package.json**

```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json --runInBand",
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:run": "node node_modules/typeorm/cli.js migration:run -d dist/data-source.js",
    "migration:run:dev": "pnpm typeorm migration:run",
    "seed": "node dist/seed.js",
    "seed:dev": "ts-node -r tsconfig-paths/register src/seed.ts",
    "openapi:export": "ts-node -r tsconfig-paths/register src/openapi-export.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "@scalar/nestjs-api-reference": "^0.5.0",
    "bcryptjs": "^3.0.2",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "cookie-parser": "^1.4.7",
    "multer": "^2.0.0",
    "pg": "^8.13.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.20",
    "typeorm-naming-strategies": "^4.1.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.8",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.0"
  }
}
```

`nest-cli.json`
```json
{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true, "plugins": [{ "name": "@nestjs/swagger", "options": { "introspectComments": true } }] } }
```

`tsconfig.json`
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "./dist", "baseUrl": "./", "sourceMap": true, "incremental": true }, "include": ["src/**/*", "test/**/*"] }
```
`tsconfig.build.json`
```json
{ "extends": "./tsconfig.json", "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"] }
```

`jest.config.ts`
```ts
import type { Config } from 'jest';
const config: Config = {
  rootDir: 'src', testRegex: '.*\\.spec\\.ts$', transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'], testEnvironment: 'node',
};
export default config;
```

`test/jest-e2e.json`
```json
{ "moduleFileExtensions": ["js","json","ts"], "rootDir": ".", "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$", "transform": { "^.+\\.ts$": "ts-jest" }, "testTimeout": 30000 }
```

- [ ] **Step 2: env 로더와 스켈레톤 앱**

`src/config/env.ts`
```ts
export interface Env {
  port: number;
  databaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  sessionTtlSeconds: number;
  publicBaseUrl: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl && source.DOCS_ONLY !== '1') throw new Error('DATABASE_URL is required');
  return {
    port: Number(source.PORT ?? 3001),
    databaseUrl: databaseUrl ?? '',
    adminEmail: source.ADMIN_EMAIL ?? 'admin@example.com',
    adminPassword: source.ADMIN_PASSWORD ?? 'admin1234',
    sessionTtlSeconds: Number(source.SESSION_TTL_SECONDS ?? 604800),
    publicBaseUrl: (source.PUBLIC_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  };
}
```

`src/health.controller.ts`
```ts
import { Controller, Get } from '@nestjs/common';
@Controller('api/health')
export class HealthController {
  @Get() check() { return { status: 'ok' }; }
}
```

`src/app.module.ts`
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
@Module({ controllers: [HealthController] })
export class AppModule {}
```

`src/main.ts`
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  await app.listen(env.port);
}
bootstrap();
```

- [ ] **Step 3: 설치·빌드 확인**
```bash
corepack enable && pnpm install
pnpm --filter api build && ls apps/api/dist/main.js
```
Expected: 빌드 성공, `pnpm-lock.yaml` 생성.

- [ ] **Step 4: 커밋**
```bash
git add apps/api pnpm-lock.yaml
git commit -m "chore: NestJS API 스켈레톤과 의존성 확정"
```

### Task A3: apps/web 스캐폴드

**Files:**
- Create: `apps/web/**` (create-next-app 산출물), `apps/web/vitest.config.ts`, `apps/web/next.config.ts` 수정

- [ ] **Step 1: 스캐폴드**
```bash
cd apps && pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-pnpm --no-turbopack --yes
cd web && pnpm dlx shadcn@latest init -d && pnpm dlx shadcn@latest add button input label card table dialog badge sonner select switch skeleton -y
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```
`package.json`의 `name`을 `web`으로, scripts에 `"test": "vitest run"` 추가. create-next-app이 만든 `apps/web/README.md`는 삭제한다(루트 README만 유지). create-next-app 플래그 이름은 버전에 따라 다를 수 있다(`--no-src-dir`, `--no-turbopack` 등). 목표는 App Router + TypeScript + Tailwind + ESLint, `src/` 없음, alias `@/*`이며 결과 구조가 맞으면 된다.

- [ ] **Step 2: next.config.ts**
```ts
import type { NextConfig } from 'next';
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
};
export default nextConfig;
```

`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, include: ['**/*.test.{ts,tsx}'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 3: 확인 및 커밋**
```bash
pnpm --filter web build
git add apps/web pnpm-lock.yaml && git commit -m "chore: Next.js 관리자 화면 스캐폴드(shadcn/ui, vitest)"
```

### Task A4: Docker와 compose

**Files:**
- Create: `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh`, `apps/web/Dockerfile`, `docker-compose.yaml`, `.dockerignore`, `README.md`

- [ ] **Step 1: api Dockerfile (컨텍스트 = 저장소 루트, dev 의존성 포함 → api-test에 재사용)**
```dockerfile
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api
COPY apps/api apps/api
RUN pnpm --filter api build
EXPOSE 3001
CMD ["sh", "apps/api/docker-entrypoint.sh"]
```

`apps/api/docker-entrypoint.sh`
```sh
#!/bin/sh
set -e
cd /repo
pnpm --filter api migration:run
pnpm --filter api seed
exec node apps/api/dist/main.js
```

- [ ] **Step 2: web Dockerfile**
```dockerfile
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web
COPY apps/web apps/web
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm --filter web build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
```

`.dockerignore`
```
**/node_modules
**/dist
**/.next
.git
.worktrees
docs
bruno
```

- [ ] **Step 3: docker-compose.yaml**
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-app}
      POSTGRES_DB: ${POSTGRES_DB:-leadmagnet}
    ports: ["5432:5432"]
    volumes: [dbdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app} -d ${POSTGRES_DB:-leadmagnet}"]
      interval: 3s
      timeout: 3s
      retries: 20

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-app}:${POSTGRES_PASSWORD:-app}@db:5432/${POSTGRES_DB:-leadmagnet}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@example.com}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin1234}
      SESSION_TTL_SECONDS: ${SESSION_TTL_SECONDS:-604800}
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-http://localhost:3001}
      PORT: "3001"
    ports: ["3001:3001"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/api/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 30
    depends_on:
      db: { condition: service_healthy }

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args: { API_INTERNAL_URL: http://api:3001 }
    environment:
      API_INTERNAL_URL: http://api:3001
    ports: ["3000:3000"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/login || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 30
    depends_on:
      api: { condition: service_healthy }

  db-test:
    profiles: [test]
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: leadmagnet_test
    tmpfs: [/var/lib/postgresql/data]
    ports: ["5433:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d leadmagnet_test"]
      interval: 3s
      timeout: 3s
      retries: 20

  api-test:
    profiles: [test]
    build: { context: ., dockerfile: apps/api/Dockerfile }
    environment:
      DATABASE_URL: postgres://app:app@db-test:5432/leadmagnet_test
      TEST_DATABASE_URL: postgres://app:app@db-test:5432/leadmagnet_test
      PUBLIC_BASE_URL: http://localhost:3001
    command: sh -c "pnpm --filter api test && pnpm --filter api test:e2e"
    depends_on:
      db-test: { condition: service_healthy }

volumes:
  dbdata:
```

- [ ] **Step 4: README.md (실행·테스트만)**
```markdown
# 리드마그넷 CRM 운영 시스템

## 실행
1. `cp .env.example .env`
2. `docker compose up --build`
3. 관리자 화면 http://localhost:3000 (계정: `.env`의 ADMIN_EMAIL / ADMIN_PASSWORD)
4. API 문서 http://localhost:3001/api/docs (OpenAPI JSON: http://localhost:3001/api/docs-json, 파일: `docs/openapi.json`)

## 테스트
- 도커: `docker compose --profile test run --rm api-test` (단위 + e2e, 테스트 전용 DB)
- 로컬: `pnpm install` → `docker compose up -d db db-test` → `pnpm test` → `pnpm test:e2e`
- 관리자 화면 단위 테스트: `pnpm --filter web test`
- Bruno 컬렉션: API 실행 후 `pnpm bruno:run`
- CI: `.github/workflows/ci.yml`이 push/PR마다 위 절차(단위·e2e, 웹 빌드, compose 스택 통합 스모크)를 자동 실행

## 로컬 개발
`docker compose up -d db` → `pnpm --filter api migration:run:dev && pnpm --filter api seed:dev` → `pnpm dev:api`, `pnpm dev:web`
```

- [ ] **Step 5: 검증·커밋**
```bash
docker compose config -q && docker compose build api
git add apps/api/Dockerfile apps/api/docker-entrypoint.sh apps/web/Dockerfile docker-compose.yaml .dockerignore README.md
git commit -m "chore: docker compose 실행/테스트 환경과 README"
```
`migration:run`과 `seed`는 Track B 산출물이므로 이 시점의 `docker compose up`은 실패해도 된다. `build`만 통과하면 된다.

### Task A5: GitHub Actions CI (ADR 0010)

**Files:**
- Create: `.github/workflows/ci.yml`, `scripts/ci-smoke.sh`

- [ ] **Step 1: 워크플로**
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: leadmagnet_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U app -d leadmagnet_test"
          --health-interval 3s --health-timeout 3s --health-retries 20
    env:
      TEST_DATABASE_URL: postgres://app:app@localhost:5432/leadmagnet_test
      DATABASE_URL: postgres://app:app@localhost:5432/leadmagnet_test
      PUBLIC_BASE_URL: http://localhost:3001
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api test
      - run: pnpm --filter api test:e2e
      - run: pnpm --filter api openapi:export
      - uses: actions/upload-artifact@v4
        with: { name: openapi, path: docs/openapi.json }

  web:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      API_INTERNAL_URL: http://localhost:3001
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web test
      - run: pnpm --filter web build

  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker compose up --build -d --wait
      - run: docker compose --profile test run --rm api-test
      - run: pnpm bruno:run
      - run: bash scripts/ci-smoke.sh
      - if: always()
        run: docker compose logs --no-color > compose.log
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: compose-logs, path: compose.log }
      - if: always()
        run: docker compose down -v
```

- [ ] **Step 2: 스모크 스크립트**
```bash
#!/usr/bin/env bash
# 웹 오리진(3000)만 확인한다. API 계약은 Bruno가 담당.
set -euo pipefail
WEB=${WEB_BASE_URL:-http://localhost:3000}

body=$(curl -fsS "$WEB/login")
echo "$body" | grep -qi '<form' || { echo "login page has no <form>"; exit 1; }

code=$(curl -s -o /dev/null -w '%{http_code}' "$WEB/api/admin/auth/me")
[ "$code" = "401" ] || { echo "expected 401 from web->api rewrite, got $code"; exit 1; }

echo "smoke ok"
```
`chmod +x scripts/ci-smoke.sh`.

- [ ] **Step 3: 검증·커밋**
```bash
docker compose config -q
bash -n scripts/ci-smoke.sh
git add .github/workflows/ci.yml scripts/ci-smoke.sh
git commit -m "chore: GitHub Actions CI (api, web, compose 통합 스모크)"
```
이 시점에 CI는 원격이 없어 실행되지 않는다. 녹색 확인은 Track E5-1.

---

# Track B. 백엔드 (브랜치 `track/backend`, 워크트리 `.worktrees/backend`)

공통 규칙: 서비스 단위 테스트는 `*.spec.ts`(리포지토리 모킹 또는 순수 함수). 각 태스크는 `test:` 커밋 후 `feat:` 커밋. 모든 관리자 컨트롤러에 `@ApiTags`, `@ApiCookieAuth('sid')`.

### Task B1: 데이터 소스, 엔티티, 초기 마이그레이션, 시드

**Files:**
- Create: `src/data-source.ts`, `src/database.module.ts`, `src/entities/{operator,session,html-template,campaign,form,distribution-link,visitor,visit,submission}.entity.ts`, `src/entities/index.ts`, `src/entities/channel.ts`, `src/migrations/1757400000000-init.ts`, `src/seed.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Produces: `export const CHANNELS = ['instagram','x','youtube','threads'] as const; export type Channel = typeof CHANNELS[number]; export const STAT_CHANNELS = ['direct', ...CHANNELS]`. `AppDataSource: DataSource`, `createDataSourceOptions(url: string): DataSourceOptions`. `runSeed(dataSource, {email,password})`.

- [ ] **Step 1: 채널 상수 단위 테스트 (`src/entities/channel.spec.ts`)**
```ts
import { CHANNELS, STAT_CHANNELS, isChannel } from './channel';
describe('channel', () => {
  it('4개 채널과 direct 포함 5개 집계 채널', () => {
    expect(CHANNELS).toEqual(['instagram', 'x', 'youtube', 'threads']);
    expect(STAT_CHANNELS).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
  });
  it('isChannel', () => { expect(isChannel('x')).toBe(true); expect(isChannel('tiktok')).toBe(false); });
});
```
Run: `pnpm --filter api test -- channel` → FAIL. Commit `test: 채널 상수 테스트`.

- [ ] **Step 2: 구현**

`src/entities/channel.ts`
```ts
export const CHANNELS = ['instagram', 'x', 'youtube', 'threads'] as const;
export type Channel = (typeof CHANNELS)[number];
export const STAT_CHANNELS = ['direct', ...CHANNELS] as const;
export type StatChannel = (typeof STAT_CHANNELS)[number];
export function isChannel(v: unknown): v is Channel { return typeof v === 'string' && (CHANNELS as readonly string[]).includes(v); }
```

엔티티(모두 `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn({type:'timestamptz'})`). 컬럼명은 `SnakeNamingStrategy`가 변환한다.
```ts
// operator.entity.ts
@Entity('operators') export class Operator { @PrimaryGeneratedColumn('uuid') id: string; @Column({unique:true}) email: string; @Column() passwordHash: string; @CreateDateColumn({type:'timestamptz'}) createdAt: Date; }
// session.entity.ts
@Entity('sessions') export class Session { @PrimaryGeneratedColumn('uuid') id: string; @ManyToOne(()=>Operator,{onDelete:'CASCADE'}) operator: Operator; @Column() operatorId: string; @Column({type:'timestamptz'}) expiresAt: Date; @CreateDateColumn({type:'timestamptz'}) createdAt: Date; }
// html-template.entity.ts
@Entity('html_templates') export class HtmlTemplate { id; @Column() name: string; @Column() originalFilename: string; @Column({type:'text'}) html: string; @Column({type:'int'}) sizeBytes: number; createdAt; }
// campaign.entity.ts
@Entity('campaigns') export class Campaign { id; @Column() name: string; @Column({type:'text',nullable:true}) description: string|null; @Column({type:'enum',enum:['active','archived'],enumName:'campaign_status',default:'active'}) status: 'active'|'archived'; createdAt; @UpdateDateColumn({type:'timestamptz'}) updatedAt: Date; @OneToMany(()=>Form,f=>f.campaign) forms: Form[]; }
// form.entity.ts
@Entity('forms') export class Form { id; @ManyToOne(()=>Campaign,c=>c.forms) campaign; @Column() campaignId: string; @ManyToOne(()=>HtmlTemplate) template; @Column() templateId: string; @Column() name: string; @Column({unique:true}) slug: string; @Column({default:'신청이 완료되었습니다.'}) successMessage: string; @Column({default:true}) isActive: boolean; createdAt; updatedAt; @OneToMany(()=>DistributionLink,l=>l.form) links: DistributionLink[]; }
// distribution-link.entity.ts
@Entity('distribution_links') @Unique(['formId','channel']) export class DistributionLink { id; @ManyToOne(()=>Form,f=>f.links,{onDelete:'CASCADE'}) form; @Column() formId: string; @Column({type:'enum',enum:CHANNELS,enumName:'channel'}) channel: Channel; @Column({length:12,unique:true}) code: string; createdAt; }
// visitor.entity.ts
@Entity('visitors') export class Visitor { id; @CreateDateColumn({type:'timestamptz'}) firstSeenAt: Date; @Column({type:'timestamptz'}) lastSeenAt: Date; }
// visit.entity.ts
@Entity('visits') @Index(['formId']) @Index(['linkId']) export class Visit { id; @Column() formId: string; @Column() visitorId: string; @Column({type:'uuid',nullable:true}) linkId: string|null; @Column({length:16}) channel: string; @Column({type:'text',nullable:true}) userAgent: string|null; createdAt; }
// submission.entity.ts
@Entity('submissions') @Index(['formId']) @Index(['createdAt']) export class Submission { id; @Column() formId: string; @Column() visitId: string; @Column() visitorId: string; @Column({type:'uuid',nullable:true}) linkId: string|null; @Column({length:16}) channel: string; @Column({type:'jsonb'}) payload: Record<string, unknown>; createdAt; }
```
(위 축약은 형태만 보여 준다. 실제 파일에는 import와 데코레이터를 모두 쓴다. `ManyToOne`에는 `@JoinColumn({name:'form_id'})` 등 명시.)

`src/data-source.ts`
```ts
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from './entities';

export function createDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres', url, entities, migrations: [__dirname + '/migrations/*.{ts,js}'],
    namingStrategy: new SnakeNamingStrategy(), synchronize: false, logging: false,
  };
}
export const AppDataSource = new DataSource(createDataSourceOptions(process.env.DATABASE_URL ?? ''));
export default AppDataSource;
```

`src/database.module.ts`
```ts
@Module({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => ({ ...createDataSourceOptions(loadEnv().databaseUrl), autoLoadEntities: true }) })] })
export class DatabaseModule {}
```
`DOCS_ONLY=1`일 때는 `AppModule`에서 `DatabaseModule`을 import하지 않는다(`imports: [...(process.env.DOCS_ONLY === '1' ? [] : [DatabaseModule]), …]`). 리포지토리 주입은 각 모듈의 `TypeOrmModule.forFeature`로 하되, DOCS_ONLY에서는 컨트롤러 메타데이터만 필요하므로 B8의 export 스크립트가 `SwaggerModule.createDocument` 전에 `app.init()`을 호출하지 않는다.

`src/migrations/1757400000000-init.ts` — `up`에 raw SQL:
```sql
CREATE TYPE campaign_status AS ENUM ('active','archived');
CREATE TYPE channel AS ENUM ('instagram','x','youtube','threads');
CREATE TABLE operators (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL UNIQUE, password_hash varchar NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE html_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar NOT NULL, original_filename varchar NOT NULL, html text NOT NULL, size_bytes int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar NOT NULL, description text, status campaign_status NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE forms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES campaigns(id), template_id uuid NOT NULL REFERENCES html_templates(id), name varchar NOT NULL, slug varchar NOT NULL UNIQUE, success_message varchar NOT NULL DEFAULT '신청이 완료되었습니다.', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE distribution_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE, channel channel NOT NULL, code varchar(12) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (form_id, channel));
CREATE TABLE visitors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE visits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), form_id uuid NOT NULL REFERENCES forms(id), visitor_id uuid NOT NULL REFERENCES visitors(id), link_id uuid REFERENCES distribution_links(id) ON DELETE SET NULL, channel varchar(16) NOT NULL, user_agent text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_visits_form_id ON visits(form_id); CREATE INDEX idx_visits_link_id ON visits(link_id);
CREATE TABLE submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), form_id uuid NOT NULL REFERENCES forms(id), visit_id uuid NOT NULL REFERENCES visits(id), visitor_id uuid NOT NULL REFERENCES visitors(id), link_id uuid REFERENCES distribution_links(id) ON DELETE SET NULL, channel varchar(16) NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_submissions_form_id ON submissions(form_id); CREATE INDEX idx_submissions_created_at ON submissions(created_at);
```
`down`은 역순 DROP.

`src/seed.ts`
```ts
export async function runSeed(ds: DataSource, opts: { email: string; password: string }) {
  const repo = ds.getRepository(Operator);
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const existing = await repo.findOne({ where: { email: opts.email } });
  if (existing) { existing.passwordHash = passwordHash; await repo.save(existing); return existing; }
  return repo.save(repo.create({ email: opts.email, passwordHash }));
}
if (require.main === module) {
  const env = loadEnv();
  AppDataSource.initialize().then(async (ds) => { await runSeed(ds, { email: env.adminEmail, password: env.adminPassword }); await ds.destroy(); console.log(`seeded operator ${env.adminEmail}`); });
}
```

- [ ] **Step 3: 마이그레이션 실행 확인**
```bash
docker compose up -d db && pnpm --filter api migration:run:dev && pnpm --filter api seed:dev
psql postgres://app:app@localhost:5432/leadmagnet -c '\dt'
```
Expected: 9개 테이블 + migrations.

- [ ] **Step 4: 커밋** `feat: 엔티티, 초기 마이그레이션, 운영자 시드`

### Task B2: 인증 모듈

**Files:**
- Create: `src/auth/auth.module.ts`, `auth.service.ts`, `auth.service.spec.ts`, `auth.controller.ts`, `auth.guard.ts`, `dto/login.dto.ts`, `current-operator.decorator.ts`, `src/common/cookies.ts`, `src/app.setup.ts`
- Modify: `src/main.ts` (`configureApp(app)` 호출), `src/app.module.ts`

**Interfaces:**
- Produces: `AuthService.login(email, password): Promise<{session: Session, operator: Operator}>` (실패 시 `UnauthorizedException`), `AuthService.validateSession(id): Promise<Operator|null>`, `AuthService.logout(id)`. `AuthGuard`(`CanActivate`): `req.cookies.sid` → operator를 `req.operator`에 부착. `SESSION_COOKIE = 'sid'`, `sessionCookieOptions(ttlSeconds)`.

- [ ] **Step 1: 단위 테스트 `auth.service.spec.ts`** — 리포지토리 mock(`{findOne, save, delete}`)으로: 올바른 비밀번호면 세션 생성·`expiresAt = now + ttl`, 틀리면 `UnauthorizedException`, 만료 세션은 `validateSession` null. Commit `test: 인증 서비스 테스트`.
- [ ] **Step 2: 구현**

`src/common/cookies.ts`
```ts
import type { CookieOptions } from 'express';
export const SESSION_COOKIE = 'sid';
export const VISITOR_COOKIE = 'vid';
export const sessionCookieOptions = (ttlSeconds: number): CookieOptions => ({ httpOnly: true, sameSite: 'lax', path: '/api/admin', maxAge: ttlSeconds * 1000 });
export const visitorCookieOptions = (): CookieOptions => ({ httpOnly: true, sameSite: 'lax', path: '/p', maxAge: 365 * 24 * 3600 * 1000 });
```

컨트롤러 `@Controller('api/admin/auth')`: `POST login` → `res.cookie(SESSION_COOKIE, session.id, sessionCookieOptions(ttl))`, 200 `{operator:{id,email}}` (`@HttpCode(200)`). `POST logout` → `@UseGuards(AuthGuard)`, 세션 삭제, `res.clearCookie(SESSION_COOKIE, {path:'/api/admin'})`, 204. `GET me` → `@UseGuards(AuthGuard)`, `{id,email}`.

`AuthGuard`: 쿠키 없음/세션 없음/만료 → `UnauthorizedException`. 만료 세션은 삭제.

`src/app.setup.ts`: `export function configureApp(app: INestApplication): void { app.use(cookieParser()); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); }`. `main.ts`는 `configureApp(app)`을 호출한다. Track D의 `createTestApp`이 같은 함수를 쓴다. CORS는 전역으로 켜지 않는다.

- [ ] **Step 3: 테스트 통과·커밋** `feat: 운영자 로그인/로그아웃/세션 가드`

### Task B3: HTML 템플릿 모듈

**Files:**
- Create: `src/templates/templates.module.ts`, `templates.service.ts`, `templates.service.spec.ts`, `templates.controller.ts`, `html-validation.ts`, `dto/template-response.dto.ts`

**Interfaces:**
- Produces: `validateHtmlUpload(file: {originalname: string; size: number; buffer: Buffer}): void` (위반 시 `BadRequestException` 메시지: `'.html 파일만 등록할 수 있습니다'`, `'파일 크기는 512KB 이하여야 합니다'`, `'HTML에 <form> 태그가 필요합니다'`). `TemplatesService.create(file, name?)`, `findAll()`, `findOne(id)`(404). `MAX_HTML_BYTES = 524288`.

- [ ] **Step 1: 단위 테스트 `templates.service.spec.ts`** — `validateHtmlUpload` 4케이스(정상, 확장자, 크기, form 없음), `create`가 name 미지정 시 originalname에서 `.html` 제거해 name으로 사용. Commit `test: HTML 템플릿 검증 테스트`.
- [ ] **Step 2: 구현** — 컨트롤러 `@Controller('api/admin/templates') @UseGuards(AuthGuard)`, `@Post() @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_HTML_BYTES } }))`, `@ApiConsumes('multipart/form-data')`. Multer 크기 초과 오류(`PayloadTooLargeException`)는 400으로 변환하는 `@Catch` 필터 또는 `fileFilter`로 처리해 항상 400이 되게 한다. 목록/상세 응답에서 목록은 `html` 제외.
- [ ] **Step 3: 커밋** `feat: HTML 템플릿 등록·조회`

### Task B4: 캠페인·폼 모듈

**Files:**
- Create: `src/campaigns/{campaigns.module,campaigns.service,campaigns.controller}.ts`, `dto/{create-campaign,update-campaign}.dto.ts`, `src/forms/{forms.module,forms.service,forms.service.spec,forms.controller}.ts`, `dto/{create-form,update-form}.dto.ts`, `src/common/slug.ts`, `src/common/slug.spec.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` (소문자, 한글·영숫자 유지, 공백→`-`, 나머지 제거, 빈 값이면 `form`), `randomSuffix(n=4)`. `FormsService.create(dto)`: slug 미지정 시 `${slugify(name)}-${randomSuffix()}`; 중복 slug `ConflictException`; campaignId/templateId 없으면 404. `FormsService.toResponse(form): FormResponse` (publicUrl 포함). `CampaignsService.findOne(id)`는 `forms` 포함.
- 컨트롤러: `api/admin/campaigns` (POST/GET/GET :id/PATCH :id), `api/admin/forms` (POST/GET?campaignId/GET :id(links 포함)/PATCH :id). `GET /api/admin/campaigns/:id/stats`는 B7에서 추가.

- [ ] **Step 1: 테스트** `slug.spec.ts`(4케이스), `forms.service.spec.ts`(slug 자동 생성, 중복 409, publicUrl 조합). Commit `test: 슬러그와 폼 서비스 테스트`.
- [ ] **Step 2: 구현·커밋** `feat: 캠페인·커스텀 폼 CRUD`

### Task B5: 배포 링크 모듈

**Files:**
- Create: `src/links/{links.module,links.service,links.service.spec,links.controller}.ts`, `dto/create-link.dto.ts`, `src/common/code.ts`

**Interfaces:**
- Produces: `generateCode(len=8): string` (base62). `LinksService.create(formId, channel)`: 폼 404, 같은 채널 존재 시 409, code 충돌 시 재생성(최대 5회). `LinksService.findByForm(formId)`, `LinksService.findByCode(code): Promise<DistributionLink|null>`, `LinksService.toResponse(link, form): LinkResponse` (`url = ${publicBaseUrl}/p/${form.slug}?src=${code}`).
- 컨트롤러: `@Controller('api/admin/forms/:formId/links')` POST/GET. `channel`은 `@IsIn(CHANNELS)`.

- [ ] **Step 1: 테스트** `links.service.spec.ts`(url 형식, 중복 채널 409, 코드 길이 8·base62). Commit `test: 배포 링크 서비스 테스트`.
- [ ] **Step 2: 구현·커밋** `feat: 채널별 배포 링크 생성`

### Task B6: 공개 폼(방문 기록·래퍼 페이지·주입 스크립트·제출)

**Files:**
- Create: `src/public/{public.module,public.service,public.service.spec,public-page.controller,public-api.controller}.ts`, `src/public/inject.ts`, `src/public/inject.spec.ts`, `src/public/wrapper.ts`, `src/public/dto/create-submission.dto.ts`

**Interfaces:**
- Produces:
  - `buildInjectedHtml(html: string, opts: {submitUrl: string; visitToken: string}): string` — `</body>` 앞(대소문자 무시) 또는 끝에 `<script>` 삽입.
  - `buildWrapperPage(opts: {title: string; srcdoc: string}): string` — `<iframe sandbox="allow-scripts allow-forms" srcdoc="…(HTML 이스케이프)…" style="border:0;width:100%;height:100vh">`.
  - `buildCsp(publicBaseUrl: string): string` — 스펙 §2 4번 문자열.
  - `visitToken`은 `visit.id`(uuid)다. 래퍼 페이지는 srcdoc을 HTML 이스케이프하므로 응답 본문에는 `VISIT_TOKEN=&quot;<uuid>&quot;` 형태로 나타난다.
  - `PublicService.recordVisit({slug, src?, visitorId?, userAgent?}): Promise<{form, visit, visitor}>` — 폼 없음/비활성 `NotFoundException`; visitor 없거나 미존재면 생성, 있으면 `lastSeenAt` 갱신; `src`가 그 폼의 링크 코드면 `linkId/channel`, 아니면 `channel='direct'`.
  - `PublicService.submit(slug, dto: {visitToken: string; fields: Record<string, unknown>})` — 폼 404, `fields`가 객체가 아니거나 빈 객체면 400, visit 없거나 `visit.formId !== form.id`면 400. 저장 후 `{id, message: form.successMessage}`.
- 라우트: `GET /p/:slug` (`@Res()`로 직접 헤더·쿠키·HTML 응답, `Content-Type: text/html; charset=utf-8`, `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `Cache-Control: no-store`), `POST /api/public/forms/:slug/submissions` (`@Header('Access-Control-Allow-Origin','*')`, `OPTIONS` 프리플라이트도 204 + `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: POST`).

- [ ] **Step 1: 테스트** `inject.spec.ts`(`</BODY>` 앞 삽입, body 없으면 끝, submitUrl/visitToken 포함), `public.service.spec.ts`(direct 귀속, 링크 귀속, 비활성 404, 빈 fields 400, visitToken 폼 불일치 400). Commit `test: 공개 폼 방문·제출 테스트`.
- [ ] **Step 2: 주입 스크립트 본문 (`inject.ts`)**
```ts
export function buildInjectedHtml(html: string, opts: { submitUrl: string; visitToken: string }): string {
  const script = `<script>(function(){var SUBMIT_URL=${JSON.stringify(opts.submitUrl)};var VISIT_TOKEN=${JSON.stringify(opts.visitToken)};
function collect(form){var fd=new FormData(form);var out={};fd.forEach(function(v,k){if(typeof v!=='string')return;if(k in out){out[k]=[].concat(out[k],v)}else{out[k]=v}});return out;}
function show(form,cls,msg){var p=document.createElement('p');p.setAttribute('data-lead-'+cls,'');p.textContent=msg;return p;}
document.addEventListener('submit',function(ev){var form=ev.target;if(!(form instanceof HTMLFormElement))return;ev.preventDefault();ev.stopImmediatePropagation();
var btns=form.querySelectorAll('button,input[type=submit]');btns.forEach(function(b){b.disabled=true});
var old=form.querySelector('[data-lead-error]');if(old)old.remove();
fetch(SUBMIT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitToken:VISIT_TOKEN,fields:collect(form)})})
.then(function(r){return r.json().then(function(b){return {ok:r.status===201,body:b}})})
.then(function(res){if(res.ok){form.replaceWith(show(form,'success',res.body.message||'신청이 완료되었습니다.'))}else{form.prepend(show(form,'error',Array.isArray(res.body.message)?res.body.message.join(', '):(res.body.message||'제출에 실패했습니다.')));btns.forEach(function(b){b.disabled=false})}})
.catch(function(){form.prepend(show(form,'error','네트워크 오류가 발생했습니다.'));btns.forEach(function(b){b.disabled=false})});},true);
})();</script>`;
  const idx = html.search(/<\/body>/i);
  return idx === -1 ? html + script : html.slice(0, idx) + script + html.slice(idx);
}
```
- [ ] **Step 3: 구현·커밋** `feat: 공개 폼 페이지, 방문 기록, 신청 제출`

### Task B7: CRM 명단 조회와 성과 집계

**Files:**
- Create: `src/submissions/{submissions.module,submissions.service,submissions.controller}.ts`, `src/analytics/{analytics.module,analytics.service,analytics.service.spec,analytics.controller}.ts`, `src/analytics/conversion.ts`, `src/analytics/conversion.spec.ts`
- Modify: `src/campaigns/campaigns.controller.ts` (`GET :id/stats`)

**Interfaces:**
- Produces: `conversionRate(submissions: number, visitors: number): number`. `AnalyticsService.campaignStats(campaignId): Promise<CampaignStats>`, `channelStats(): Promise<ChannelStat[]>`(5행 고정), `campaignList(): Promise<CampaignRow[]>`. `SubmissionsService.list({campaignId?, formId?, page=1, limit=20})` → `{items, total, page, limit}`.
- SQL(QueryBuilder 또는 raw): visits는 `visits v JOIN forms f ON f.id=v.form_id WHERE f.campaign_id=$1` → `COUNT(*)`, `COUNT(DISTINCT v.visitor_id)`; submissions 동일; 채널 breakdown은 `GROUP BY channel` 후 `STAT_CHANNELS` 순서로 0 채움.

- [ ] **Step 1: 테스트** `conversion.spec.ts`(0 나눗셈 → 0, 1/3 → 0.3333, 2/2 → 1), `analytics.service.spec.ts`(raw 결과 병합: 없는 채널 0 채움·순서 고정). Commit `test: 전환율과 채널 집계 테스트`.
- [ ] **Step 2: 구현·커밋** `feat: CRM 명단 조회와 캠페인·채널 성과 집계`

### Task B9: 커버리지 설정 (ADR 0011)

**Files:** `apps/api/jest.cov.config.ts`, `apps/api/package.json`(scripts에 `test:cov`만 추가)

- `jest.cov.config.ts`: rootDir `.`, testRegex `.*\.(spec|e2e-spec)\.ts$`, ts-jest, timeout 30000, `collectCoverageFrom: ['src/**/*.ts','!src/main.ts','!src/openapi-export.ts','!src/migrations/**','!src/**/*.d.ts']`, `coverageThreshold.global: {lines:90, statements:90, functions:90, branches:80}`, reporters text+lcov.
- 스크립트 `"test:cov": "jest --config jest.cov.config.ts --coverage --runInBand"`.
- [ ] 커밋 `chore: API 커버리지 설정(test:cov)`

### Task B8: API 문서(Scalar, OpenAPI export)

**Files:**
- Create: `src/openapi.ts` (`buildOpenApiDocument(app)`), `src/openapi-export.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 구현**
```ts
// openapi.ts
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('리드마그넷 CRM API').setVersion('0.1.0')
    .addCookieAuth('sid', { type: 'apiKey', in: 'cookie', name: 'sid' }, 'sid').build();
  return SwaggerModule.createDocument(app, config);
}
// main.ts 추가
const document = buildOpenApiDocument(app);
app.getHttpAdapter().get('/api/docs-json', (_req, res) => res.json(document));
app.use('/api/docs', apiReference({ spec: { content: document } }));
// openapi-export.ts
process.env.DOCS_ONLY = '1';
const app = await NestFactory.create(AppModule, { logger: false });
fs.writeFileSync(path.resolve(__dirname, '../../../docs/openapi.json'), JSON.stringify(buildOpenApiDocument(app), null, 2));
```
- [ ] **Step 2: 확인·커밋** `pnpm --filter api openapi:export && test -f docs/openapi.json` → `feat: Scalar API 문서와 OpenAPI 내보내기` (docs/openapi.json 포함)

---

# Track C. 프론트엔드 (브랜치 `track/frontend`, 워크트리 `.worktrees/frontend`)

API 계약은 스펙 §4. 백엔드가 없는 동안은 `pnpm dev:web`으로 화면만 확인하고, 단위 테스트는 vitest로 돌린다. 모든 데이터 호출은 클라이언트 컴포넌트에서 `apiFetch`를 통해서만 한다.

### Task C1: API 클라이언트·포맷 유틸

**Files:**
- Create: `apps/web/lib/api.ts`, `lib/api.test.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/types.ts`

**Interfaces:**
- Produces: `apiFetch<T>(path: string, init?: RequestInit & {json?: unknown}): Promise<T>` — `credentials:'include'`, json이면 헤더·본문 설정, 401이면 현재 경로가 `/login`이 아닐 때만 `window.location.assign('/login')`(로그인 실패 토스트가 보이도록) 후 throw `ApiError(401)`, 그 외 비-2xx는 `ApiError(status, message)`, 204는 `undefined`. `formatRate(rate: number): string` (`0.3333` → `'33.3%'`), `formatDateKST(iso: string): string`. `lib/types.ts`에 스펙 §4의 `Campaign, CampaignStats, ChannelStat, CampaignRow, Form, Link, Template, Submission, SubmissionPage, Channel, CHANNELS, CHANNEL_LABELS` (`{instagram:'인스타그램', x:'X', youtube:'유튜브', threads:'스레드', direct:'직접 유입'}`).

- [ ] **Step 1: 테스트** `format.test.ts`(formatRate 3케이스), `api.test.ts`(`global.fetch` 모킹: 401 → location.assign 호출, 400 → ApiError message). Commit `test: API 클라이언트와 포맷 유틸 테스트`.
- [ ] **Step 2: 구현·커밋** `feat: API 클라이언트, 타입, 포맷 유틸`

### Task C2: 로그인과 인증 셸

**Files:**
- Create: `app/login/page.tsx`, `components/auth-gate.tsx`, `components/app-shell.tsx`
- Modify: `app/layout.tsx` (sonner `<Toaster/>`), `app/page.tsx`

- `/login`: shadcn Card + Input + Button. 성공 시 `router.replace('/')`. 실패 시 `toast.error('이메일 또는 비밀번호가 올바르지 않습니다')`.
- `AuthGate`(클라이언트): 마운트 시 `GET /api/admin/auth/me`, 401이면 apiFetch가 `/login`으로 보낸다. 로딩 중 스켈레톤.
- `AppShell`: 상단 내비(대시보드 `/`, 템플릿 `/templates`) + 로그아웃 버튼(`POST /api/admin/auth/logout` → `/login`).

- [ ] 구현·수동 확인(`pnpm dev:web`, 화면 렌더)·커밋 `feat: 로그인 화면과 인증 셸`

### Task C3: 대시보드

**Files:** `app/page.tsx`, `components/campaign-table.tsx`, `components/channel-table.tsx`, `components/create-campaign-dialog.tsx`, `components/stat-cards.tsx`

- 캠페인 표: `GET /api/admin/analytics/campaigns` → 이름(링크 `/campaigns/[id]`), 상태 Badge, 방문, 방문자, 신청, 전환율(`formatRate`).
- 채널 표: `GET /api/admin/analytics/channels` → 5행, 채널 라벨.
- 캠페인 생성 Dialog: 이름·설명 → `POST /api/admin/campaigns` → 목록 재조회 + toast.
- [ ] 커밋 `feat: 캠페인·채널 성과 대시보드`

### Task C4: 템플릿 페이지

**Files:** `app/templates/page.tsx`, `components/template-upload-form.tsx`, `components/template-table.tsx`

- 업로드: `<input type="file" accept=".html">` + 이름 → `FormData`로 `POST /api/admin/templates` (apiFetch에 json 없이 `body: formData`). 400 메시지를 toast로.
- 목록: 이름, 파일명, 크기(KB), 등록일(KST).
- [ ] 커밋 `feat: HTML 템플릿 등록 화면`

### Task C7: AI 생성 안내 박스 (ADR 0012)

**Files:** `components/ai-prompt-box.tsx`, `components/ai-prompt-box.test.tsx`, `app/templates/page.tsx`(배치)

- 템플릿 페이지 상단(업로드 폼 위)에 Card: 제목 "AI로 만들기", 한 줄 설명("아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요"), `docs/ai-generation-guide.md` §2 프롬프트 템플릿 전문을 `<pre>`로, "프롬프트 복사" 버튼(`navigator.clipboard.writeText` + toast "프롬프트를 복사했습니다"), 조건 요약 3줄(`.html` 하나, `<form>`과 `name` 필수, 외부 스크립트 없음).
- 프롬프트 문자열은 `lib/ai-prompt.ts`의 상수 `AI_PROMPT_TEMPLATE`로 두고 가이드 문서와 같은 내용을 유지한다.
- [ ] `test:` 커밋(렌더·복사 버튼 → clipboard 호출·toast) → `feat: 템플릿 페이지 AI 생성 안내` 커밋

### Task C6: 커버리지 설정 (ADR 0011)

**Files:** `apps/web/package.json`(devDependency `@vitest/coverage-v8`, script `test:cov`), `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`

- `vitest.config.ts` `test.coverage`: provider v8, include `app/**`, `components/**`, `lib/**`, exclude `components/ui/**`, `app/layout.tsx`, 테스트 파일, setup; thresholds lines/statements/functions 90, branches 80. `setupFiles: ['./vitest.setup.ts']`(`@testing-library/jest-dom/vitest`).
- C2~C5는 화면·컴포넌트마다 `test:` 커밋(RTL, `@/lib/api`·`next/navigation` 모킹) → `feat:` 커밋.
- [ ] 커밋 `chore: 관리자 화면 커버리지 설정(test:cov)`

### Task C5: 캠페인 상세(폼·배포 링크·신청 명단)

**Files:** `app/campaigns/[id]/page.tsx`, `components/campaign-header.tsx`, `components/form-list.tsx`, `components/create-form-dialog.tsx`, `components/link-panel.tsx`, `components/submission-table.tsx`

- 헤더: `GET /api/admin/campaigns/:id` + `GET /api/admin/campaigns/:id/stats` → StatCards(방문/방문자/신청/전환율) + 채널 breakdown 표.
- 폼 목록: `GET /api/admin/forms?campaignId=` → 이름, slug, 활성 토글(`PATCH isActive`), 공개 URL 복사.
- 폼 생성 Dialog: 템플릿 select(`GET /api/admin/templates`), 이름, 성공 메시지 → `POST /api/admin/forms`.
- LinkPanel(폼별): `GET /api/admin/forms/:id/links`; 4채널 각각 "링크 만들기"(`POST … {channel}`) 또는 이미 있으면 URL + 복사 버튼(`navigator.clipboard.writeText` + toast). 409는 재조회.
- 신청 명단: `GET /api/admin/submissions?campaignId=&page=` → 시각(KST), 폼, 채널, payload를 `key: value` 목록으로. 페이지네이션(이전/다음).
- [ ] 커밋 `feat: 캠페인 상세, 폼·배포 링크 관리, 신청 명단`

---

# Track D. 테스트 (브랜치 `track/test`, 워크트리 `.worktrees/test`)

e2e는 스펙 §4 계약을 **그대로** 검증한다. Track A 스켈레톤에서는 모두 실패(404)하는 것이 정상이며, 실패 상태로 커밋한다(`test:`). 각 스펙 파일은 `beforeAll(createTestApp)`, `beforeEach(truncateAll)`, `afterAll(close)`.

### Task D1: 테스트 유틸과 픽스처

**Files:**
- Create: `apps/api/test/utils.ts`, `test/fixtures/valid-form.html`, `test/fixtures/no-form.html`, `test/fixtures/README.md`

**Interfaces:**
- Produces:
```ts
export interface TestContext { app: INestApplication; ds: DataSource; http: () => request.SuperTest<request.Test>; }
export async function createTestApp(): Promise<TestContext>; // DATABASE_URL을 TEST_DATABASE_URL로 덮고 AppModule 부팅, cookieParser·ValidationPipe 적용(main.ts와 동일 설정을 export한 `configureApp(app)`을 백엔드가 제공하면 그것을 사용), 마이그레이션 실행
export async function truncateAll(ds: DataSource): Promise<void>; // submissions, visits, visitors, distribution_links, forms, campaigns, html_templates, sessions, operators 순 TRUNCATE ... CASCADE
export async function seedOperator(ds: DataSource, email = 'admin@example.com', password = 'admin1234'): Promise<void>; // bcryptjs 해시 직접 insert
export async function loginAgent(ctx: TestContext): Promise<{ agent: request.SuperAgentTest; cookie: string }>; // POST login 후 sid 쿠키 보관
export async function createFixtureFlow(agent): Promise<{ templateId; campaignId; form: {id; slug}; links: Record<Channel, {code; url}> }>; // 템플릿 업로드→캠페인→폼→4채널 링크
```
- `TEST_DATABASE_URL` 없으면 `DATABASE_URL`의 db명에 `_test` 접미사. `main.ts`의 앱 설정 함수 이름은 `configureApp(app: INestApplication): void`로 **백엔드와 합의**(`src/app.setup.ts`). 백엔드 트랙은 이 파일을 반드시 만든다.

- [ ] 픽스처 `valid-form.html`: `<form><input name="name" required><input name="email" type="email"><select name="interest" multiple>…</select><button type="submit">신청</button></form>` 포함한 완전한 HTML. `no-form.html`: form 없는 문서.
- [ ] 커밋 `test: e2e 테스트 유틸과 HTML 픽스처`

### Task D2~D8: e2e 스펙

각 파일에 아래 케이스를 `it`로 작성한다. 상태 코드·필드명은 스펙 §4.

**D2 `auth.e2e-spec.ts`**: 로그인 200 + `set-cookie`에 `sid=`, `Path=/api/admin`, `HttpOnly`, `SameSite=Lax` 포함 / 틀린 비밀번호 401 / 없는 이메일 401 / 쿠키 없이 `GET /api/admin/campaigns` 401 / `GET me` 200 / 로그아웃 204 후 `me` 401.

**D3 `templates.e2e-spec.ts`**: `.attach('file', fixture)` 정상 201(`id,name,originalFilename,sizeBytes`) / `.txt` 400 / 600KB 버퍼 400 / form 없음 400 / 목록에 `html` 없음 / 상세에 `html` 있음 / 없는 id 404 / 미인증 401.

**D4 `campaigns-forms.e2e-spec.ts`**: 캠페인 생성 201·조회·PATCH status / 이름 없이 생성 400 / 폼 생성 201(`slug`, `publicUrl` = `${PUBLIC_BASE_URL}/p/${slug}`) / slug 자동 생성 / 같은 slug 409 / 없는 templateId 404 / `GET forms?campaignId` 필터 / PATCH isActive false.

**D5 `links.e2e-spec.ts`**: 4채널 생성 201(`url`이 `/p/${slug}?src=${code}`, code 8자) / 같은 채널 재생성 409 / 잘못된 채널 400 / 없는 폼 404 / 목록.

**D6 `public.e2e-spec.ts`**: `GET /p/:slug?src=code` 200, `text/html`, `set-cookie`에 `vid=`·`Path=/p`, 본문에 `sandbox="allow-scripts allow-forms"`와 `srcdoc` / 같은 vid로 2회 방문 시 visits 2, visitors 1 (DB 직접 조회) / 없는 slug 404 / 비활성 폼 404 / 제출: 래퍼 본문에서 `VISIT_TOKEN` 값을 정규식으로 추출(srcdoc은 HTML 이스케이프되어 `VISIT_TOKEN=&quot;<uuid>&quot;` 형태. 정규식 `/VISIT_TOKEN=(?:"|&quot;)([0-9a-f-]{36})/`) → `POST /api/public/forms/:slug/submissions` 201 `{id, message}` + DB submissions 1행 `channel='instagram'`, `payload.name` / 빈 fields 400 / 잘못된 visitToken 400 / 다른 폼의 visitToken 400 / 응답 헤더 `access-control-allow-origin: *` / `OPTIONS` 204.

**D7 `isolation.e2e-spec.ts`**: `GET /p/:slug` 응답의 `content-security-policy`에 `connect-src ${PUBLIC_BASE_URL}/api/public/`와 `default-src 'none'` 포함, `x-frame-options: SAMEORIGIN` / srcdoc 안에 `allow-same-origin` 없음 / 로그인 쿠키 `Path=/api/admin`이라 `Cookie: sid=…`를 `GET /p/:slug`에 보내도 응답이 세션 정보를 포함하지 않음(단순히 200이며 body에 이메일 문자열 없음) / `/api/admin/campaigns`에 `Origin: null`로 요청 시 `access-control-allow-origin` 헤더 없음 / `/api/public/...`는 `sid` 쿠키를 보내도 관리자 데이터 미노출(`GET /api/public/forms/:slug/submissions` 404 또는 405).

**D8 `analytics.e2e-spec.ts`**: 픽스처 흐름 후 instagram 링크로 3회 방문(vid 2종), threads로 1회, direct 1회, 제출 2건(instagram) → `GET campaigns/:id/stats`: `visits=5, visitors=3(구현 정의에 맞춰 계산), submissions=2, conversionRate=round(2/visitors,4)`, `channels` 5행 순서 `direct,instagram,x,youtube,threads` / `GET analytics/channels` 합산 / `GET analytics/campaigns` 행에 캠페인 포함 / `GET submissions?campaignId` total 2, `formName` 포함 / 없는 캠페인 stats 404.

- [ ] 각 파일마다 커밋 `test: <영역> e2e`

### Task D9: Bruno 컬렉션

**Files:** `bruno/leadmagnet-crm/bruno.json`, `environments/local.bru`, `auth/login.bru`, `auth/me.bru`, `auth/logout.bru`, `templates/upload.bru`, `templates/list.bru`, `campaigns/create.bru`, `campaigns/stats.bru`, `forms/create.bru`, `forms/list.bru`, `links/create.bru`, `links/list.bru`, `public/page.bru`, `public/submit.bru`, `analytics/channels.bru`, `analytics/campaigns.bru`, `submissions/list.bru`

- `login.bru`의 `script:post-response`에서 `res.headers['set-cookie']`의 `sid`를 `bru.setVar('sid', …)`, 이후 요청은 `headers { Cookie: sid={{sid}} }`. `create` 요청은 `bru.setVar('campaignId'|'formId'|'slug'|'code', res.body.…)`. `page.bru`는 `res.body`에서 `VISIT_TOKEN` 추출해 `visitToken` 변수 저장(본문은 `VISIT_TOKEN=&quot;<uuid>&quot;` 형태, 정규식 `/VISIT_TOKEN=(?:"|&quot;)([0-9a-f-]{36})/`).
- 각 요청에 `assert { res.status: eq 201 }` 등 최소 어설션. `seq`로 실행 순서 고정.
- `page.bru`는 추가로 `res.headers['content-security-policy']`에 `frame-src 'self'` 포함, `res.body`에 `sandbox="allow-scripts allow-forms"` 포함을 단언한다(CI 통합 잡의 격리 검증, ADR 0010).
- 컬렉션은 `bru run bruno/leadmagnet-crm --env local`로 사람 개입 없이 처음부터 끝까지 통과해야 한다(CI에서 그대로 실행).
- [ ] 커밋 `test: Bruno API 컬렉션`

---

# Track E. 통합·검증·문서 (컨트롤러)

### Task E1: 머지
- [ ] `git merge track/backend` → `git merge track/test` → `git merge track/frontend`. 충돌은 `pnpm-lock.yaml`은 `pnpm install`로 재생성, `apps/api/package.json`은 합집합.
- [ ] `pnpm install && pnpm -r build`

### Task E2: 테스트 초록 만들기
- [ ] `docker compose --profile test run --rm api-test`(= `pnpm --filter api test:cov`, 커버리지 게이트 포함) 실행. 실패 스펙을 영역별로 나눠 Sonnet 수정 에이전트에 병렬 위임(스펙 §4가 권위. 테스트가 계약을 어겼으면 테스트를, 구현이 어겼으면 구현을 고친다. 판단은 컨트롤러 룰링으로 기록).
- [ ] `pnpm --filter web test:cov`, `pnpm --filter web build` 통과.
- [ ] 커버리지 미달 파일이 있으면 해당 트랙 에이전트에 테스트 추가를 위임(`test:` 커밋). 임계값은 낮추지 않는다.
- [ ] 수정 커밋은 `fix:`.

### Task E3: 수동 흐름 확인
- [ ] `docker compose up --build` → 3000 로그인 → 템플릿 업로드(`apps/api/test/fixtures/valid-form.html`) → 캠페인·폼 생성 → 인스타그램 링크 복사 → 시크릿 창에서 링크 열기·제출 → 대시보드에서 방문 1/방문자 1/신청 1/전환율 100% 확인.
- [ ] `pnpm bruno:run` 통과. `bash scripts/ci-smoke.sh` 통과.

### Task E4: 문서 마무리
- [ ] `pnpm openapi:export` 결과 커밋. README 실행/테스트 절차가 실제와 일치하는지 재확인(README에는 실행·테스트만).
- [ ] ADR에 구현 중 바뀐 결정이 있으면 새 번호로 추가. `docs/adr/README.md` 갱신.
- [ ] 제출 메일 초안(저장소 주소, 미완료 항목)은 저장소 밖 비공개 노트 디렉터리(저장소의 형제 디렉터리 `../rizz-notes/`)의 `submission.md`에 작성.

### Task E5: 최종 리뷰
- [ ] superpowers:requesting-code-review로 브랜치 전체 리뷰 1회. 발견 사항은 한 번의 수정 디스패치로 처리.
- [ ] `git log --oneline`에서 test:/feat: 분리와 기능 단위 커밋 확인.

### Task E5-1: 원격 push와 CI 녹색 확인 (ADR 0010)
- [ ] **제출용 개인 GitHub 계정으로만 push한다.** `gh auth status`로 활성 계정이 개인 계정인지 확인하고, 아니면 사용자에게 `gh auth switch`를 요청한다. 저장소 이름·공개 여부를 확인한 뒤 `gh repo create` → `git push -u origin main`.
- [ ] `gh run watch`로 `api`, `web`, `integration` 세 잡이 녹색인지 확인. 실패하면 `compose-logs` 아티팩트로 원인 파악 후 `fix:` 커밋. 로컬에서 재현되지 않는 CI 전용 실패(포트, 헬스체크 타이밍)는 워크플로 수정(`chore:`)으로 처리.
- [ ] 제출 메일 초안에 최신 CI 실행 링크를 적는다.

---

## Self-Review 기록

- **Spec coverage:** §2 격리(B6, D7), §3 모델·집계(B1, B7, D8), §4.1~4.7(B2~B7, D2~D8), §5 화면(C2~C5), §6.5 문서(B8, D9), §7 환경(A4), §9 테스트(B*, D*), §9.1 CI(A5, E5-1), ADR 0011 커버리지(B9, C6, E2), §10 커밋 규칙(Global). Seed AC 11개 모두 대응 태스크 존재.
- **Placeholder scan:** 없음. 엔티티 축약 표기는 형태 안내이며 구현 시 완전한 데코레이터를 쓴다고 명시.
- **Type consistency:** `configureApp`(B2/D1), `buildInjectedHtml`(B6/D6), `STAT_CHANNELS` 순서(B1/B7/D8/C1), 쿠키 이름·Path(B2/B6/D2/D6/D7), `publicUrl`/`url` 조합(B4/B5/D4/D5) 일치 확인.
