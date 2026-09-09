# ADR 0006. 전환율 = 신청 수 / 방문자 수, 집계는 SQL GROUP BY

- 상태: 채택 (2026-09-09)

## 맥락
전환율의 분모를 방문으로 할지 방문자로 할지에 따라 숫자가 달라진다. 집계는 관리자 대시보드 진입마다 실행된다.

## 결정
- `conversionRate = visitors == 0 ? 0 : submissions / visitors`, 소수 4자리 반올림.
- 캠페인 stats와 채널 breakdown은 `visits`·`submissions`를 `forms.campaign_id`로 조인해 `COUNT`, `COUNT(DISTINCT visitor_id)`, `GROUP BY channel`로 계산한다. 별도 집계 테이블이나 캐시는 두지 않는다.
- 채널 breakdown은 `direct, instagram, x, youtube, threads` 5행을 항상 반환한다(없으면 0).

## 근거
- 리드 캠페인에서 관심 있는 값은 "사람 중 몇 명이 신청했나"다. 방문 기준은 새로고침에 왜곡된다.
- 과제 규모에서 실시간 SQL 집계면 충분하고, 인덱스(`visits.form_id`, `submissions.form_id`)로 N+1 없이 쿼리 2~3개로 끝난다.
- 고정 5행은 프론트가 빈 채널을 따로 처리하지 않게 한다.

## 대안
- 방문 기준 전환율: 단순하지만 의미가 약하다.
- 집계 테이블/materialized view: 규모가 커지면 필요하지만 지금은 YAGNI.

## 결과
- 단위 테스트로 0 나눗셈과 반올림을 고정한다.
- 트래픽이 커지면 일별 집계 테이블로 옮기는 경로를 열어 둔다.
