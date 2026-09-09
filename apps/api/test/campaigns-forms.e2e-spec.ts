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
  TestContext,
} from './utils';

async function uploadTemplate(agent: request.SuperAgentTest): Promise<string> {
  const res = await agent
    .post('/api/admin/templates')
    .field('name', '템플릿')
    .attach('file', VALID_FORM_FIXTURE_PATH);
  return res.body.id as string;
}

describe('campaigns & forms e2e (§4.3, §4.4)', () => {
  let ctx: TestContext;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(ctx.ds);
    await seedOperator(ctx.ds);
    ({ agent } = await loginAgent(ctx));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('캠페인 생성은 201과 Campaign을 반환한다', async () => {
    const res = await agent.post('/api/admin/campaigns').send({ name: '캠페인A', description: '설명' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: '캠페인A', description: '설명', status: 'active' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('캠페인 조회는 200과 forms를 포함한 Campaign을 반환한다', async () => {
    const created = await agent.post('/api/admin/campaigns').send({ name: '캠페인B' });
    const res = await agent.get(`/api/admin/campaigns/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(Array.isArray(res.body.forms)).toBe(true);
  });

  it('PATCH로 status를 변경하면 200과 갱신된 값을 반환한다', async () => {
    const created = await agent.post('/api/admin/campaigns').send({ name: '캠페인C' });
    const res = await agent.patch(`/api/admin/campaigns/${created.body.id}`).send({ status: 'archived' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });

  it('이름 없이 캠페인을 생성하면 400이다', async () => {
    const res = await agent.post('/api/admin/campaigns').send({ description: '이름 없음' });
    expect(res.status).toBe(400);
  });

  it('잘못된 status 값으로 PATCH하면 400이다', async () => {
    const created = await agent.post('/api/admin/campaigns').send({ name: '캠페인D' });
    const res = await agent.patch(`/api/admin/campaigns/${created.body.id}`).send({ status: 'deleted' });
    expect(res.status).toBe(400);
  });

  it('화이트리스트 밖 필드는 무시되고 요청은 성공한다', async () => {
    const res = await agent.post('/api/admin/campaigns').send({ name: '캠페인E', notAllowed: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('notAllowed');
  });

  it('uuid 형식이 아닌 캠페인 id 조회는 400이다', async () => {
    const res = await agent.get('/api/admin/campaigns/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('존재하지 않는(형식은 유효한) 캠페인 id 조회는 404이다', async () => {
    const res = await agent.get(`/api/admin/campaigns/${randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('존재하지 않는 캠페인 id PATCH는 404이다', async () => {
    const res = await agent.patch(`/api/admin/campaigns/${randomUUID()}`).send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('폼 생성은 201, slug와 publicUrl(${PUBLIC_BASE_URL}/p/${slug})을 반환한다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인F' });
    const templateId = await uploadTemplate(agent);
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼1', slug: 'form-1' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('form-1');
    expect(res.body.publicUrl).toBe(`${PUBLIC_BASE_URL}/p/form-1`);
  });

  it('slug를 지정하지 않으면 자동 생성된다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인G' });
    const templateId = await uploadTemplate(agent);
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '자동 슬러그 폼' });

    expect(res.status).toBe(201);
    expect(typeof res.body.slug).toBe('string');
    expect(res.body.slug.length).toBeGreaterThan(0);
  });

  it('같은 slug로 폼을 생성하면 409이다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인H' });
    const templateId = await uploadTemplate(agent);
    await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼A', slug: 'dup-slug' });
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼B', slug: 'dup-slug' });
    expect(res.status).toBe(409);
  });

  it('존재하지 않는 templateId로 폼을 생성하면 404이다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인I' });
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId: randomUUID(), name: '폼C' });
    expect(res.status).toBe(404);
  });

  it('GET /api/admin/forms?campaignId=는 해당 캠페인 폼만 반환한다', async () => {
    const campaign1 = await agent.post('/api/admin/campaigns').send({ name: '캠페인J1' });
    const campaign2 = await agent.post('/api/admin/campaigns').send({ name: '캠페인J2' });
    const templateId = await uploadTemplate(agent);
    await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign1.body.id, templateId, name: '폼J1' });
    await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign2.body.id, templateId, name: '폼J2' });

    const res = await agent.get(`/api/admin/forms?campaignId=${campaign1.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].campaignId).toBe(campaign1.body.id);
  });

  it('PATCH로 isActive를 false로 바꿀 수 있다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인K' });
    const templateId = await uploadTemplate(agent);
    const form = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼K' });
    const res = await agent.patch(`/api/admin/forms/${form.body.id}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('GET /api/admin/forms/:id는 200과 Form(+links 배열)을 반환한다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인L' });
    const templateId = await uploadTemplate(agent);
    const form = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼L' });
    const link = await agent.post(`/api/admin/forms/${form.body.id}/links`).send({ channel: 'instagram' });

    const res = await agent.get(`/api/admin/forms/${form.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: form.body.id,
      campaignId: campaign.body.id,
      templateId,
      name: '폼L',
      slug: form.body.slug,
    });
    expect(Array.isArray(res.body.links)).toBe(true);
    expect(res.body.links.map((l: { id: string }) => l.id)).toContain(link.body.id);
  });

  it('존재하지 않는(형식은 유효한) 폼 id 조회는 404이다', async () => {
    const res = await agent.get(`/api/admin/forms/${randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('uuid 형식이 아닌 폼 id 조회는 400이다', async () => {
    const res = await agent.get('/api/admin/forms/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('successMessage를 지정해 폼을 생성하면 201 응답에 그대로 반영된다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인M' });
    const templateId = await uploadTemplate(agent);
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼M', successMessage: '신청 감사합니다!' });
    expect(res.status).toBe(201);
    expect(res.body.successMessage).toBe('신청 감사합니다!');
  });

  it('PATCH로 successMessage를 변경할 수 있다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인N' });
    const templateId = await uploadTemplate(agent);
    const form = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼N' });
    const res = await agent
      .patch(`/api/admin/forms/${form.body.id}`)
      .send({ successMessage: '수정된 성공 메시지' });
    expect(res.status).toBe(200);
    expect(res.body.successMessage).toBe('수정된 성공 메시지');
  });
});
