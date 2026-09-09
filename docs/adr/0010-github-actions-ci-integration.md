# ADR 0010. GitHub Actions CI로 프론트엔드·백엔드 통합 검증

- 상태: 채택 (2026-09-09)

## 맥락
ADR 0008은 로컬 docker compose에서 단위·e2e 테스트를 돌리는 방법만 정했다. 평가자는 저장소를 열어 본 뒤 직접 실행할 수도 있지만, 저장소만 보고도 "이 코드가 실제로 돌아가고 테스트가 통과한다"는 근거가 있어야 한다. 또한 백엔드 e2e(supertest)는 API 프로세스 안에서 도는 검증이라 웹 컨테이너 → API 컨테이너 연결(rewrite 프록시, 컨테이너 네트워크, 환경 변수 주입)은 아무 테스트도 확인하지 않는다.

## 결정
`.github/workflows/ci.yml` 하나에 병렬 잡 3개를 둔다. 트리거는 `main` push와 pull request, 같은 브랜치의 이전 실행은 취소하며 잡마다 20분 제한을 둔다.

| 잡 | 환경 | 내용 |
|---|---|---|
| `api` | pnpm + Node 22, `postgres:16-alpine` 서비스 컨테이너 | `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api openapi:export` 후 `docs/openapi.json` 아티팩트 업로드 |
| `web` | pnpm + Node 22 | `pnpm --filter web test`, `pnpm --filter web build` |
| `integration` | 러너의 Docker | ① `docker compose up --build -d --wait`(db, api, web) ② `docker compose --profile test run --rm api-test` ③ `pnpm bruno:run` ④ `scripts/ci-smoke.sh` ⑤ 항상 `docker compose logs` 아티팩트 업로드와 `down -v` |

- `--wait`가 동작하도록 compose의 `api`는 `GET /health`, `web`은 `GET /login`을 healthcheck로 갖는다.
- Bruno 컬렉션이 통합 잡의 API 계약 검증을 담당한다. 로그인 → 템플릿 업로드 → 캠페인 → 폼 → 링크 → 공개 페이지 → 제출 → 통계 순서로 실행되며, 공개 페이지 응답의 `sandbox` 속성과 CSP 헤더도 단언한다.
- `scripts/ci-smoke.sh`는 웹 오리진만 curl로 확인한다. `http://localhost:3000/login`이 200이고 관리자 화면 마크업을 포함하는지, `http://localhost:3000/api/admin/auth/me`가 401을 돌려주는지(웹 → API rewrite 프록시가 살아 있다는 증거). 브라우저는 쓰지 않는다.
- 도커 레이어 캐시 액션은 쓰지 않는다. 통합 잡이 5분 안팎 걸리는 것을 감수하고 설정을 단순하게 유지한다.
- Seed는 수정하지 않는다. CI는 제품 기능이 아니라 검증 인프라이며 Seed 수용 기준 "테스트 실행 가능"의 실행 경로를 하나 더 두는 것이다.

## 근거
- 백엔드 e2e만으로는 컨테이너 간 연결을 검증할 수 없다. 실제 이미지를 빌드해 `compose up`으로 띄우는 것이 "README대로 하면 돌아간다"를 가장 값싸게 증명한다.
- `api`·`web` 잡을 통합 잡과 분리한 이유는 피드백 속도다. 도커 빌드 없이 1~2분 안에 단위·e2e 결과가 나오고, 실패 원인이 잡 이름만으로 구분된다.
- 통합 잡에서 `api-test` 프로파일을 한 번 더 돌리는 것은 README에 적힌 테스트 명령이 그대로 통과함을 보이기 위해서다. 로컬 개발자 경로와 CI 경로가 같은 명령을 쓴다.
- Bruno를 재사용하면 API 문서(ADR 0009)와 통합 테스트가 같은 파일을 공유한다. 문서가 실행되므로 문서가 낡을 수 없다.

## 대안
- Playwright 시나리오 1개 추가: 공고 스택과 맞고 브라우저 렌더링까지 검증하지만, ADR 0008에서 3일 범위 밖으로 둔 결정을 뒤집어야 하고 반나절이 더 든다. 다음 단계 첫 후보로 유지한다.
- 문서화된 명령만 실행(`api-test` + `web test`): 설정이 가장 작지만 웹 → API 연결을 전혀 확인하지 못한다.
- self-hosted 러너 또는 별도 CI 서비스: 과제 범위에 불필요하다.

## 결과
- 계획서 Track A에 Task A5(워크플로, compose healthcheck, smoke 스크립트)가 추가된다. 워크플로 파일은 Track A에서 만들지만 녹색 여부는 코드가 모이는 Track E에서 원격에 push한 뒤 처음 확인한다.
- README 테스트 절에 CI 한 줄을 추가한다(실행·테스트 안내 범위 안).
- 원격 저장소는 Track E에서 만든다. 어느 GitHub 계정으로 올릴지는 그때 사용자가 정한다.
