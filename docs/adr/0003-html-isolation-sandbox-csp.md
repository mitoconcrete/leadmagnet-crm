# ADR 0003. sandbox iframe + CSP + 쿠키 경로 한정으로 등록 HTML 격리

- 상태: 채택 (2026-09-09)

## 맥락
비기능 요구: 등록한 HTML이 관리자 인증 정보나 관리자 API에 접근하지 못해야 한다. 등록 HTML은 신뢰할 수 없는 코드이며 스크립트를 포함할 수 있다. sanitize로 스크립트를 제거하면 AI가 만든 폼의 동작(유효성 검사, 단계 전환)이 깨진다.

## 결정
세 겹으로 격리한다.
1. **오리진 분리**: 관리자 화면은 3000, 공개 폼과 API는 3001. 관리자 API는 CORS 헤더를 내지 않는다.
2. **쿠키 경로 한정**: 관리자 세션 쿠키 `sid`는 `Path=/api/admin; HttpOnly; SameSite=Lax`. 공개 경로(`/p/*`, `/api/public/*`) 요청에는 브라우저가 쿠키를 붙이지 않는다.
3. **sandbox + CSP**: 등록 HTML은 `<iframe sandbox="allow-scripts allow-forms" srcdoc>`로만 렌더링한다. `allow-same-origin`을 주지 않아 문서 오리진이 opaque가 되고 `document.cookie`, `localStorage`, `parent` DOM 접근이 막힌다. 래퍼 응답에 `Content-Security-Policy`를 걸어 `connect-src`를 `${PUBLIC_BASE_URL}/api/public/`로만 허용한다. srcdoc 문서는 부모 CSP를 상속한다.

## 근거
- sandbox는 브라우저 표준 격리이며 스크립트를 살려 둔 채로 신원(origin)을 제거한다.
- 쿠키 Path 한정은 서버 쪽 보완책이다. 설령 iframe 격리가 뚫려도 3001의 `/p`에서 `/api/admin`으로 가는 요청에 세션이 실리지 않는다.
- CSP `connect-src`는 데이터 유출 경로를 공개 제출 API 하나로 좁힌다.

## 대안
- HTML sanitize(DOMPurify 등): 스크립트 제거로 폼 동작이 깨지고, 우회 사례가 계속 나온다.
- 별도 도메인(`forms.example.com`) 호스팅: 가장 강하지만 로컬 docker compose 환경에서 도메인 분리를 재현하기 어렵다. 프로덕션 확장 시 첫 후보다.

## 결과
- 공개 제출 API는 `Access-Control-Allow-Origin: *`를 낸다. opaque 오리진(`null`)에서 오는 fetch를 받으려면 필요하며, 이 API는 쿠키를 쓰지 않으므로 안전하다.
- e2e `isolation` 스펙이 sandbox 속성, CSP 헤더, 쿠키 Path, `/api/public`에 sid를 실어 보내도 관리자 API 401을 검증한다.
- 외부 이미지/폰트(`img-src *`, `font-src *`)는 허용해 AI 생성 HTML의 외형을 유지한다.
