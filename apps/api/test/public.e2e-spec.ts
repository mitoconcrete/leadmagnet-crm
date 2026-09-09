import 'reflect-metadata';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  createFixtureFlow,
  TestContext,
} from './utils';

const VISIT_TOKEN_RE = /VISIT_TOKEN=(?:"|&quot;)([0-9a-f-]{36})/;

function extractVisitToken(html: string): string {
  const match = VISIT_TOKEN_RE.exec(html);
  if (!match) throw new Error('VISIT_TOKEN을 응답 본문에서 찾지 못했다');
  return match[1];
}

function extractVidCookie(setCookie: string[] | undefined): string {
  const cookie = (setCookie ?? []).find((c) => c.startsWith('vid='));
  if (!cookie) throw new Error('vid 쿠키가 응답에 없다');
  return cookie.split(';')[0].split('=')[1];
}

describe('public e2e (§4.7 /p/:slug, /api/public/forms/:slug/submissions)', () => {
  let ctx: TestContext;
  let agent: request.SuperAgentTest;
  let flow: Awaited<ReturnType<typeof createFixtureFlow>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(ctx.ds);
    await seedOperator(ctx.ds);
    ({ agent } = await loginAgent(ctx));
    flow = await createFixtureFlow(agent);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /p/:slug?src=code는 200, text/html, vid 쿠키(Path=/p), sandbox와 srcdoc을 포함한다', async () => {
    const res = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const vidCookie = setCookie.find((c) => c.startsWith('vid='));
    expect(vidCookie).toBeDefined();
    expect(vidCookie).toContain('Path=/p');

    expect(res.text).toContain('sandbox="allow-scripts allow-forms"');
    expect(res.text).toContain('srcdoc');
  });

  it('같은 vid로 2회 방문하면 visits는 2, visitors는 1이다', async () => {
    const first = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const vid = extractVidCookie(first.headers['set-cookie'] as unknown as string[]);

    await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`).set('Cookie', `vid=${vid}`);

    const [{ count: visitCount }] = await ctx.ds.query(
      `SELECT count(*) FROM visits WHERE form_id = $1`,
      [flow.form.id],
    );
    const [{ count: visitorCount }] = await ctx.ds.query(
      `SELECT count(DISTINCT visitor_id) FROM visits WHERE form_id = $1`,
      [flow.form.id],
    );
    expect(Number(visitCount)).toBe(2);
    expect(Number(visitorCount)).toBe(1);
  });

  it('src 없이 방문하면 channel=direct, link_id=null인 visit 행이 생긴다', async () => {
    await ctx.http().get(`/p/${flow.form.slug}`);
    const [row] = await ctx.ds.query(
      `SELECT channel, link_id FROM visits WHERE form_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [flow.form.id],
    );
    expect(row.channel).toBe('direct');
    expect(row.link_id).toBeNull();
  });

  it('다른 폼 링크의 src로 방문하면 direct로 귀속된다', async () => {
    const otherFlow = await createFixtureFlow(agent);
    await ctx.http().get(`/p/${flow.form.slug}?src=${otherFlow.links.instagram.code}`);
    const [row] = await ctx.ds.query(
      `SELECT channel, link_id FROM visits WHERE form_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [flow.form.id],
    );
    expect(row.channel).toBe('direct');
    expect(row.link_id).toBeNull();
  });

  it('존재하지 않는 slug는 404이다', async () => {
    const res = await ctx.http().get('/p/no-such-slug');
    expect(res.status).toBe(404);
  });

  it('비활성 폼은 404이다', async () => {
    await agent.patch(`/api/admin/forms/${flow.form.id}`).send({ isActive: false });
    const res = await ctx.http().get(`/p/${flow.form.slug}`);
    expect(res.status).toBe(404);
  });

  it('제출은 201 {id,message}를 반환하고 submissions에 channel=instagram, payload.name이 저장된다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);

    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken, fields: { name: '테스트 사용자' } });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');

    const rows = await ctx.ds.query(`SELECT channel, payload FROM submissions WHERE form_id = $1`, [
      flow.form.id,
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].channel).toBe('instagram');
    expect(rows[0].payload.name).toBe('테스트 사용자');
  });

  it('빈 fields는 400이다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);
    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken, fields: {} });
    expect(res.status).toBe(400);
  });

  it('fields가 배열이면 400이다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);
    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken, fields: [] });
    expect(res.status).toBe(400);
  });

  it('fields가 문자열이면 400이다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);
    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken, fields: 'not-an-object' });
    expect(res.status).toBe(400);
  });

  it('잘못된 visitToken은 400이다', async () => {
    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken: randomUUID(), fields: { name: '테스트' } });
    expect(res.status).toBe(400);
  });

  it('다른 폼의 visitToken으로 제출하면 400이다', async () => {
    const otherFlow = await createFixtureFlow(agent);
    const otherPage = await ctx
      .http()
      .get(`/p/${otherFlow.form.slug}?src=${otherFlow.links.instagram.code}`);
    const otherVisitToken = extractVisitToken(otherPage.text);

    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken: otherVisitToken, fields: { name: '테스트' } });
    expect(res.status).toBe(400);
  });

  it('비활성 폼에 제출하면 404이다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);
    await agent.patch(`/api/admin/forms/${flow.form.id}`).send({ isActive: false });

    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken, fields: { name: '테스트' } });
    expect(res.status).toBe(404);
  });

  it('제출 응답 헤더에 access-control-allow-origin: *가 있다', async () => {
    const page = await ctx.http().get(`/p/${flow.form.slug}?src=${flow.links.instagram.code}`);
    const visitToken = extractVisitToken(page.text);
    const res = await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .set('Origin', 'https://example.com')
      .send({ visitToken, fields: { name: '테스트' } });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('OPTIONS 프리플라이트는 204와 CORS 헤더 3종을 반환한다', async () => {
    const res = await ctx
      .http()
      .options(`/api/public/forms/${flow.form.slug}/submissions`)
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toBeDefined();
    expect(res.headers['access-control-allow-headers']).toBeDefined();
  });
});
