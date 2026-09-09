# 리드마그넷 CRM 운영 시스템 설계

- 근거 명세: `docs/ouroboros/seed.yaml` (불변). 이 문서는 Seed의 결정을 구현 가능한 계약으로 풀어 쓴 것이다.
- 일정: 2026-09-09 수령, 2026-09-12 제출.

## 1. 목표와 범위

운영자가 로그인해 AI가 만든 단일 `.html` 파일을 등록하고, 캠페인과 커스텀 신청 폼을 만들어 인스타그램·X·유튜브·스레드용 배포 링크를 발급한다. 방문자는 격리된 공개 폼에서 신청하고, 운영자는 캠페인별·채널별 방문/방문자/신청/전환율을 본다.

범위 밖: 실제 AI 연동, 외부 CRM/문자/알림톡/광고 연동, 범용 폼 빌더, 결제·계약·상담사 관리, 클라우드 데모, Playwright.

## 2. 아키텍처

```
브라우저(운영자) ──http://localhost:3000──▶ apps/web (Next.js 16)
                                            │  /api/* rewrite (same-origin, 쿠키 동봉)
                                            ▼
                                     apps/api (NestJS 11) :3001
                                      ├─ /api/admin/*   세션 쿠키 필수
                                      ├─ /api/public/*  무인증, CORS *
                                      ├─ /p/:slug       공개 폼 래퍼 페이지
                                      └─ /api/docs      Swagger
                                            │
                                            ▼
                                     PostgreSQL 16 (db) / PostgreSQL 16 (db-test, profile test)

브라우저(방문자) ──http://localhost:3001/p/:slug?src=CODE──▶ 래퍼 페이지
                    └─ <iframe sandbox="allow-scripts allow-forms" srcdoc=...> 등록 HTML + 주입 스크립트
                                                └─ fetch POST /api/public/forms/:slug/submissions
```

### 격리 원칙 (비기능 요구 1)

1. 관리자 화면(3000)과 공개 폼(3001)은 다른 오리진이다.
2. 관리자 세션 쿠키 `sid`는 `Path=/api/admin; HttpOnly; SameSite=Lax`. 3000 오리진에서 rewrite로 `/api/admin/*`을 호출할 때만 동봉된다. `/p/*`, `/api/public/*` 요청에는 경로 불일치로 전송되지 않는다.
3. 등록 HTML은 `srcdoc` + `sandbox="allow-scripts allow-forms"`(allow-same-origin 없음)으로 렌더링된다. 문서 오리진이 opaque(`null`)이므로 `document.cookie`, `localStorage`, 부모 창 DOM 접근이 모두 불가하다.
4. 래퍼 페이지 응답 헤더 `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src * data:; font-src * data:; connect-src ${PUBLIC_BASE_URL}/api/public/; frame-src 'self'; form-action 'none'; base-uri 'none'`. srcdoc 문서는 부모 CSP를 상속하므로 iframe 안 스크립트도 `/api/public/` 외에는 네트워크를 열 수 없다. `X-Frame-Options`는 래퍼에만 `SAMEORIGIN`.
5. 관리자 API는 `Access-Control-Allow-Origin`을 내지 않는다. 공개 API만 `*`(credentials 없음).
6. 관리자 토큰을 브라우저 저장소에 두지 않는다(세션 쿠키만).

## 3. 데이터 모델 (PostgreSQL, snake_case, uuid pk = gen_random_uuid())

| 테이블 | 컬럼 |
|---|---|
| operators | id, email UNIQUE, password_hash, created_at |
| sessions | id, operator_id FK, expires_at, created_at |
| html_templates | id, name, original_filename, html TEXT, size_bytes INT, created_at |
| campaigns | id, name, description NULL, status ENUM('active','archived') DEFAULT 'active', created_at, updated_at |
| forms | id, campaign_id FK, template_id FK, name, slug UNIQUE, success_message DEFAULT '신청이 완료되었습니다.', is_active BOOL DEFAULT true, created_at, updated_at |
| distribution_links | id, form_id FK, channel ENUM('instagram','x','youtube','threads'), code VARCHAR(12) UNIQUE, created_at, UNIQUE(form_id, channel) |
| visitors | id, first_seen_at, last_seen_at |
| visits | id, form_id FK, visitor_id FK, link_id FK NULL, channel VARCHAR(16) ('direct' 또는 채널), user_agent TEXT NULL, created_at. INDEX(form_id), INDEX(link_id) |
| submissions | id, form_id FK, visit_id FK, visitor_id FK, link_id FK NULL, channel VARCHAR(16), payload JSONB, created_at. INDEX(form_id), INDEX(created_at) |

