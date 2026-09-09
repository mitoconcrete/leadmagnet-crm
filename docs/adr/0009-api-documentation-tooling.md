# ADR 0009. API 문서: @nestjs/swagger로 OpenAPI 생성, Scalar UI로 렌더링, Bruno로 실행 가능한 문서

- 상태: 채택 (2026-09-09)

## 맥락
"인증, 폼 관리, 공개 폼 제출, 배포 링크, 성과 조회 API를 문서화"해야 한다. 손으로 쓴 문서는 코드와 어긋나기 쉬우므로 코드에서 자동 생성되는 도구를 쓴다. NestJS 생태계에서 후보를 비교했다.

## 비교

| 도구 | 역할 | 장점 | 단점 |
|---|---|---|---|
| `@nestjs/swagger` | 데코레이터·DTO에서 OpenAPI 3 생성 | NestJS 공식, class-validator DTO와 결합, CLI 플러그인으로 타입 자동 반영, 생태계 표준 | 기본 Swagger UI 외형이 낡음 |
| Swagger UI (`swagger-ui-express`) | OpenAPI 렌더링 | 오프라인 번들, 검증된 도구 | UI가 무겁고 가독성 낮음 |
| Scalar (`@scalar/nestjs-api-reference`) | OpenAPI 렌더링 | 현대적 UI, 다국어 코드 스니펫, .NET 9·Hono 등이 기본 채택, 한 줄 연결 | UI 자산을 CDN에서 로드(오프라인 시 빈 화면) |
| Redoc | OpenAPI 렌더링 | 읽기 전용 문서로 깔끔 | "Try it" 없음 |
| nestia | TS 타입에서 OpenAPI·SDK 생성 | 데코레이터 없이 정확한 타입 반영, 성능 | ttypescript 변환 설정 필요, 학습 비용, 3일 과제에 과함 |
| Compodoc | 코드 구조 문서 | 모듈 그래프 | API 계약 문서가 아님 |
| Bruno | 요청 컬렉션 + 어설션 실행 | 파일 기반(git 친화), `bru run`으로 CLI 테스트, 대상 조직이 사용 | OpenAPI 생성 도구는 아님 |

## 결정
- **생성**: `@nestjs/swagger` + CLI 플러그인(`nest-cli.json`의 `plugins: ["@nestjs/swagger"]`)으로 DTO 속성을 자동 반영하고, 컨트롤러에 `@ApiTags`·`@ApiCookieAuth`·`@ApiResponse`를 붙인다.
- **렌더링**: `/api/docs`는 Scalar API Reference, `/api/docs-json`은 원본 OpenAPI JSON. Scalar CDN을 못 받는 환경을 위해 JSON 경로를 README에 함께 적는다.
- **내보내기**: `pnpm --filter api openapi:export`가 앱을 부트스트랩 없이(DB 연결 없이) 문서 객체를 만들어 `docs/openapi.json`에 쓴다. 저장소에 커밋해 서버 없이도 읽을 수 있게 한다.
- **실행 가능한 문서**: `bruno/leadmagnet-crm/` 컬렉션에 5개 영역(auth, templates, campaigns-forms, links, public, analytics) 요청과 어설션을 두고 `bru run --env local`로 실행한다.

## 근거
- OpenAPI 생성은 공식 패키지가 DTO·검증 데코레이터와 가장 잘 맞물린다. 문서와 검증 규칙의 단일 출처가 된다.
- 렌더러는 교체 가능한 층이다. Scalar는 같은 OpenAPI를 더 읽기 쉽게 보여 주고 연결 비용이 한 줄이다.
- Bruno는 대상 조직이 쓰는 도구이며, 문서를 "읽는 것"에서 "실행하는 것"으로 바꿔 준다.

## 결과
- 의존성: `@nestjs/swagger`, `@scalar/nestjs-api-reference`, dev `@usebruno/cli`.
- Swagger UI는 넣지 않는다. 필요하면 `SwaggerModule.setup` 한 줄로 추가 가능하다.
