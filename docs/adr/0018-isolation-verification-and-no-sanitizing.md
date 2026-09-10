# ADR 0018. 등록 HTML은 살균하지 않고 격리한다 — 공격 시나리오 테스트로 검증

- 상태: 채택 (2026-09-10)

## 맥락
과제 조건: "등록한 HTML이 관리자 인증 정보나 관리자 API에 접근하지 못하게 해야 합니다." ADR 0003은 격리 3겹(오리진 분리, 쿠키 Path, sandbox+CSP)으로 답했고 e2e는 헤더·속성 문자열을 단언한다. 그러나 (1) 실제 브라우저에서 공격이 막히는지는 검증하지 않았고, (2) "살균(sanitizing)하지 않는다"는 결정이 명시돼 있지 않아 "XSS는 어떻게 막나"에 답이 없다.

## 결정

### 살균하지 않는다
- 등록 HTML을 고치거나 태그를 제거하지 않는다. AI가 만든 HTML은 `<script>`·인라인 이벤트·`<style>`을 자유롭게 쓰며, 살균하면 폼이 깨지고 운영자가 이유를 알 수 없다.
- 대신 등록 HTML을 **신뢰하지 않는 코드**로 다룬다. 어떤 스크립트가 들어 있어도 닿을 수 있는 것이 없도록 만든다. 관리자 화면은 등록 HTML을 절대 렌더하지 않고(코드 보기는 텍스트), 렌더는 공개 페이지와 미리보기의 sandbox iframe 안에서만 일어난다.
- 검증(`<form` 필수, 512KB, `.html`)은 동작 요건이지 보안 필터가 아니다.
- **차단 규칙(2026-09-10 추가)**: 고신뢰 패턴은 등록 자체를 거부한다(400, 이유 목록 `message: string[]`) — 관리자 API 참조(`/api/admin`), 쿠키 접근(`document.cookie`), 부모·최상위 창 접근(`parent.`, `top.`, `window.parent`, `window.top`), 저장소 접근(`localStorage`, `sessionStorage`), `<meta http-equiv="refresh">`, `target="_top"|"_parent"`, `<iframe>`·`<object>`·`<embed>`. 목적은 **실수를 등록 단계에서 되돌려 주는 것**이지 보안 경계가 아니다. 문자열 조립·인코딩으로 우회되며, 우회한 코드도 격리에 막힌다(샘플 `samples/isolation-check.html`이 그 증명, `samples/isolation-check-blocked.html`은 차단 예시). 살균(내용 수정)은 여전히 하지 않는다.
- **점검은 안내, 격리는 방어.** 등록 시 프롬프트 템플릿 규칙을 벗어난 요소를 찾아 차단하지 않는 경고 목록(`warnings`)으로 돌려준다: `name` 없는 입력, 외부 `<script src>`(CSP로 차단됨), `action`/`method`/`onsubmit`(무시됨), 제출 버튼 없음, `<meta http-equiv=refresh>`·`target="_top"`(sandbox로 차단됨). 등록은 그대로 성공하고 화면이 경고를 보여 준다. 운영자가 "왜 동작하지 않는지"를 알게 하는 층이며, 보안은 여전히 격리가 담당한다.

### 격리가 실제로 성립함을 두 층에서 검증한다
1. **서버 e2e (구조 불변식)**: 공격 픽스처 `apps/api/test/fixtures/attack-*.html` — 쿠키 읽기, `fetch('/api/admin/...')`, `top.location`/`window.parent` 접근, `<form action=https://evil>`, `<meta http-equiv=refresh>`, srcdoc 탈출 시도(`</script>`, `"`, `&`), `<a target=_top>`. 각 픽스처를 등록·미리보기·공개 페이지로 렌더한 응답에 대해 sandbox 속성, `allow-same-origin` 부재, CSP 지시어, srcdoc 이스케이프(원문의 `"`가 `&quot;`로만 나타남), 관리자 API에 `Origin: null`/무쿠키 요청 401, `sid`가 `/p`로 전송되지 않음을 단언한다.
2. **브라우저 (동작)**: Playwright 1개 스펙 `e2e/isolation.spec.ts`가 실제 compose 스택에서 (a) 관리자로 로그인해 `sid` 쿠키를 가진 브라우저 컨텍스트로 공격 템플릿의 공개 페이지를 연다, (b) iframe 안 스크립트가 `document.cookie`를 읽으면 `SecurityError`(Chromium은 `allow-same-origin` 없는 sandbox에서 getter 자체를 막는다. 빈 문자열이 아니라 예외다), 관리자 API 호출은 **네트워크 관찰**로 판정한다: 요청이 아예 나가지 않거나(CSP), 나가면 요청 헤더에 `sid`가 없고 응답이 401이며, 공격 스크립트가 시도한 캠페인 생성(`POST /api/admin/campaigns`)이 서버에 남기지 않음(전후 개수 불변). 응답을 읽지 못했다는 사실(TypeError)만으로는 CORS 실패와 구분되지 않으므로 증거로 쓰지 않는다, `parent.location` 접근은 SecurityError, 네이티브 폼 전송은 CSP `form-action 'none'`으로 차단, `top` 내비게이션 시도 후 관리자 페이지가 그대로임을 단언한다. 결과는 iframe이 `postMessage`로 래퍼에 보고하고 테스트가 수집한다.
- Playwright는 브라우저로만 검증되는 것에만 쓴다: 이 격리 시나리오와 데스크톱 레이아웃 실측(ADR 0021). CI `integration` 잡이 compose 스택 위에서 실행한다.

## 근거
- 살균은 "무엇이 위험한지 다 안다"는 가정이 필요하고, 그 목록은 항상 불완전하다. 격리는 "아무것도 믿지 않는다"는 구조라 목록이 필요 없다.
- 헤더 문자열 단언은 설정이 바뀌면 잡지만, 브라우저가 실제로 막는지는 브라우저만 안다. 조건이 과제의 핵심 비기능 요구이므로 브라우저 검증 1건의 비용은 정당하다.

## 대안
- DOMPurify 같은 살균기 추가: 인라인 스크립트가 필요한 AI HTML과 충돌하고, 격리가 이미 있으므로 이중 방어치고 비용이 크다. 다음 단계에서 "운영자가 선택하는 엄격 모드"로 고려.
- 브라우저 검증 없이 e2e만: 과제 조건의 증명이 약하다.

## 결과
- ADR 0008의 "Playwright 미채택"은 "격리 시나리오 1건에 한해 채택"으로 개정한다.
- 알려진 잔여 위험(ADR 0003): 등록 HTML은 방문자 입력을 외부 이미지 비콘으로 보낼 수 있다. 운영자는 신뢰 주체.
- 수동 확인용 자가 진단 템플릿 `samples/isolation-check.html`(차단 규칙을 실행 시점 문자열 조립로 통과하는 버전): 등록 후 미리보기나 배포 링크로 열면 쿠키 읽기·관리자 API GET/POST(3개 오리진)·부모 창·localStorage·최상위 이동·네이티브 전송·이미지 비콘을 스스로 시도해 결과 표를 보여 준다. 마지막 행(비콘)만 "허용됨(잔여 위험)"이 정상.
