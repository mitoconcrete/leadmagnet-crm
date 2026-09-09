import 'reflect-metadata';
import * as request from 'supertest';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  createFixtureFlow,
  PUBLIC_BASE_URL,
  DEFAULT_OPERATOR_EMAIL,
  TestContext,
} from './utils';

describe('isolation e2e (§2 격리 원칙)', () => {
  let ctx: TestContext;
  let agent: request.SuperAgentTest;
  let cookie: string;
  let flow: Awaited<ReturnType<typeof createFixtureFlow>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(ctx.ds);
    await seedOperator(ctx.ds);
    ({ agent, cookie } = await loginAgent(ctx));
    flow = await createFixtureFlow(agent);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("CSP에 connect-src ${PUBLIC_BASE_URL}/api/public/와 default-src 'none'이 있고 X-Frame-Options는 SAMEORIGIN이다", async () => {
    const res = await ctx.http().get(`/p/${flow.form.slug}`);
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain(`connect-src ${PUBLIC_BASE_URL}/api/public/`);
    expect(csp).toContain("default-src 'none'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('srcdoc 안에는 allow-same-origin이 없고 allow-scripts allow-forms만 있다', async () => {
    const res = await ctx.http().get(`/p/${flow.form.slug}`);
    expect(res.text).not.toContain('allow-same-origin');
    expect(res.text).toContain('sandbox="allow-scripts allow-forms"');
  });

  it('Path=/api/admin인 sid 쿠키를 /p/:slug에 보내도 응답에 세션 정보(이메일)가 노출되지 않는다', async () => {
    const sid = cookie.split(';')[0];
    const res = await ctx.http().get(`/p/${flow.form.slug}`).set('Cookie', sid);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain(DEFAULT_OPERATOR_EMAIL);
  });

  it("Origin: null로 /api/admin/campaigns를 호출해도 access-control-allow-origin 헤더가 없다", async () => {
    const res = await agent.get('/api/admin/campaigns').set('Origin', 'null');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('/api/public/forms/:slug/submissions에 GET 요청(sid 쿠키 포함)은 404 또는 405이며 관리자 데이터를 노출하지 않는다', async () => {
    const sid = cookie.split(';')[0];
    const res = await ctx.http().get(`/api/public/forms/${flow.form.slug}/submissions`).set('Cookie', sid);
    expect([404, 405]).toContain(res.status);
  });
});
