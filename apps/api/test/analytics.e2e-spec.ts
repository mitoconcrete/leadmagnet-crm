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

describe('analytics e2e (§4.3 stats, §4.5 submissions, §4.6 analytics)', () => {
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

  /**
   * 시나리오(주석에 근거 명시):
   * - instagram 링크 방문 3회: V1(신규) → V1(재사용) → V2(신규). 즉 vid 2종(V1,V2)으로 방문 3회.
   * - threads 링크 방문 1회: V3(신규).
   * - direct 방문(src 없음) 1회: V3(재사용).
   * → visits 합계 5, 전체 distinct visitor = {V1,V2,V3} = 3.
   * - 제출 2건은 V1의 첫 방문과 V2의 방문에서 생성한 visitToken으로 진행(둘 다 instagram 채널).
   */
  async function buildAnalyticsScenario() {
    const igCode = flow.links.instagram.code;
    const thCode = flow.links.threads.code;

    const v1First = await ctx.http().get(`/p/${flow.form.slug}?src=${igCode}`);
    expect(v1First.status).toBe(200);
    const v1Cookie = (v1First.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('vid='))!
      .split(';')[0]
      .split('=')[1];

    await ctx.http().get(`/p/${flow.form.slug}?src=${igCode}`).set('Cookie', `vid=${v1Cookie}`);

    const v2 = await ctx.http().get(`/p/${flow.form.slug}?src=${igCode}`);
    expect(v2.status).toBe(200);
    const v2Cookie = (v2.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('vid='))!
      .split(';')[0]
      .split('=')[1];

    const v3 = await ctx.http().get(`/p/${flow.form.slug}?src=${thCode}`);
    expect(v3.status).toBe(200);
    const v3Cookie = (v3.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('vid='))!
      .split(';')[0]
      .split('=')[1];

    await ctx.http().get(`/p/${flow.form.slug}`).set('Cookie', `vid=${v3Cookie}`);

    const token1 = extractVisitToken(v1First.text);
    const token2 = extractVisitToken(v2.text);

    await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken: token1, fields: { name: '신청자A' } });
    await ctx
      .http()
      .post(`/api/public/forms/${flow.form.slug}/submissions`)
      .send({ visitToken: token2, fields: { name: '신청자B' } });
  }

  it('캠페인 stats: visits=5, visitors=3, submissions=2, conversionRate=round(2/3,4)', async () => {
    await buildAnalyticsScenario();
    const res = await agent.get(`/api/admin/campaigns/${flow.campaignId}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.campaignId).toBe(flow.campaignId);
    expect(res.body.visits).toBe(5);
    expect(res.body.visitors).toBe(3);
    expect(res.body.submissions).toBe(2);
    expect(res.body.conversionRate).toBeCloseTo(0.6667, 4);
  });

  it('캠페인 stats의 channels는 direct,instagram,x,youtube,threads 5행 순서·값을 갖는다', async () => {
    await buildAnalyticsScenario();
    const res = await agent.get(`/api/admin/campaigns/${flow.campaignId}/stats`);

    const channels = res.body.channels as Array<{
      channel: string;
      visits: number;
      visitors: number;
      submissions: number;
      conversionRate: number;
    }>;
    expect(channels.map((c) => c.channel)).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
    expect(channels[0]).toMatchObject({ channel: 'direct', visits: 1, visitors: 1, submissions: 0, conversionRate: 0 });
    expect(channels[1]).toMatchObject({ channel: 'instagram', visits: 3, visitors: 2, submissions: 2, conversionRate: 1 });
    expect(channels[2]).toMatchObject({ channel: 'x', visits: 0, visitors: 0, submissions: 0, conversionRate: 0 });
    expect(channels[3]).toMatchObject({ channel: 'youtube', visits: 0, visitors: 0, submissions: 0, conversionRate: 0 });
    expect(channels[4]).toMatchObject({ channel: 'threads', visits: 1, visitors: 1, submissions: 0, conversionRate: 0 });
  });

  it('GET /api/admin/analytics/channels는 전체 캠페인 합산 5행을 반환한다', async () => {
    await buildAnalyticsScenario();
    const res = await agent.get('/api/admin/analytics/channels');
    expect(res.status).toBe(200);
    const channels = res.body as Array<{ channel: string; visits: number; visitors: number }>;
    expect(channels.map((c) => c.channel)).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
    expect(channels.find((c) => c.channel === 'instagram')).toMatchObject({ visits: 3, visitors: 2 });
  });

  it('GET /api/admin/analytics/campaigns는 대상 캠페인 행을 포함한다', async () => {
    await buildAnalyticsScenario();
    const res = await agent.get('/api/admin/analytics/campaigns');
    expect(res.status).toBe(200);
    const row = (res.body as Array<{ campaignId: string; visits: number; visitors: number; submissions: number; conversionRate: number }>).find(
      (c) => c.campaignId === flow.campaignId,
    );
    expect(row).toBeDefined();
    expect(row).toMatchObject({ visits: 5, visitors: 3, submissions: 2 });
    expect(row!.conversionRate).toBeCloseTo(0.6667, 4);
  });

  it('GET /api/admin/analytics/campaigns 행에 forms/activeForms 수를 포함한다(ADR 0019 개정)', async () => {
    const form2 = await agent
      .post('/api/admin/forms')
      .send({ campaignId: flow.campaignId, templateId: flow.templateId, name: '폼2' });
    await agent.patch(`/api/admin/forms/${form2.body.id}`).send({ isActive: false });

    const res = await agent.get('/api/admin/analytics/campaigns');
    expect(res.status).toBe(200);
    const row = (res.body as Array<{ campaignId: string; forms: number; activeForms: number }>).find(
      (c) => c.campaignId === flow.campaignId,
    );
    expect(row).toBeDefined();
    // flow가 만든 폼 1개(활성) + 방금 만든 비활성 폼 1개 = 전체 2, 활성 1
    expect(row!.forms).toBe(2);
    expect(row!.activeForms).toBe(1);
  });

  it('GET /api/admin/submissions?campaignId=는 total=2, formName을 포함한다', async () => {
    await buildAnalyticsScenario();
    const res = await agent.get(`/api/admin/submissions?campaignId=${flow.campaignId}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].formName).toBe('테스트 폼');
  });

  it('GET /api/admin/submissions는 createdAt DESC로 정렬된다', async () => {
    // buildAnalyticsScenario는 token1(신청자A)을 먼저, token2(신청자B)를 나중에 제출한다.
    // DESC 정렬이면 나중에 만들어진 신청자B가 items[0]에 와야 한다.
    await buildAnalyticsScenario();
    const res = await agent.get(`/api/admin/submissions?campaignId=${flow.campaignId}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].payload.name).toBe('신청자B');
    expect(res.body.items[1].payload.name).toBe('신청자A');
    const first = new Date(res.body.items[0].createdAt).getTime();
    const second = new Date(res.body.items[1].createdAt).getTime();
    expect(first).toBeGreaterThanOrEqual(second);
  });

  it('존재하지 않는(형식은 유효한) 캠페인 stats는 404이다', async () => {
    const res = await agent.get(`/api/admin/campaigns/${randomUUID()}/stats`);
    expect(res.status).toBe(404);
  });

  it('방문 0건인 캠페인은 conversionRate 0이며 channels 5행을 유지한다', async () => {
    const emptyFlow = await createFixtureFlow(agent);
    const res = await agent.get(`/api/admin/campaigns/${emptyFlow.campaignId}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.visits).toBe(0);
    expect(res.body.visitors).toBe(0);
    expect(res.body.submissions).toBe(0);
    expect(res.body.conversionRate).toBe(0);
    const channels = res.body.channels as Array<{ visits: number; submissions: number; conversionRate: number }>;
    expect(channels.length).toBe(5);
    expect(channels.every((c) => c.visits === 0 && c.submissions === 0 && c.conversionRate === 0)).toBe(true);
  });

  it('GET /api/admin/submissions?formId=는 해당 폼의 제출만 반환한다', async () => {
    await buildAnalyticsScenario();

    const formB = await agent
      .post('/api/admin/forms')
      .send({ campaignId: flow.campaignId, templateId: flow.templateId, name: '폼B' });
    const linkB = await agent.post(`/api/admin/forms/${formB.body.id}/links`).send({ channel: 'instagram' });
    const pageB = await ctx.http().get(`/p/${formB.body.slug}?src=${linkB.body.code}`);
    const tokenB = extractVisitToken(pageB.text);
    await ctx
      .http()
      .post(`/api/public/forms/${formB.body.slug}/submissions`)
      .send({ visitToken: tokenB, fields: { name: '신청자C' } });

    const res = await agent.get(`/api/admin/submissions?formId=${formB.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].formId).toBe(formB.body.id);
  });

  it('submissions 페이지네이션 2페이지째는 남은 항목만 반환한다', async () => {
    await buildAnalyticsScenario();

    const formB = await agent
      .post('/api/admin/forms')
      .send({ campaignId: flow.campaignId, templateId: flow.templateId, name: '폼B' });
    const linkB = await agent.post(`/api/admin/forms/${formB.body.id}/links`).send({ channel: 'instagram' });
    const pageB = await ctx.http().get(`/p/${formB.body.slug}?src=${linkB.body.code}`);
    const tokenB = extractVisitToken(pageB.text);
    await ctx
      .http()
      .post(`/api/public/forms/${formB.body.slug}/submissions`)
      .send({ visitToken: tokenB, fields: { name: '신청자C' } });

    // campaignId 기준 총 3건(A 2건 + B 1건), limit=2로 2페이지째는 1건만 남는다.
    const res = await agent.get(`/api/admin/submissions?campaignId=${flow.campaignId}&page=2&limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.items.length).toBe(1);
  });

  it('limit=abc처럼 잘못된 타입의 쿼리는 400이다', async () => {
    const res = await agent.get('/api/admin/submissions?limit=abc');
    expect(res.status).toBe(400);
  });

  it('page/limit 미지정 시 기본값(page=1,limit=20)이며 반환 항목은 limit을 넘지 않는다', async () => {
    const res = await agent.get('/api/admin/submissions');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.items.length).toBeLessThanOrEqual(res.body.limit);
  });
});
