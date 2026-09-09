# ADR 0017. 트랜잭션 경계와 N+1 방지 규칙

- 상태: 채택 (2026-09-10)

## 맥락
서비스 계층에 트랜잭션이 없었다. 방문 기록(visitor upsert + visit insert)과 제출(중복 확인 + insert)이 두 단계로 나뉘어, 중간 실패 시 고아 행이 남거나 경쟁 조건에서 중복이 생길 수 있다. N+1은 감사 결과 현재 발생 지점이 없지만, 막는 규칙과 회귀를 잡는 테스트가 없었다.

## 결정

### 트랜잭션 경계
쓰기가 두 단계 이상이거나 "확인 후 쓰기" 패턴이면 `DataSource.transaction(manager => …)` 안에서 같은 `manager`의 리포지토리로 수행한다.

| 유스케이스 | 원자적으로 묶는 단계 | 격리·무결성 보강 |
|---|---|---|
| 방문 기록 `recordVisit` | visitor 생성/`last_seen_at` 갱신 + visit insert | visit이 실패하면 visitor 변경도 롤백 |
| 제출 `submit` | visit 검증 + 중복 확인 + submission insert | `UNIQUE(visit_id)`가 최후 방어. 위반 시 409 |
| 템플릿 강제 삭제 | `deleted_at` 설정 + 참조 폼 `is_active=false` 일괄 | 부분 적용 방지 |
| 캠페인 종료 | `status=archived` + 소속 폼 `is_active=false` 일괄 | 부분 적용 방지 |
| 운영자 비활성화 | `is_active=false` + 세션 전부 삭제 | 비활성화 즉시 로그아웃 |

- 격리 수준은 PostgreSQL 기본(READ COMMITTED). 유일성은 코드의 선조회가 아니라 DB 제약(UNIQUE)이 보장하며, 코드의 선조회는 친절한 오류 메시지용이다.
- 단일 insert/update(캠페인 생성, 링크 생성 등)는 트랜잭션을 두지 않는다. 문장 하나가 이미 원자적이다.

### N+1 방지 규칙
- 목록 응답은 **쿼리 1~2개**로 만든다. 연관 데이터는 `relations`/`leftJoinAndSelect` 또는 `In(ids)` 일괄 조회로 가져오고, 행마다 반복 조회하지 않는다.
- 집계는 SQL `GROUP BY`로 DB에서 끝낸다(ADR 0006).
- 회귀 방지: e2e 유틸 `countQueries(fn)`이 TypeORM 로거로 실행된 SQL 수를 세고, 대표 목록 엔드포인트(캠페인 목록·폼 목록·명단·캠페인 성과)가 데이터 N개에 대해 상한(≤ 3) 안에 있음을 단언한다. 데이터가 5개일 때와 1개일 때 쿼리 수가 같아야 한다.

## 근거
- ACID 중 원자성과 일관성은 트랜잭션 경계로, 지속성은 PostgreSQL이, 고립성은 READ COMMITTED + UNIQUE 제약으로 확보한다. 직렬화 수준을 올릴 만큼 경합이 크지 않다.
- N+1은 코드 리뷰만으로는 재발한다. 쿼리 수를 세는 테스트가 있어야 리팩터링 뒤에도 유지된다.

## 대안
- 모든 서비스 메서드에 트랜잭션: 읽기 전용 경로까지 감싸면 커넥션 점유만 늘어난다.
- SERIALIZABLE: 재시도 로직이 필요해지고 이득이 없다.

## 결과
- 감사(2026-09-10) 시점 N+1 발생 지점 없음. 위 규칙과 테스트를 추가해 유지한다.
