# ADR 0001. NestJS + Next.js pnpm 모노레포 채택

- 상태: 채택 (2026-09-09)

## 맥락
과제는 기술 스택이 자유이며 3일 안에 "폼 생성 → 배포 → 전환 확인" 흐름을 완성해야 한다. 단일 Next.js 앱이 가장 빠르지만, 대상 조직의 실제 스택은 NestJS 백엔드(front-api/admin-api/webhook-api)와 Next.js 16 관리자 화면, TypeORM, PostgreSQL이다.

## 결정
pnpm 워크스페이스에 `apps/api`(NestJS 11, TypeORM 0.3, PostgreSQL 16)와 `apps/web`(Next.js 16 App Router, React 19, shadcn/ui)를 둔다. 관리자 화면은 API를 rewrite로 호출한다.

## 근거
- 관리자 API와 공개 폼을 한 서버가 서로 다른 접두사로 제공하면서, 관리자 화면은 별도 오리진에 두는 격리 구조가 자연스럽다.
- 백엔드 모듈 경계(auth/templates/campaigns/forms/links/submissions/analytics/public)를 NestJS 모듈로 드러내면 코드 리뷰가 쉽다.
- 공고 스택과 동일한 도구를 써서 실무 적합성을 보여 준다.

## 대안
- Next.js 단일 앱(Route Handlers + ORM): 가장 빠르지만 백엔드 구조를 보여 주지 못하고, 관리자 화면과 공개 폼이 같은 오리진에 묶여 쿠키 격리를 경로 규칙에만 의존하게 된다.
- NestJS 단일 앱 + 서버 렌더링 관리자: 프론트 역량 표현이 약하다.

## 결과
초기 설정 비용(두 앱, Dockerfile 2개, lockfile 공유)이 늘어난다. 이를 docker compose 한 파일과 워크스페이스 스크립트로 흡수한다. 버전은 공고의 NestJS 8/TypeORM 0.2 대신 현행 안정 버전(NestJS 11/TypeORM 0.3)을 쓴다. 신규 프로젝트에서 EOL 버전을 고를 이유가 없고, API 표면은 대부분 호환된다.