- 마이그레이션: `apps/api/src/migrations/*.ts`, TypeORM DataSource `apps/api/src/data-source.ts`. `synchronize: false`.
- 시드: `apps/api/src/seed.ts` — `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 operators upsert (bcrypt cost 10).

### 집계 정의
- visits = 캠페인 소속 폼들의 visits 행 수
- visitors = 그 visits의 `COUNT(DISTINCT visitor_id)`
- submissions = 캠페인 소속 폼들의 submissions 행 수
- conversionRate = visitors = 0 ? 0 : submissions / visitors (소수 4자리 반올림, 0.0~1.0)
- 채널 breakdown = 위 4개를 `channel`로 GROUP BY. 채널 목록은 항상 `direct, instagram, x, youtube, threads` 5행(없으면 0).

## 4. API 계약

공통: JSON, 오류 형식 `{ statusCode, message, error }`(Nest 기본). 검증 실패 400, 미인증 401, 없음 404, 중복 409. 모든 `/api/admin/*`은 `AuthGuard`(세션 쿠키) 적용.

### 4.1 인증 `/api/admin/auth`
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | /login | `{email, password}` | 200 `{operator:{id,email}}` + `Set-Cookie: sid=<uuid>; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=604800`. 실패 401 |
| POST | /logout | – | 204, 쿠키 만료 |
| GET | /me | – | 200 `{id,email}` / 401 |

### 4.2 HTML 템플릿 `/api/admin/templates`
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | / | multipart `file`(.html), `name?` | 201 `{id,name,originalFilename,sizeBytes,createdAt}`. 400: 확장자≠.html, >512KB, `<form` 없음 |
| GET | / | – | 200 `[{id,name,originalFilename,sizeBytes,createdAt}]` |
| GET | /:id | – | 200 `{…, html}` / 404 |

### 4.3 캠페인 `/api/admin/campaigns`
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | / | `{name, description?}` | 201 Campaign |
| GET | / | – | 200 `Campaign[]` |
| GET | /:id | – | 200 Campaign(+`forms: FormSummary[]`) / 404 |
| PATCH | /:id | `{name?, description?, status?}` | 200 Campaign |
| GET | /:id/stats | – | 200 `CampaignStats` |

`Campaign = {id,name,description,status,createdAt,updatedAt}`
`CampaignStats = {campaignId, visits, visitors, submissions, conversionRate, channels:[{channel, visits, visitors, submissions, conversionRate}]}`

### 4.4 폼 `/api/admin/forms`
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | / | `{campaignId, templateId, name, slug?, successMessage?}` | 201 Form. slug 미지정 시 name 기반 slugify + 4자 난수. 중복 slug 409 |
| GET | /?campaignId= | – | 200 `Form[]` |
| GET | /:id | – | 200 Form(+`links: Link[]`) / 404 |
| PATCH | /:id | `{name?, successMessage?, isActive?, templateId?}` | 200 Form |
| POST | /:id/links | `{channel}` | 201 Link. 같은 채널 중복 409 |
| GET | /:id/links | – | 200 `Link[]` |

`Form = {id,campaignId,templateId,name,slug,successMessage,isActive,publicUrl,createdAt,updatedAt}` (`publicUrl = ${PUBLIC_BASE_URL}/p/${slug}`)
`Link = {id,formId,channel,code,url,createdAt}` (`url = ${PUBLIC_BASE_URL}/p/${slug}?src=${code}`, code = 8자 base62)

### 4.5 CRM 명단 `/api/admin/submissions`
| GET | /?campaignId=&formId=&page=1&limit=20 | 200 `{items:[{id,formId,formName,campaignId,channel,payload,createdAt}], total, page, limit}` (createdAt DESC) |

### 4.6 채널 성과 `/api/admin/analytics`
| GET | /channels | 200 `[{channel, visits, visitors, submissions, conversionRate}]` 전체 캠페인 합산, 5행 고정 |
| GET | /campaigns | 200 `[{campaignId, name, status, visits, visitors, submissions, conversionRate}]` 대시보드용 |

### 4.7 공개
| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | /p/:slug?src=CODE | 폼 없음/비활성 404. `vid` 쿠키 없으면 visitors 생성 후 `Set-Cookie: vid=<uuid>; Path=/p; HttpOnly; SameSite=Lax; Max-Age=31536000`. visits 1행 생성(src가 유효한 링크 코드면 link_id/channel, 아니면 direct). 위 CSP 헤더와 함께 래퍼 HTML 반환. 래퍼는 `<iframe sandbox="allow-scripts allow-forms" srcdoc="…등록 HTML + 주입 스크립트…">`를 전체 화면으로 렌더한다. |
| POST | /api/public/forms/:slug/submissions | 본문 `{visitToken: <visit id>, fields: {name: string \| string[]}}`. 폼 없음/비활성 404, visitToken이 그 폼의 visit가 아니면 400, fields가 빈 객체면 400. 201 `{id, message: form.successMessage}`. `Access-Control-Allow-Origin: *`. |

주입 스크립트(`apps/api/src/public/inject.ts`가 문자열 생성) 동작:
1. `document.querySelectorAll('form')` 각각에 submit 리스너 등록, `preventDefault()`.
2. `new FormData(form)` → `{name: value | value[]}` (name 없는 입력 제외).
3. `fetch(SUBMIT_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({visitToken, fields})})`.
4. 201이면 form을 `<p data-lead-success>message</p>`로 교체, 아니면 form 위에 `<p data-lead-error>` 표시. 진행 중 submit 버튼 disabled.
5. HTML 안에 `</body>`가 있으면 그 앞, 없으면 문서 끝에 `<script>` 삽입.

## 5. 관리자 화면 (apps/web, Next.js 16 App Router, shadcn/ui)

| 경로 | 내용 |
|---|---|
| /login | 이메일/비밀번호 → POST /api/admin/auth/login. 성공 시 `/` |
| / | 대시보드: 캠페인별 성과 표(GET /api/admin/analytics/campaigns) + 채널별 성과 표(GET /api/admin/analytics/channels) + 캠페인 생성 다이얼로그 |
| /templates | HTML 업로드 폼(파일 + 이름) + 목록 |
| /campaigns/[id] | 캠페인 정보·stats 카드·채널 breakdown, 폼 목록 + 폼 생성 다이얼로그(템플릿 선택·이름·성공 메시지), 폼마다 배포 링크 4채널 생성/복사 버튼과 공개 URL, 신청 명단 표(GET /api/admin/submissions?campaignId=) |

- 데이터 접근: 클라이언트 컴포넌트에서 `fetch('/api/admin/…', {credentials:'include'})`. `next.config.ts` rewrites `/api/:path*` → `${API_INTERNAL_URL}/api/:path*`.
- 401이면 `/login`으로 이동(`lib/api.ts`의 공통 fetch 래퍼).
- 테스트: vitest + @testing-library/react로 `lib/format.ts`(전환율 % 표시), `lib/api.ts`(401 처리) 단위 테스트.

## 6. 디렉터리 구조

```
.
├── docker-compose.yaml        # db, api, web + profile test: db-test, api-test
├── .env.example
├── package.json  pnpm-workspace.yaml  pnpm-lock.yaml  tsconfig.base.json
├── apps/api/                  # NestJS
│   ├── Dockerfile  nest-cli.json  package.json  tsconfig*.json  jest.config.ts  test/jest-e2e.json
│   ├── src/main.ts  app.module.ts  data-source.ts  seed.ts  config/env.ts
│   ├── src/migrations/1757400000000-init.ts
│   ├── src/common/  (guards, filters, utils: slug, code)
│   ├── src/auth/  templates/  campaigns/  forms/  links/  submissions/  analytics/  public/
│   └── test/*.e2e-spec.ts (auth, templates, campaigns-forms, links, public, isolation, analytics) + test/fixtures/*.html + test/utils.ts
├── apps/web/                  # Next.js
│   ├── Dockerfile  package.json  next.config.ts
│   ├── app/(login, page, templates, campaigns/[id])  components/  lib/
├── bruno/leadmagnet-crm/      # 컬렉션 + environments/local.bru
├── docs/adr/  docs/openapi.json  docs/ouroboros/  docs/superpowers/
└── README.md
```

## 6.5 API 문서 (ADR 0009)
- `@nestjs/swagger` + nest-cli 플러그인으로 OpenAPI 생성. 컨트롤러마다 `@ApiTags`, 관리자 컨트롤러는 `@ApiCookieAuth('sid')`.
- `/api/docs` = Scalar API Reference(`@scalar/nestjs-api-reference`), `/api/docs-json` = OpenAPI JSON.
- `pnpm --filter api openapi:export` → `docs/openapi.json` (DB 연결 없이 `NestFactory.create(AppModule)` 대신 문서 전용 부트스트랩: `TypeOrmModule`을 `useFactory`로 지연 초기화하지 않고, `SwaggerModule.createDocument`를 위해 `AppModule`을 만들되 `DATABASE_URL`이 없으면 TypeORM `autoLoadEntities`만 두고 연결을 건너뛰는 `DOCS_ONLY=1` 플래그를 지원).
- Bruno 컬렉션 `bruno/leadmagnet-crm/`: 폴더 `auth`, `templates`, `campaigns`, `forms`, `links`, `public`, `analytics`; `environments/local.bru`(`baseUrl=http://localhost:3001`). `pnpm bruno:run` = `bru run bruno/leadmagnet-crm --env local`.

## 7. 실행·테스트 환경 (docker-compose.yaml)

- `docker compose up --build` → db(5432, volume) + api(3001; 기동 시 `migration:run` → `seed` → `start:prod`) + web(3000).
- `docker compose --profile test run --rm api-test` → db-test(tmpfs, 별도 서비스) 기동 후 `pnpm --filter api test && pnpm --filter api test:e2e` 실행. `DATABASE_URL`이 db-test를 가리킨다.
- 로컬 개발: `pnpm install`, `docker compose up db`, `pnpm --filter api start:dev`, `pnpm --filter web dev`. e2e는 `TEST_DATABASE_URL`을 읽으며 없으면 `DATABASE_URL`의 db명에 `_test`를 붙인다.
- 이미지: `node:22-alpine`, pnpm 10은 `corepack enable`로 고정(`package.json`의 `packageManager` 필드). api Dockerfile은 컨텍스트가 저장소 루트인 다단계 빌드(deps → build → runner). web은 `pnpm --filter web build` 후 `next start`로 실행한다(standalone 미사용).
- api 컨테이너 엔트리: `node dist/data-source-cli.js migration:run` 대신 `pnpm --filter api migration:run && pnpm --filter api seed && node apps/api/dist/main.js` 순서의 `apps/api/docker-entrypoint.sh`.
- 시간: DB는 `timestamptz`, API는 ISO 8601 UTC 반환, 화면은 `Asia/Seoul`로 표시.
- 환경변수: `DATABASE_URL`, `TEST_DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_TTL_SECONDS=604800`, `PUBLIC_BASE_URL=http://localhost:3001`, `API_INTERNAL_URL=http://api:3001`(web→api rewrite), `PORT`.

## 8. 오류 처리
- DTO는 class-validator, 전역 `ValidationPipe({whitelist:true, transform:true})`.
- 업로드는 Multer 메모리 스토리지, `fileFilter`로 확장자, `limits.fileSize=524288`, 서비스에서 `<form` 검사.
- 공개 제출은 트랜잭션 없이 단일 insert. visitToken 검증은 visit 존재 + form_id 일치.

## 9. 테스트 전략
- 단위(Jest): `analytics.service`(전환율 계산·0 나눗셈), `templates.service`(검증 규칙), `links.service`(URL/코드), `public/inject`(스크립트 삽입 위치), `forms.service`(slug 생성).
- e2e(supertest, 실 DB, 각 파일 시작 시 테이블 TRUNCATE): 성공/실패 흐름 전부. isolation 스펙은 `/p/:slug` 응답의 `sandbox` 속성·CSP 헤더·쿠키 Path를 검사하고, `sid` 쿠키를 들고 `/api/public/*`에 요청해도 관리자 API에는 401임을 확인한다.
- Bruno: 폴더별 요청 + `environments/local.bru`.

## 10. 커밋 규칙
기능 단위 커밋. `test: …` 커밋(실패하는 테스트) 다음 `feat: …` 커밋(구현). infra/docs는 `chore:`/`docs:`.
