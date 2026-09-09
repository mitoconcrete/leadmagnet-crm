import { lintHtmlTemplate } from './html-lint';

/** 규칙 1~7을 모두 만족하는 최소 클린 폼. 각 규칙의 음성 케이스 기준선으로 쓴다. */
const BASE = `<form>
  <input name="email" type="email">
  <input type="checkbox" name="consent">
  <button type="submit">보내기</button>
</form>`;

const MISSING_NAME_MSG = (n: number) =>
  `name 속성이 없는 입력 요소가 ${n}개 있습니다. 이 값은 신청 데이터에 저장되지 않습니다`;
const EXTERNAL_SCRIPT_MSG = (n: number) => `외부 스크립트 ${n}개는 격리 정책(CSP)으로 실행되지 않습니다`;
const FORM_IGNORED_ATTR_MSG = 'form의 action/method/onsubmit은 무시됩니다. 제출은 시스템이 처리합니다';
const NO_SUBMIT_MSG = '제출 버튼(type="submit")이 없습니다';
const NAVIGATION_ESCAPE_MSG = '페이지 이동 시도(meta refresh, target=_top)는 sandbox로 차단됩니다';
const ADMIN_API_MSG = '관리자 API 호출은 격리 정책으로 차단됩니다';
const NO_CONSENT_MSG = '개인정보 수집 동의 체크박스(name="consent")가 없습니다';

/** samples/free-checklist-signup.html 내용을 그대로 복사한 문자열. */
const CLEAN_SAMPLE = `<!doctype html>
<!--
  생성 도구: Claude (Anthropic)
  프롬프트: docs/ai-generation-guide.md §2 템플릿에 아래 값을 넣어 생성
    [캠페인] 인스타그램 성장 7일 체크리스트 — 팔로워 1천 명까지 매일 할 일
    [제공물] 무료 PDF 체크리스트
    [수집 항목] 이름(name, 필수), 이메일(email, 필수), 관심 분야(interest, select)
  수정 없이 그대로 등록해도 동작한다.
-->
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>인스타그램 성장 7일 체크리스트</title>
<style>
  :root { --bg:#0f172a; --card:#111827; --accent:#f472b6; --text:#e5e7eb; --muted:#9ca3af; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; background:linear-gradient(160deg,#0f172a,#1e1b4b); color:var(--text); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { width:100%; max-width:440px; background:var(--card); border-radius:16px; padding:32px 28px; box-shadow:0 20px 60px rgba(0,0,0,.4); }
  .eyebrow { color:var(--accent); font-size:13px; letter-spacing:.08em; text-transform:uppercase; margin:0 0 8px; }
  h1 { font-size:24px; line-height:1.3; margin:0 0 12px; }
  p.lead { color:var(--muted); font-size:15px; line-height:1.6; margin:0 0 24px; }
  ul.benefits { list-style:none; padding:0; margin:0 0 24px; font-size:14px; color:var(--muted); }
  ul.benefits li { padding-left:22px; position:relative; margin-bottom:8px; }
  ul.benefits li::before { content:"✓"; color:var(--accent); position:absolute; left:0; }
  label { display:block; font-size:13px; margin-bottom:6px; color:var(--muted); }
  input, select { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #374151; background:#0b1220; color:var(--text); font-size:15px; margin-bottom:16px; }
  input:focus, select:focus { outline:2px solid var(--accent); border-color:transparent; }
  .consent { display:flex; gap:10px; align-items:flex-start; font-size:13px; color:var(--muted); margin-bottom:20px; }
  .consent input { width:auto; margin:3px 0 0; }
  button { width:100%; padding:14px; border:0; border-radius:10px; background:var(--accent); color:#111827; font-weight:700; font-size:16px; cursor:pointer; }
  button:disabled { opacity:.6; cursor:wait; }
  [data-lead-success] { background:#052e16; color:#bbf7d0; padding:18px; border-radius:10px; text-align:center; font-weight:600; }
  [data-lead-error] { background:#450a0a; color:#fecaca; padding:12px; border-radius:10px; font-size:14px; margin-bottom:12px; }
  .fine { color:#6b7280; font-size:12px; text-align:center; margin-top:16px; }
</style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">무료 PDF</p>
    <h1>인스타그램 성장 7일 체크리스트</h1>
    <p class="lead">팔로워 1천 명까지, 매일 15분이면 되는 할 일을 하루 단위로 정리했습니다. 이메일로 바로 보내 드립니다.</p>
    <ul class="benefits">
      <li>릴스·피드·스토리 하루 업로드 루틴</li>
      <li>해시태그 30개 선정 워크시트</li>
      <li>프로필 문구 점검표</li>
    </ul>
    <form>
      <label for="name">이름</label>
      <input id="name" name="name" type="text" required placeholder="홍길동">
      <label for="email">이메일</label>
      <input id="email" name="email" type="email" required placeholder="you@example.com">
      <label for="interest">가장 키우고 싶은 채널</label>
      <select id="interest" name="interest">
        <option value="instagram">인스타그램</option>
        <option value="threads">스레드</option>
        <option value="youtube">유튜브</option>
        <option value="x">X</option>
      </select>
      <label class="consent">
        <input name="consent" type="checkbox" value="yes" required>
        <span>체크리스트 발송과 관련 소식 안내를 위해 이름·이메일을 수집하는 데 동의합니다.</span>
      </label>
      <button type="submit">무료로 받기</button>
    </form>
    <p class="fine">스팸 없음 · 언제든 수신 거부 가능</p>
  </main>
</body>
</html>`;

