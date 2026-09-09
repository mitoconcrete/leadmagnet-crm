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

const VISIT_TOKEN_RE = /VISIT_TOKEN=(?:"|&quot;)([0-9a-f-]{36})/;

function extractVisitToken(html: string): string {
  const match = VISIT_TOKEN_RE.exec(html);
  if (!match) throw new Error('VISIT_TOKEN을 응답 본문에서 찾지 못했다');
  return match[1];
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

  it('slug 형식이 아니면(예: a/b) 400이다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '캠페인H2' });
    const templateId = await uploadTemplate(agent);
    const res = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '폼X', slug: 'a/b' });
    expect(res.status).toBe(400);
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

  it('G2 리뷰 지적: force 소프트 삭제된 템플릿으로 폼을 생성하면 404, 기존 폼의 templateId를 그걸로 바꾸면 404이다', async () => {
    const campaign = await agent.post('/api/admin/campaigns').send({ name: '소프트삭제 템플릿 테스트' });
    const templateId = await uploadTemplate(agent);
    // 참조하는 폼을 하나 만들어 강제 삭제가 hard delete가 아니라 소프트 삭제 경로를 타게 한다.
    await agent.post('/api/admin/forms').send({ campaignId: campaign.body.id, templateId, name: '참조 폼' });
    const deleteRes = await agent.delete(`/api/admin/templates/${templateId}?force=true`);
    expect(deleteRes.status).toBe(204);

    const createRes = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId, name: '새 폼' });
    expect(createRes.status).toBe(404);

    const otherTemplateId = await uploadTemplate(agent);
    const otherForm = await agent
      .post('/api/admin/forms')
      .send({ campaignId: campaign.body.id, templateId: otherTemplateId, name: '다른 폼' });
    const patchRes = await agent.patch(`/api/admin/forms/${otherForm.body.id}`).send({ templateId });
    expect(patchRes.status).toBe(404);
  });

  describe('삭제된 템플릿의 폼 재활성 차단(ADR 0014 보완)', () => {
    it('force 삭제 후 GET은 templateDeleted:true, PATCH {isActive:true}는 409, DB로 직접 켜도 공개 페이지는 404, 살아있는 템플릿으로 교체하면 재활성·공개 페이지 모두 성공한다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '재활성 차단 테스트' });
      const templateId = await uploadTemplate(agent);
      const form = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '재활성 테스트 폼' });

      const deleteRes = await agent.delete(`/api/admin/templates/${templateId}?force=true`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent.get(`/api/admin/forms/${form.body.id}`);
      expect(afterDelete.body.isActive).toBe(false);
      expect(afterDelete.body.templateDeleted).toBe(true);

      const reactivateRes = await agent.patch(`/api/admin/forms/${form.body.id}`).send({ isActive: true });
      expect(reactivateRes.status).toBe(409);
      expect(reactivateRes.body.message).toBe('템플릿이 삭제된 폼은 다시 활성화할 수 없습니다');

      const renameRes = await agent.patch(`/api/admin/forms/${form.body.id}`).send({ name: '변경' });
      expect(renameRes.status).toBe(200);
      expect(renameRes.body.name).toBe('변경');
      expect(renameRes.body.templateDeleted).toBe(true);

      await ctx.ds.query(`UPDATE forms SET is_active = true WHERE id = $1`, [form.body.id]);
      const publicAfterDbHack = await ctx.http().get(`/p/${form.body.slug}`);
      expect(publicAfterDbHack.status).toBe(404);

      const otherTemplateId = await uploadTemplate(agent);
      const replaceRes = await agent
        .patch(`/api/admin/forms/${form.body.id}`)
        .send({ templateId: otherTemplateId, isActive: true });
      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.isActive).toBe(true);
      expect(replaceRes.body.templateId).toBe(otherTemplateId);
      expect(replaceRes.body.templateDeleted).toBe(false);

      const publicAfterReplace = await ctx.http().get(`/p/${form.body.slug}`);
      expect(publicAfterReplace.status).toBe(200);
    });
  });

  describe('캠페인 종료 생애주기(ADR 0019)', () => {
    it('종료(archived) 시 소속 폼이 전부 isActive=false가 되고, 공개 페이지는 404, stats는 유지된다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '종료 캠페인' });
      const templateId = await uploadTemplate(agent);
      const form1 = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼1' });
      const form2 = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼2' });

      const visitRes = await ctx.http().get(`/p/${form1.body.slug}`);
      const visitToken = extractVisitToken(visitRes.text);
      await ctx
        .http()
        .post(`/api/public/forms/${form1.body.slug}/submissions`)
        .send({ visitToken, fields: { name: '홍길동' } });

      const statsBefore = await agent.get(`/api/admin/campaigns/${campaign.body.id}/stats`);
      expect(statsBefore.body.visits).toBe(1);
      expect(statsBefore.body.submissions).toBe(1);

      const patchRes = await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'archived' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('archived');

      const form1After = await agent.get(`/api/admin/forms/${form1.body.id}`);
      const form2After = await agent.get(`/api/admin/forms/${form2.body.id}`);
      expect(form1After.body.isActive).toBe(false);
      expect(form2After.body.isActive).toBe(false);

      const publicRes = await ctx.http().get(`/p/${form1.body.slug}`);
      expect(publicRes.status).toBe(404);

      const statsAfter = await agent.get(`/api/admin/campaigns/${campaign.body.id}/stats`);
      expect(statsAfter.body).toEqual(statsBefore.body);
    });

    it('종료된 캠페인에는 새 폼을 만들 수 없다(409)', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '종료됨' });
      await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'archived' });
      const templateId = await uploadTemplate(agent);

      const res = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '새 폼' });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('종료된 캠페인입니다');
    });

    it('재개(active)해도 폼은 자동으로 켜지지 않는다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '재개 테스트' });
      const templateId = await uploadTemplate(agent);
      const form = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼' });
      await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'archived' });

      const resumeRes = await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'active' });
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.status).toBe('active');

      const formAfter = await agent.get(`/api/admin/forms/${form.body.id}`);
      expect(formAfter.body.isActive).toBe(false);
    });

    it('같은 status로 PATCH하면 변경 없이 200이다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '변화없음' });
      const res = await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  describe('캠페인 삭제(ADR 0019 개정)', () => {
    it('폼·링크만 있고 이벤트가 없으면 204이고 폼·링크·캠페인이 함께 삭제된다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '삭제 대상' });
      const templateId = await uploadTemplate(agent);
      const form = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼' });
      await agent.post(`/api/admin/forms/${form.body.id}/links`).send({ channel: 'instagram' });

      const res = await agent.delete(`/api/admin/campaigns/${campaign.body.id}`);
      expect(res.status).toBe(204);

      const campaignAfter = await agent.get(`/api/admin/campaigns/${campaign.body.id}`);
      expect(campaignAfter.status).toBe(404);
      const formAfter = await agent.get(`/api/admin/forms/${form.body.id}`);
      expect(formAfter.status).toBe(404);
      const linksAfter = await agent.get(`/api/admin/forms/${form.body.id}/links`);
      expect(linksAfter.status).toBe(404);
    });

    it('방문이 1건이라도 있으면 409와 details를 반환하고 아무것도 지우지 않는다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '방문 있는 캠페인' });
      const templateId = await uploadTemplate(agent);
      const form = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼' });
      await ctx.http().get(`/p/${form.body.slug}`);

      const res = await agent.delete(`/api/admin/campaigns/${campaign.body.id}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요');
      expect(res.body.details).toEqual({ forms: 1, visits: 1, submissions: 0 });

      const campaignAfter = await agent.get(`/api/admin/campaigns/${campaign.body.id}`);
      expect(campaignAfter.status).toBe(200);
    });

    it('종료(archived) 상태여도 이벤트가 없으면 삭제할 수 있다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '종료된 빈 캠페인' });
      await agent.patch(`/api/admin/campaigns/${campaign.body.id}`).send({ status: 'archived' });

      const res = await agent.delete(`/api/admin/campaigns/${campaign.body.id}`);
      expect(res.status).toBe(204);
    });

    it('형식은 유효하지만 없는 uuid를 삭제하면 404이다', async () => {
      const res = await agent.delete(`/api/admin/campaigns/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('미인증 상태에서 삭제하면 401이다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '미인증 삭제 테스트' });
      const res = await ctx.http().delete(`/api/admin/campaigns/${campaign.body.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('캠페인 목록의 forms/activeForms 수(ADR 0019 개정)', () => {
    it('GET /api/admin/campaigns 각 행에 전체 폼 수와 활성 폼 수를 포함한다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '폼 수 테스트' });
      const templateId = await uploadTemplate(agent);
      const form1 = await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId, name: '폼1' });
      await agent.post('/api/admin/forms').send({ campaignId: campaign.body.id, templateId, name: '폼2' });
      await agent.patch(`/api/admin/forms/${form1.body.id}`).send({ isActive: false });

      const res = await agent.get('/api/admin/campaigns');
      expect(res.status).toBe(200);
      const row = (res.body as Array<{ id: string; forms: number; activeForms: number }>).find(
        (c) => c.id === campaign.body.id,
      );
      expect(row).toBeDefined();
      expect(row!.forms).toBe(2);
      expect(row!.activeForms).toBe(1);
    });

    it('폼이 없는 캠페인은 forms/activeForms 모두 0이다', async () => {
      const campaign = await agent.post('/api/admin/campaigns').send({ name: '폼 없음' });
      const res = await agent.get('/api/admin/campaigns');
      const row = (res.body as Array<{ id: string; forms: number; activeForms: number }>).find(
        (c) => c.id === campaign.body.id,
      );
      expect(row).toBeDefined();
      expect(row!.forms).toBe(0);
      expect(row!.activeForms).toBe(0);
    });
  });
});
