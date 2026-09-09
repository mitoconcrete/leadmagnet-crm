# ADR 0011. TDD 규율과 테스트 커버리지 90% 게이트

- 상태: 채택 (2026-09-09)

## 맥락
ADR 0008은 테스트 범위(단위 + supertest e2e)와 실행 환경을 정했지만, "얼마나" 검증해야 하는지의 기준이 없었다. 구현이 병렬 트랙(백엔드·프론트·테스트)으로 진행되므로 트랙마다 다른 기준으로 테스트를 쓰면 통합 시점에 검증 공백이 생긴다. 사용자는 TDD 기반 구현과 90% 이상 커버리지를 요구했다.

## 결정
- 모든 제품 코드는 실패하는 테스트를 먼저 쓴 뒤 작성한다(superpowers `test-driven-development` 스킬의 규율: RED → GREEN → REFACTOR). 커밋 히스토리에 `test:` 커밋이 `feat:` 커밋보다 앞선다.
- 커버리지 게이트는 코드 단위로 둔다. 미달이면 명령이 실패한다.

| 대상 | 명령 | 측정 범위 | 임계값 |
|---|---|---|---|
| API | `pnpm --filter api test:cov` (`apps/api/jest.cov.config.ts`) | 단위 `*.spec.ts` + e2e `*.e2e-spec.ts` 합산, `src/**` (제외: `main.ts`, `openapi-export.ts`, `migrations/**`) | lines·statements·functions 90%, branches 80% |
| 관리자 화면 | `pnpm --filter web test:cov` (vitest + `@vitest/coverage-v8`) | `app/**`, `components/**`, `lib/**` (제외: `components/ui/**` shadcn 생성물, `app/layout.tsx`) | 동일 |

- 게이트는 세 곳에서 같은 명령으로 실행된다: 로컬(`pnpm --filter … test:cov`), compose `api-test` 러너, GitHub Actions `api`·`web` 잡.
- 브랜치 임계값을 80%로 둔 이유: 방어적 분기(예: 예외 경로의 else)까지 90%를 강제하면 테스트가 구현 세부에 결합된다. lines/functions 90%가 실질 기준이다.

## 근거
- e2e를 커버리지 합산에 포함해야 컨트롤러·가드·필터가 "실제 HTTP 경로"로 측정된다. 단위 테스트만으로 90%를 맞추려면 컨트롤러를 모킹으로 덮게 되어 의미가 약하다.
- 부트스트랩 파일과 raw SQL 마이그레이션은 테스트가 아니라 실행(compose up, e2e의 `runMigrations`)이 검증한다. 생성된 UI 프리미티브는 이 저장소의 코드가 아니다. 이 세 가지 외에는 제외하지 않는다.
- 게이트를 명령에 내장하면 CI 설정이 단순해지고, 로컬에서 같은 결과를 본다.

## 대안
- 커버리지 수치 없이 TDD만 요구: 규율은 남지만 검증 가능한 기준이 없다.
- 100% 강제: 부트스트랩·타입 선언까지 억지 테스트가 생긴다.
- 단위 테스트만 측정: 위 근거대로 컨트롤러 계층이 빈다.

## 결과
- 계획서 Track B/C에 커버리지 설정 태스크가 추가되고, Track D의 e2e는 실패 경로(400/401/404 변형, 만료 세션, 프리플라이트)를 넓힌다.
- compose `api-test`와 CI가 `test:cov`를 실행한다. README 테스트 절에 반영.
- 커버리지가 미달인 채로 통합을 끝내지 않는다. 미달이면 테스트를 추가하는 것이지 임계값을 낮추지 않는다.
