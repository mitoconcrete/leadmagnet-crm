# 리드마그넷 CRM 운영 시스템

## 실행
1. `cp .env.example .env`
2. `docker compose up --build`
3. 관리자 화면 http://localhost:3000 (계정: `.env`의 ADMIN_EMAIL / ADMIN_PASSWORD)
4. API 문서 http://localhost:3001/api/docs (OpenAPI JSON: http://localhost:3001/api/docs-json, 파일: `docs/openapi.json`)

## 테스트
- 도커: `docker compose --profile test run --rm api-test` (단위 + e2e + 커버리지 게이트 90%, 테스트 전용 DB)
- 로컬: `pnpm install` → `docker compose up -d db db-test` → `pnpm test` → `pnpm test:e2e`
- 관리자 화면 단위 테스트: `pnpm --filter web test` (커버리지 게이트: `pnpm --filter web test:cov`)
- Bruno 컬렉션: API 실행 후 `pnpm bruno:run`
- CI: `.github/workflows/ci.yml`이 push/PR마다 위 절차(단위·e2e, 웹 빌드, compose 스택 통합 스모크)를 자동 실행

## 로컬 개발
`docker compose up -d db` → `pnpm --filter api migration:run:dev && pnpm --filter api seed:dev` → `pnpm dev:api`, `pnpm dev:web`
