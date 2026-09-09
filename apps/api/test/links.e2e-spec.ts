import 'reflect-metadata';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  VALID_FORM_FIXTURE_PATH,
  PUBLIC_BASE_URL,
  CHANNELS,
  TestContext,
} from './utils';

describe('links e2e (§4.4 POST/GET /api/admin/forms/:id/links)', () => {
  let ctx: TestContext;
  let agent: request.SuperAgentTest;
  let formId: string;
  let slug: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(ctx.ds);
    await seedOperator(ctx.ds);
    ({ agent } = await loginAgent(ctx));

    const template = await agent
      .post('/api/admin/templates')
      .field('name', '템플릿')
      .attach('file', VALID_FORM_FIXTURE_PATH);
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '링크 캠페인' });
    const form = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId: template.body.id, name: '링크 폼' });
    formId = form.body.id;
    slug = form.body.slug;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('4채널 모두 201로 생성되고 url=/p/${slug}?src=${code}, code는 8자다', async () => {
    for (const channel of CHANNELS) {
      const res = await agent.post(`/api/admin/forms/${formId}/links`).send({ channel });
      expect(res.status).toBe(201);
      expect(res.body.channel).toBe(channel);
      expect(res.body.code).toHaveLength(8);
      expect(res.body.url).toBe(`${PUBLIC_BASE_URL}/p/${slug}?src=${res.body.code}`);
    }
  });

  it('같은 채널을 재생성하면 409이다', async () => {
    await agent.post(`/api/admin/forms/${formId}/links`).send({ channel: 'instagram' });
    const res = await agent.post(`/api/admin/forms/${formId}/links`).send({ channel: 'instagram' });
    expect(res.status).toBe(409);
  });

  it('잘못된 채널 값은 400이다', async () => {
    const res = await agent.post(`/api/admin/forms/${formId}/links`).send({ channel: 'facebook' });
    expect(res.status).toBe(400);
  });

  it('존재하지 않는(형식은 유효한) 폼 id는 404이다', async () => {
    const res = await agent.post(`/api/admin/forms/${randomUUID()}/links`).send({ channel: 'instagram' });
    expect(res.status).toBe(404);
  });

  it('uuid 형식이 아닌 폼 id는 400이다', async () => {
    const res = await agent.post('/api/admin/forms/not-a-uuid/links').send({ channel: 'instagram' });
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/forms/:id/links는 생성된 링크 목록을 반환한다', async () => {
    await agent.post(`/api/admin/forms/${formId}/links`).send({ channel: 'instagram' });
    await agent.post(`/api/admin/forms/${formId}/links`).send({ channel: 'x' });

    const res = await agent.get(`/api/admin/forms/${formId}/links`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.map((l: { channel: string }) => l.channel).sort()).toEqual(['instagram', 'x']);
  });
});
