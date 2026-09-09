# ADR 0020. 운영자 역할: 슈퍼유저(admin)가 운영자 계정을 관리한다

- 상태: 부분 채택 (2026-09-10) — 구조(역할·활성 컬럼, 가드, me.role)만 이번 제출에 포함. 운영자 관리 API·화면은 다음 단계

## 맥락
요구는 "인증한 운영자만 관리자 기능과 신청자 데이터를 볼 수 있어야 합니다"이다. 현재는 시드 계정 하나뿐이고(ADR 0004), 계정을 추가·정지할 방법이 없다. 운영자가 늘거나 퇴사하면 비밀번호를 공유하거나 시드 값을 바꿔 재배포해야 한다. 미인증 접근은 401로 이미 막혀 있지만 "인증을 관리하는" 주체가 없다.

## 결정

**이번 제출 범위(구조만)**: `operators.role`(enum `admin|operator`, 기본 operator)과 `operators.is_active`(기본 true) 컬럼, 시드 계정은 admin. `AuthGuard`가 `is_active=false`면 401. `GET /api/admin/auth/me`가 `role`을 포함. `RolesGuard`와 `@Roles('admin')` 데코레이터를 준비하되 아직 적용된 엔드포인트는 없다. 아래 API·화면은 **다음 단계**로 남긴다(과제 요구 "인증한 운영자만"은 현재 401 처리로 충족되며, 계정 관리는 과제 범위를 넘는다고 판단).

**다음 단계 설계(기록만)**:
- 역할 두 가지: **admin**(슈퍼유저)과 **operator**. 시드 계정은 admin이다.
- `operators` 테이블에 `role`(enum, 기본 operator)과 `is_active`(기본 true)를 추가한다.
- admin 전용 API `/api/admin/operators`: `GET`(목록: id, email, role, isActive, createdAt), `POST {email, password, role?}`(생성, role 기본 operator, 중복 이메일 409), `PATCH /:id {isActive}`(정지·복구. 정지 시 그 운영자의 세션 전부 삭제를 한 트랜잭션으로), `PATCH /:id/password {password}`(재설정, 세션 삭제). 자기 자신은 정지할 수 없다(409). admin이 아니면 403.
- `AuthGuard`는 `is_active=false`인 운영자의 세션을 거부(401)한다. 로그인도 401(정지 사유는 노출하지 않음).
- `GET /api/admin/auth/me`는 `role`을 포함한다. 화면은 role이 admin일 때만 상단에 "운영자 관리"를 보여 주고 `/operators` 페이지를 연다. operator가 URL로 직접 접근하면 403 응답을 받아 안내 문구를 보여 준다.
- 그 외 모든 관리자 기능(캠페인·템플릿·폼·링크·명단·성과)은 두 역할 모두 사용한다. 세밀한 권한(읽기 전용 등)은 두지 않는다.

## 근거
- 최소 역할 모델. admin은 "계정 관리"라는 한 가지 권한만 더 가진다. 권한 매트릭스가 커지면 화면과 테스트가 함께 커진다.
- 정지 시 세션을 즉시 지워야 "정지"가 의미를 갖는다. 세션 TTL 7일을 기다릴 수 없다.
- 비밀번호는 계속 bcrypt(cost 10). 초대 메일·자체 가입은 범위 밖(실제 알림 연동 제외).

## 대안
- 계정 관리 없이 시드 여러 개: 계정 추가마다 재배포. 운영 불가.
- 초대 링크·이메일 인증: 알림 연동이 범위 밖.
- 세밀한 RBAC: 지금 필요 없다. 역할 enum에 값을 추가하는 것으로 확장 가능.

## 결과
- 마이그레이션 1개(role enum, is_active), `RolesGuard`, 운영자 모듈, 화면 `/operators`. e2e: operator가 `/api/admin/operators` 403, admin 생성·정지·정지된 계정 로그인 401·정지 즉시 세션 무효, 자기 정지 409.
- ADR 0004의 "운영자 관리 없음"은 이 문서로 대체한다.
