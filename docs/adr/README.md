# ADR 목록

| 번호 | 제목 |
|---|---|
| [0001](0001-stack-nestjs-nextjs-monorepo.md) | NestJS + Next.js pnpm 모노레포 채택 |
| [0002](0002-html-form-submission-contract.md) | 서버 주입 스크립트로 폼 제출을 가로채는 최소 계약 |
| [0003](0003-html-isolation-sandbox-csp.md) | sandbox iframe + CSP + 쿠키 경로 한정으로 등록 HTML 격리 |
| [0004](0004-auth-seeded-operator-session-cookie.md) | 시드 운영자 계정 + 서버 세션 쿠키 인증 |
| [0005](0005-visitor-visit-definition.md) | 방문·방문자 정의와 채널 귀속 |
| [0006](0006-conversion-rate-and-analytics-queries.md) | 전환율 = 신청 수 / 방문자 수, 집계는 SQL GROUP BY |
| [0007](0007-data-model.md) | 데이터 모델 |
| [0008](0008-testing-and-docker-environments.md) | 테스트 범위와 실행/테스트 환경 분리 |
| [0009](0009-api-documentation-tooling.md) | API 문서: OpenAPI 생성 + Scalar UI + Bruno |
| [0010](0010-github-actions-ci-integration.md) | GitHub Actions CI로 프론트엔드·백엔드 통합 검증 |
| [0011](0011-tdd-and-coverage-gate.md) | TDD 규율과 테스트 커버리지 90% 게이트 |
| [0012](0012-ai-generation-boundary.md) | AI 생성은 시스템 경계 밖, 입력 계약과 샘플로 증명 |
| [0013](0013-implementation-rulings.md) | 구현 중 확정한 세부 규칙(uuid 400/404, 헬스 경로, Bruno 구조 등) |
| [0014](0014-template-lifecycle.md) | 템플릿 생애주기: 불변, 확인 후 소프트 삭제, 미리보기·코드 보기, 붙여넣기 등록 |
| [0015](0015-postgresql-over-mysql.md) | PostgreSQL을 MySQL 대신 선택한 근거 |
| [0016](0016-dashboard-auto-refresh.md) | 대시보드 주기 갱신과 마지막 갱신 시각 표시 |
| [0017](0017-transactions-and-n-plus-one.md) | 트랜잭션 경계와 N+1 방지 규칙 |
| [0018](0018-isolation-verification-and-no-sanitizing.md) | 등록 HTML은 살균하지 않고 격리한다 — 공격 시나리오 테스트로 검증 |
| [0019](0019-campaign-lifecycle.md) | 캠페인 생애주기: 종료(보관) 시 폼 자동 비활성 |
| [0020](0020-operator-roles-and-superuser.md) | 운영자 역할: 구조만 포함(역할·활성 컬럼, 가드), 계정 관리는 다음 단계 |

다이어그램(ER·흐름·격리·집계·파이프라인, Mermaid): [../diagrams.md](../diagrams.md)
