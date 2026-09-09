import { buildInjectedHtml } from './inject';

describe('buildInjectedHtml', () => {
  const opts = { submitUrl: 'http://localhost:3001/api/public/forms/my-form/submissions', visitToken: 'visit-uuid-1' };

  it('</BODY> 태그가 있으면 대소문자 무관하게 그 앞에 삽입한다', () => {
    const html = '<html><body><form></form></BODY></html>';
    const result = buildInjectedHtml(html, opts);
    const bodyIdx = result.search(/<\/BODY>/i);
    const scriptIdx = result.indexOf('<script>');
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(scriptIdx).toBeLessThan(bodyIdx);
  });

  it('</body>가 없으면 문서 끝에 삽입한다', () => {
    const html = '<html><form></form></html>';
    const result = buildInjectedHtml(html, opts);
    expect(result.startsWith(html)).toBe(true);
    expect(result.slice(html.length)).toContain('<script>');
  });

  it('submitUrl과 visitToken을 스크립트 본문에 포함한다', () => {
    const html = '<form></form>';
    const result = buildInjectedHtml(html, opts);
    expect(result).toContain(JSON.stringify(opts.submitUrl));
    expect(result).toContain(JSON.stringify(opts.visitToken));
  });
});
