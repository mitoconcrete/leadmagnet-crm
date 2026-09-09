# ADR 0015. PostgreSQL을 MySQL 대신 선택한 근거

- 상태: 채택 (2026-09-10)

## 맥락
공고와 과제는 PostgreSQL/MySQL 중 하나를 허용한다. ADR 0001은 PostgreSQL 16을 골랐지만 "왜 MySQL이 아닌가"를 적지 않았다. 이 시스템의 데이터 특성에서 근거를 세운다.

## 결정
PostgreSQL 16을 쓴다. 결정적 요인은 신청 payload의 저장 방식이다.

| 요구 | PostgreSQL | MySQL 8 | 영향 |
|---|---|---|---|
| AI가 만든 폼마다 다른 필드를 원본 그대로 저장 | `JSONB`: 바이너리 저장, 키 검색·GIN 인덱스, `->>` 연산자로 집계 가능 | `JSON`: 텍스트 파싱 기반, 인덱스는 생성 컬럼 우회 필요 | 명단 검색·필드별 집계로 확장할 때 스키마 변경 없이 가능 |
| 채널·상태 enum | 네이티브 `ENUM` 타입(테이블 간 공유, `ALTER TYPE ... ADD VALUE`) | 컬럼별 ENUM, 변경 시 테이블 재작성 | 채널 추가가 마이그레이션 한 줄 |
| uuid PK | `gen_random_uuid()` 내장, `uuid` 네이티브 타입(16바이트) | `UUID()`는 v1, 저장은 CHAR(36) 또는 BINARY(16) 변환 필요 | 인덱스 크기·조인 비용, 코드 단순성 |
| 마이그레이션 안전성 | DDL이 트랜잭션 안에서 롤백 가능 | DDL은 암묵적 커밋 | 초기 마이그레이션이 중간에 실패해도 반쪽 스키마가 남지 않는다 |
| 집계 | `COUNT(DISTINCT)`·윈도우 함수·`FILTER` 절 성숙, 부분 인덱스 | 가능하나 부분 인덱스 없음 | 채널별 5행 집계 쿼리와 향후 일별 집계 |
| 시간 | `timestamptz`가 UTC 저장·세션 TZ 변환 | `TIMESTAMP`는 2038 한계, `DATETIME`은 TZ 없음 | KST 표시와 서버 UTC의 분리 |
| 제약 | `UNIQUE (form_id, channel)`, `UNIQUE (visit_id)` 등 표준 동일 | 동일 | 차이 없음 |

## 근거
- 이 시스템의 핵심 데이터는 "스키마를 미리 알 수 없는 폼 제출"이다. 이를 1급으로 다루는 JSONB가 있는 쪽이 자연스럽다. 정규화하지 않기로 한 결정(ADR 0002/0007)과 맞물린다.
- 운영 관점의 안전장치(트랜잭션 DDL, 네이티브 uuid, 부분 인덱스)가 모두 PostgreSQL 쪽에 있다.
- TypeORM 지원 수준은 같다. 그러나 이 저장소의 마이그레이션은 raw SQL(JSONB, ENUM, `gen_random_uuid`)이라 MySQL로 옮기려면 마이그레이션과 집계 쿼리를 다시 써야 한다. 그 비용을 알고 선택했다.

## 대안
- MySQL 8: 팀 친숙도나 기존 인프라가 MySQL이면 타당하다. 그 경우 payload는 `JSON` + 생성 컬럼 인덱스, uuid는 `BINARY(16)`, enum은 컬럼 ENUM으로 대체한다.
- SQLite: 테스트는 빠르지만 JSONB·ENUM·동시성이 달라 e2e의 의미가 약해진다(ADR 0008).

## 결과
- 면접에서 "MySQL이면 안 되나"에 대한 답: 된다. 다만 JSONB·트랜잭션 DDL·네이티브 uuid 때문에 이 과제의 데이터에는 PostgreSQL이 더 맞고, 전환 비용은 마이그레이션·집계 SQL 재작성이다.
