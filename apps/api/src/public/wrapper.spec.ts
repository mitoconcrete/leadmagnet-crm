import { buildWrapperPage, buildCsp } from './wrapper';

describe('buildWrapperPage', () => {
  it('sandbox 속성에 allow-scripts allow-forms만 포함하고 allow-same-origin은 없다', () => {
    const html = buildWrapperPage({ title: '테스트 폼', srcdoc: '<form></form>' });
    expect(html).toContain('sandbox="allow-scripts allow-forms"');
    expect(html).not.toContain('allow-same-origin');
  });

  it('srcdoc은 HTML 이스케이프된다', () => {
    const html = buildWrapperPage({ title: 't', srcdoc: '<script>alert("x")</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it('제목을 이스케이프해 <title>에 포함한다', () => {
    const html = buildWrapperPage({ title: '<b>제목</b>', srcdoc: '' });
    expect(html).toContain('&lt;b&gt;제목&lt;/b&gt;');
  });
});

describe('buildCsp', () => {
  it('publicBaseUrl을 connect-src에 포함한다', () => {
    const csp = buildCsp('http://localhost:3001');
    expect(csp).toContain("connect-src http://localhost:3001/api/public/");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
  });
});
