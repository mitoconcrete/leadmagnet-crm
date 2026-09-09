# ADR 0013. 구현 중 확정한 세부 규칙

- 상태: 채택 (2026-09-09)

## 맥락
백엔드·프론트·테스트를 병렬로 구현하면서 스펙이 명시하지 않았거나 두 해석이 가능했던 지점이 드러났다. 통합 전에 컨트롤러가 룰링으로 정했고, 여기에 모아 근거를 남긴다. 스펙 §4가 계약의 권위이며 이 문서는 그 해석이다.

## 결정

| 지점 | 결정 | 근거 |
|---|---|---|
| 헬스 체크 경로 | `GET /api/health` | 모든 API가 `/api` 접두사를 쓰는 관례와 일치. compose healthcheck·CI가 이 경로를 쓴다 |
| 형식이 잘못된 uuid | 400 (`ParseUUIDPipe`, DTO `@IsUUID`) / 형식은 맞고 없는 값 404 | NestJS 관례. DB에 `invalid input syntax` 500이 새지 않게 경계에서 거른다 |
| 공개 제출 `visitToken` | 형식 오류·미존재·다른 폼 모두 400 | 스펙 §4.7 "잘못된 visitToken 400". 존재 여부를 404로 노출하지 않는다 |
| 명단 조회 `page`/`limit` | 숫자가 아니면 400, 미지정은 기본값 1/20 | 조용히 기본값으로 바꾸면 클라이언트 버그가 숨는다 |
| Multer 크기 초과 | 413 → 400 + `'파일 크기는 512KB 이하여야 합니다'`, 다른 예외는 위장하지 않음 | 스펙 §4.2는 400만 정의. 필터는 `LIMIT_FILE_SIZE`에만 반응 |
| `visitToken` 값 | `visits.id`(uuid). 래퍼 srcdoc은 HTML 이스케이프되어 본문에 `VISIT_TOKEN=&quot;…&quot;` | 별도 토큰 테이블 없이 가장 단순. 테스트·Bruno는 이 형태로 추출 |
| `vid` 쿠키 재발급 | 쿠키의 visitor가 DB에 없으면 새 visitor를 만들고 쿠키를 갱신 | 없는 id를 계속 보내면 방문마다 visitor가 생겨 집계가 부풀 수 있다 |
| 관리자 화면 401 처리 | `/login`에서는 리다이렉트 생략 | 로그인 실패 토스트가 보여야 한다 |
| 신청 payload | 정규화 없이 원본 JSONB | ADR 0002/0007 유지(사용자 결정) |
| Bruno 컬렉션 구조 | 단일 폴더 + `seq` 순서, `pnpm bruno:run` = `cd bruno/leadmagnet-crm && bru run --env local` | CLI가 컬렉션 루트 cwd를 요구하고 폴더 간 순서를 보장하지 않는다 |
| `DOCS_ONLY=1` 문서 내보내기 | 모듈 로드 전에 플래그를 세우고 DB 프로바이더를 더미로 대체 | `NestFactory.create`가 프로바이더를 즉시 만들어 DB 없이 크래시. 정상 런타임 경로에는 도달하지 않는다(ADR 0009 범위 안) |
| `vid` 쿠키 형식 오류 | uuid가 아니면 없는 것으로 보고 새 방문자 발급·쿠키 갱신 | 조작된 쿠키 하나로 공개 폼이 500이 되면 안 된다 |
| 제출 `fields` 값 타입 | `string` 또는 `string[]`만 허용, 그 외 400 | 계약 §4.7 그대로. 정규화가 아니라 거절이므로 ADR 0002/0007과 충돌하지 않는다 |
| 방문당 신청 | `submissions.visit_id` UNIQUE, 재제출 409 | 전환율 범위 0.0~1.0 보장(ADR 0005·0006) |
| slug 형식 | `^[a-z0-9가-힣][a-z0-9가-힣-]{0,78}$` | 자동 생성 규칙과 같은 문자 집합. URL 라우팅과 주입 스크립트 리터럴 안전 |
| 템플릿 미리보기 | `GET /api/admin/templates/:id/preview`: 공개 페이지와 같은 래퍼(sandbox·CSP)로 렌더, 제출 스크립트 미주입·방문 미기록. 화면은 sandbox iframe으로 연다 | 등록 HTML 확인 단계가 없으면 공개 URL을 열어야 해 통계가 오염된다. 격리 3겹은 그대로 |
| 커버리지 측정 제외 | `main.ts`, `openapi-export.ts`, `migrations/**`(API), `components/ui/**`, `app/layout.tsx`(web) | 실행이 검증하는 부트스트랩·raw SQL과 생성물만 제외(ADR 0011) |

## 결과
- e2e(Track D)와 백엔드(Track B)가 이 표를 기준으로 맞춰졌다. 통합 1회차 205개 중 2개 실패(픽스처의 `<form` 문자열, `limit=abc`)가 모두 이 표의 규칙으로 해소됐다.
- 면접에서 "왜 400이 아니라 404인가" 류의 질문은 이 표로 답한다.
