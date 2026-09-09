# ADR 0008. 테스트 범위와 실행/테스트 환경 분리

- 상태: 채택 (2026-09-09)

## 맥락
"핵심 성공 흐름과 실패 흐름을 자동화 테스트로 검증"해야 하고, 실행은 docker로 단순해야 한다. 테스트가 실행 DB를 오염시키면 안 된다.

## 결정
- 단위: Jest. 전환율 계산, HTML 검증 규칙, slug/코드 생성, 스크립트 주입.
- 통합/e2e: supertest + 실제 PostgreSQL 테스트 DB. 인증, 템플릿, 캠페인·폼, 링크, 공개 방문·제출, 격리, 집계의 성공·실패 흐름.
- API 문서: ADR 0009 참조(OpenAPI 생성 + Scalar UI + Bruno).
- Playwright는 채택하지 않는다. → 개정(ADR 0018): 격리 공격 시나리오 1건에 한해 채택한다.
- CI(GitHub Actions)에서의 통합 검증은 ADR 0010 참조. TDD 규율과 커버리지 임계값은 ADR 0011 참조.
- `docker-compose.yaml` 하나에 실행 서비스(db, api, web)와 `test` 프로파일(db-test tmpfs, api-test 러너)을 둔다. `docker compose up`은 실행, `docker compose --profile test run --rm --build api-test`는 테스트.

## 근거
- 과제의 핵심은 API 흐름이며, supertest로 브라우저 없이 성공/실패를 정확히 고정할 수 있다.
- 실제 DB로 e2e를 돌려야 마이그레이션·제약(UNIQUE, FK)·JSONB가 검증된다.
- 프로파일 분리로 파일 하나를 유지하면서 실행 DB와 테스트 DB가 섞이지 않는다.

## 대안
- SQLite 인메모리 e2e: 빠르지만 PostgreSQL 전용 기능(JSONB, ENUM)이 달라 의미가 약하다.
- Playwright 추가: 공고 스택과 맞지만 3일 범위에서 비용 대비 검증 가치가 낮다. 추후 로그인→제출→대시보드 1개 시나리오를 추가할 첫 후보.

## 결과
- 커밋은 `test:`(실패 테스트) → `feat:`(구현) 순으로 분리한다.
- e2e는 파일마다 테이블을 TRUNCATE해 순서 독립성을 유지한다.
- 그래서 **같은 테스트 DB에 e2e를 동시에 두 개 이상 돌리면 안 된다**(TRUNCATE 경쟁으로 간헐 실패). 워크트리를 병렬로 쓸 때는 워크트리마다 다른 DB 이름(`TEST_DATABASE_URL`)을 쓰거나 순차 실행한다. 2026-09-10 간헐 실패의 원인이 이것이었다.