describe('lintHtmlTemplate (ADR 0018 등록 점검 경고)', () => {
  it('규칙을 모두 만족하는 최소 폼(BASE)은 경고가 없다', () => {
    expect(lintHtmlTemplate(BASE)).toEqual([]);
  });

  it('samples/free-checklist-signup.html 내용은 경고가 없다', () => {
    expect(lintHtmlTemplate(CLEAN_SAMPLE)).toEqual([]);
  });

  describe('규칙 1: name 없는 input/select/textarea', () => {
    it('name 없는 input이 있으면 개수를 담아 경고한다', () => {
      const html = BASE.replace('</form>', '<input type="text"></form>');
      expect(lintHtmlTemplate(html)).toContain(MISSING_NAME_MSG(1));
    });

    it('name 없는 select·textarea도 함께 센다', () => {
      const html = BASE.replace('</form>', '<select></select><textarea></textarea></form>');
      expect(lintHtmlTemplate(html)).toContain(MISSING_NAME_MSG(2));
    });

    it('submit/button/reset 타입 input은 name이 없어도 제외한다', () => {
      const html = BASE.replace('</form>', '<input type="submit"><input type="button"><input type="reset"></form>');
      expect(lintHtmlTemplate(html)).not.toEqual(expect.arrayContaining([expect.stringContaining('name 속성이')]));
    });

    it('name이 있으면(대소문자·속성 순서 변형 포함) 경고하지 않는다', () => {
      const html = BASE.replace('</form>', '<INPUT TYPE="text" NAME="phone"><input required name="etc"></form>');
      expect(lintHtmlTemplate(html)).not.toEqual(expect.arrayContaining([expect.stringContaining('name 속성이')]));
    });

    it('BASE(음성)에는 이 경고가 없다', () => {
      expect(lintHtmlTemplate(BASE)).not.toEqual(expect.arrayContaining([expect.stringContaining('name 속성이')]));
    });
  });

  describe('규칙 2: 외부 script', () => {
    it('src가 있는 script는 개수를 담아 경고한다', () => {
      const html = BASE.replace(
        '</form>',
        '</form><script src="https://cdn.example.com/x.js"></script>',
      );
      expect(lintHtmlTemplate(html)).toContain(EXTERNAL_SCRIPT_MSG(1));
    });

    it('src 없는 인라인 script는 경고하지 않는다(음성)', () => {
      const html = BASE.replace('</form>', "</form><script>console.log('hi')</script>");
      expect(lintHtmlTemplate(html)).not.toEqual(expect.arrayContaining([expect.stringContaining('외부 스크립트')]));
    });

    it('SRC 대문자·속성 순서 변형도 잡는다', () => {
      const html = BASE.replace('</form>', '</form><script type="text/javascript" SRC="/x.js"></script>');
      expect(lintHtmlTemplate(html)).toContain(EXTERNAL_SCRIPT_MSG(1));
    });
  });

  describe('규칙 3: form의 action/method/onsubmit', () => {
    it('action이 있으면 경고한다', () => {
      const html = BASE.replace('<form>', '<form action="/submit">');
      expect(lintHtmlTemplate(html)).toContain(FORM_IGNORED_ATTR_MSG);
    });

    it('method가 있으면 경고한다', () => {
      const html = BASE.replace('<form>', '<form method="post">');
      expect(lintHtmlTemplate(html)).toContain(FORM_IGNORED_ATTR_MSG);
    });

    it('onsubmit이 있으면 경고한다', () => {
      const html = BASE.replace('<form>', '<form onsubmit="return false">');
      expect(lintHtmlTemplate(html)).toContain(FORM_IGNORED_ATTR_MSG);
    });

    it('BASE(음성)에는 이 경고가 없다', () => {
      expect(lintHtmlTemplate(BASE)).not.toContain(FORM_IGNORED_ATTR_MSG);
    });
  });

  describe('규칙 4: 제출 버튼 없음', () => {
    it('제출 버튼이 전혀 없으면 경고한다', () => {
      const html = BASE.replace('<button type="submit">보내기</button>', '');
      expect(lintHtmlTemplate(html)).toContain(NO_SUBMIT_MSG);
    });

    it('type 없는 button은 기본값 submit으로 인정한다(음성)', () => {
      const html = BASE.replace('<button type="submit">보내기</button>', '<button>보내기</button>');
      expect(lintHtmlTemplate(html)).not.toContain(NO_SUBMIT_MSG);
    });

    it('type="button"은 제출 버튼으로 인정하지 않는다(양성)', () => {
      const html = BASE.replace('<button type="submit">보내기</button>', '<button type="button">보내기</button>');
      expect(lintHtmlTemplate(html)).toContain(NO_SUBMIT_MSG);
    });

    it('<input type="submit">도 제출 버튼으로 인정한다(음성)', () => {
      const html = BASE.replace('<button type="submit">보내기</button>', '<input type="submit" value="보내기">');
      expect(lintHtmlTemplate(html)).not.toContain(NO_SUBMIT_MSG);
    });
  });

  describe('규칙 5: meta refresh 또는 target=_top/_parent', () => {
    it('meta http-equiv=refresh가 있으면 경고한다', () => {
      const html = BASE.replace(
        '<form>',
        '<meta http-equiv="refresh" content="0;url=https://evil.example.com"><form>',
      );
      expect(lintHtmlTemplate(html)).toContain(NAVIGATION_ESCAPE_MSG);
    });

    it('target="_top"이 있으면 경고한다', () => {
      const html = BASE.replace('</form>', '</form><a href="#" target="_top">이동</a>');
      expect(lintHtmlTemplate(html)).toContain(NAVIGATION_ESCAPE_MSG);
    });

    it("target='_parent'(작은따옴표)도 잡는다", () => {
      const html = BASE.replace('</form>', "</form><a href='#' target='_parent'>이동</a>");
      expect(lintHtmlTemplate(html)).toContain(NAVIGATION_ESCAPE_MSG);
    });

    it('BASE(음성)에는 이 경고가 없다', () => {
      expect(lintHtmlTemplate(BASE)).not.toContain(NAVIGATION_ESCAPE_MSG);
    });
  });

  describe('규칙 6: 관리자 API 호출', () => {
    it('<a href>가 /api/admin을 포함하면 경고한다', () => {
      const html = BASE.replace('</form>', '</form><a href="/api/admin/campaigns">관리</a>');
      expect(lintHtmlTemplate(html)).toContain(ADMIN_API_MSG);
    });

    it("fetch('/api/admin/...')가 있으면 경고한다", () => {
      const html = BASE.replace('</form>', "</form><script>fetch('/api/admin/campaigns')</script>");
      expect(lintHtmlTemplate(html)).toContain(ADMIN_API_MSG);
    });

    it('XMLHttpRequest로 /api/admin을 호출하면 경고한다', () => {
      const html = BASE.replace(
        '</form>',
        "</form><script>var x = new XMLHttpRequest(); x.open('GET', '/api/admin/campaigns');</script>",
      );
      expect(lintHtmlTemplate(html)).toContain(ADMIN_API_MSG);
    });

    it('BASE(음성)에는 이 경고가 없다', () => {
      expect(lintHtmlTemplate(BASE)).not.toContain(ADMIN_API_MSG);
    });
  });

  describe('규칙 7: 개인정보 수집 동의 체크박스(name="consent")', () => {
    it('consent 체크박스가 없으면 경고한다', () => {
      const html = BASE.replace('<input type="checkbox" name="consent">', '');
      expect(lintHtmlTemplate(html)).toContain(NO_CONSENT_MSG);
    });

    it('속성 순서가 달라도(name 먼저) 인정한다(음성)', () => {
      const html = BASE.replace(
        '<input type="checkbox" name="consent">',
        '<input name="consent" type="checkbox">',
      );
      expect(lintHtmlTemplate(html)).not.toContain(NO_CONSENT_MSG);
    });

    it('BASE(음성)에는 이 경고가 없다', () => {
      expect(lintHtmlTemplate(BASE)).not.toContain(NO_CONSENT_MSG);
    });
  });

  it('여러 규칙을 동시에 위반하면 고정된 순서(1~7)로 경고를 담는다', () => {
    const html = `<form action="/submit">
      <input type="text">
      <meta http-equiv="refresh" content="0">
      <a href="/api/admin/campaigns">관리</a>
      <script src="https://cdn.example.com/x.js"></script>
    </form>`;

    const warnings = lintHtmlTemplate(html);

    expect(warnings).toEqual([
      MISSING_NAME_MSG(1),
      EXTERNAL_SCRIPT_MSG(1),
      FORM_IGNORED_ATTR_MSG,
      NO_SUBMIT_MSG,
      NAVIGATION_ESCAPE_MSG,
      ADMIN_API_MSG,
      NO_CONSENT_MSG,
    ]);
  });
});
