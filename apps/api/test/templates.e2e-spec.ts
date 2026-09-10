import 'reflect-metadata';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  createFixtureFlow,
  VALID_FORM_FIXTURE_PATH,
  NO_FORM_FIXTURE_PATH,
  WARN_FORM_FIXTURE_PATH,
  BLOCKED_FORM_FIXTURE_PATH,
  TestContext,
} from './utils';

const VISIT_TOKEN_RE = /VISIT_TOKEN=(?:"|&quot;)([0-9a-f-]{36})/;

/** 폼의 공개 페이지를 방문하고 그대로 제출해 visit 1건 + submission 1건을 만든다. */
async function visitAndSubmit(ctx: TestContext, slug: string): Promise<void> {
  const pageRes = await ctx.http().get(`/p/${slug}`);
  const match = VISIT_TOKEN_RE.exec(pageRes.text);
  if (!match) throw new Error('VISIT_TOKEN을 응답 본문에서 찾지 못했다');
  const visitToken = match[1];

  const submitRes = await ctx
    .http()
    .post(`/api/public/forms/${slug}/submissions`)
    .send({ visitToken, fields: { name: '테스트 사용자' } });
  if (submitRes.status !== 201) throw new Error(`제출 실패: ${submitRes.status}`);
}

describe('templates e2e (§4.2 /api/admin/templates)', () => {
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

  it('정상 .html 업로드는 201과 {id,name,originalFilename,sizeBytes}를 반환한다', async () => {
    const res = await agent
      .post('/api/admin/templates')
      .field('name', '테스트 템플릿')
      .attach('file', VALID_FORM_FIXTURE_PATH);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('originalFilename', 'valid-form.html');
    expect(res.body).toHaveProperty('sizeBytes');
    expect(typeof res.body.sizeBytes).toBe('number');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body.warnings).toEqual([]);
  });

  it('.txt 확장자는 400이다', async () => {
    const res = await agent
      .post('/api/admin/templates')
      .attach('file', Buffer.from('<form></form>'), { filename: 'note.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('524288 bytes를 초과하는 파일은 400이다', async () => {
    const oversized = Buffer.alloc(600 * 1024, 'a');
    const res = await agent
      .post('/api/admin/templates')
      .attach('file', oversized, { filename: 'oversized.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
  });

  it('<form이 없는 HTML은 400이다', async () => {
    const res = await agent.post('/api/admin/templates').attach('file', NO_FORM_FIXTURE_PATH);
    expect(res.status).toBe(400);
  });

  it('file 필드 없이 업로드하면 400이다', async () => {
    const res = await agent.post('/api/admin/templates').field('name', '파일 없음');
    expect(res.status).toBe(400);
  });

  it('목록 응답 각 항목에는 html 필드가 없다', async () => {
    await agent.post('/api/admin/templates').field('name', 't1').attach('file', VALID_FORM_FIXTURE_PATH);
    const res = await agent.get('/api/admin/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).not.toHaveProperty('html');
  });

  it('상세 응답에는 html 필드가 있다', async () => {
    const created = await agent
      .post('/api/admin/templates')
      .field('name', 't1')
      .attach('file', VALID_FORM_FIXTURE_PATH);
    const res = await agent.get(`/api/admin/templates/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.html).toEqual(expect.stringContaining('<form'));
  });

  it('존재하지 않는(형식은 유효한) id는 404이다', async () => {
    const res = await agent.get(`/api/admin/templates/${randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('uuid 형식이 아닌 id는 400이다', async () => {
    const res = await agent.get('/api/admin/templates/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('미인증 요청은 401이다', async () => {
    const res = await ctx.http().get('/api/admin/templates');
    expect(res.status).toBe(401);
  });

  describe('POST / html 붙여넣기 등록 (§4.2)', () => {
    it('html·name을 보내면 201, originalFilename은 {name}.html, sizeBytes는 buffer 길이와 일치한다', async () => {
      const html = '<form><input name="email"></form>';
      const res = await agent.post('/api/admin/templates').field('html', html).field('name', '붙여넣기');

      expect(res.status).toBe(201);
      expect(res.body.originalFilename).toBe('붙여넣기.html');
      expect(res.body.sizeBytes).toBe(Buffer.byteLength(html, 'utf-8'));
    });

    it('html만 있고 name이 없으면 400이다', async () => {
      const res = await agent.post('/api/admin/templates').field('html', '<form></form>');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('붙여넣기 등록에는 이름이 필요합니다');
    });

    it('file과 html이 함께 오면 400이다', async () => {
      const res = await agent
        .post('/api/admin/templates')
        .field('html', '<form></form>')
        .field('name', '이름')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('file과 html은 함께 보낼 수 없습니다');
    });

    it('file도 html도 없으면 400이다', async () => {
      const res = await agent.post('/api/admin/templates').field('name', '이름');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('file 또는 html 중 하나가 필요합니다');
    });

    it('<form이 없는 html은 400이다', async () => {
      const res = await agent.post('/api/admin/templates').field('html', '<div>form 없음</div>').field('name', '이름');
      expect(res.status).toBe(400);
    });

    it('600KB html은 400이다', async () => {
      const oversized = `<form>${'a'.repeat(600 * 1024)}</form>`;
      const res = await agent.post('/api/admin/templates').field('html', oversized).field('name', '큰 템플릿');
      expect(res.status).toBe(400);
    });
  });

  describe('POST / 등록 점검 경고 (ADR 0018, 차단하지 않는다)', () => {
    it('name 없는 input과 외부 script가 있는 HTML도 201이고, warnings 배열 전체(순서 포함)를 정확히 담는다', async () => {
      const res = await agent
        .post('/api/admin/templates')
        .field('name', '경고 있는 템플릿')
        .attach('file', WARN_FORM_FIXTURE_PATH);

      expect(res.status).toBe(201);
      expect(res.body.warnings).toEqual([
        'name 속성이 없는 입력 요소가 1개 있습니다. 이 값은 신청 데이터에 저장되지 않습니다',
        '외부 스크립트 1개는 격리 정책(CSP)으로 실행되지 않습니다',
        '개인정보 수집 동의 체크박스(name="consent")가 없습니다',
      ]);
    });

    it('목록·상세 응답에는 warnings가 없다(등록 시점 안내이므로 저장하지 않는다)', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '경고 있는 템플릿')
        .attach('file', WARN_FORM_FIXTURE_PATH);

      const listRes = await agent.get('/api/admin/templates');
      expect(listRes.body[0]).not.toHaveProperty('warnings');

      const detailRes = await agent.get(`/api/admin/templates/${created.body.id}`);
      expect(detailRes.body).not.toHaveProperty('warnings');
    });
  });

  describe('POST / 차단 규칙(ADR 0018 2026-09-10 개정, §4.2 400)', () => {
    it('고신뢰 공격 패턴이 있는 HTML 업로드는 400이고 message 배열에 이유가 2개 이상 담긴다', async () => {
      const res = await agent
        .post('/api/admin/templates')
        .field('name', '차단 규칙 테스트')
        .attach('file', BLOCKED_FORM_FIXTURE_PATH);

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThanOrEqual(2);
      expect(res.body.error).toBe('Bad Request');
    });

    it('붙여넣기로 같은 HTML을 등록해도 400이다', async () => {
      const html = fs.readFileSync(BLOCKED_FORM_FIXTURE_PATH, 'utf-8');
      const res = await agent.post('/api/admin/templates').field('html', html).field('name', '붙여넣기 차단');

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThanOrEqual(2);
    });

    it('차단된 HTML은 저장되지 않는다(목록에 나타나지 않는다)', async () => {
      await agent.post('/api/admin/templates').field('name', '저장 안 됨 확인').attach('file', BLOCKED_FORM_FIXTURE_PATH);

      const listRes = await agent.get('/api/admin/templates');
      expect(listRes.body.find((t: { name: string }) => t.name === '저장 안 됨 확인')).toBeUndefined();
    });

    it('기존 정상 픽스처(valid-form.html)는 그대로 201이다', async () => {
      const res = await agent
        .post('/api/admin/templates')
        .field('name', '정상 픽스처 유지 확인')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(res.status).toBe(201);
    });
  });

  describe('POST / 이름 고유(ADR 0014, §4.2 409)', () => {
    it('같은 이름으로 두 번 업로드하면 두 번째는 409 "같은 이름의 템플릿이 있습니다"다', async () => {
      const first = await agent
        .post('/api/admin/templates')
        .field('name', '고유 이름 테스트')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(first.status).toBe(201);

      const second = await agent
        .post('/api/admin/templates')
        .field('name', '고유 이름 테스트')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(second.status).toBe(409);
      expect(second.body.message).toBe('같은 이름의 템플릿이 있습니다');
      expect(second.body.error).toBe('Conflict');
    });

    it('붙여넣기로 같은 이름을 두 번 등록하면 두 번째는 409다', async () => {
      const html = '<form><input name="email"></form>';
      const first = await agent.post('/api/admin/templates').field('html', html).field('name', '붙여넣기 고유 이름');
      expect(first.status).toBe(201);

      const second = await agent.post('/api/admin/templates').field('html', html).field('name', '붙여넣기 고유 이름');
      expect(second.status).toBe(409);
      expect(second.body.message).toBe('같은 이름의 템플릿이 있습니다');
    });

    it('업로드와 붙여넣기가 같은 이름이어도 409다(등록 방식과 무관하게 이름은 하나만 살아 있는다)', async () => {
      const first = await agent
        .post('/api/admin/templates')
        .field('name', '방식 무관 중복')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(first.status).toBe(201);

      const second = await agent
        .post('/api/admin/templates')
        .field('html', '<form></form>')
        .field('name', '방식 무관 중복');
      expect(second.status).toBe(409);
    });

    it('name 미지정 업로드는 파일명 기반 기본 이름도 중복 규칙을 적용한다', async () => {
      const first = await agent.post('/api/admin/templates').attach('file', VALID_FORM_FIXTURE_PATH);
      expect(first.status).toBe(201);
      expect(first.body.name).toBe('valid-form');

      const second = await agent.post('/api/admin/templates').attach('file', VALID_FORM_FIXTURE_PATH);
      expect(second.status).toBe(409);
      expect(second.body.message).toBe('같은 이름의 템플릿이 있습니다');
    });

    it('강제 삭제(소프트 삭제)된 템플릿과 같은 이름은 다시 등록할 수 있다(201)', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '재사용 이름 테스트')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(created.status).toBe(201);

      const campaign = await agent.post('/api/admin/campaigns').send({ name: '이름 재사용 캠페인' });
      await agent
        .post('/api/admin/forms')
        .send({ campaignId: campaign.body.id, templateId: created.body.id, name: '이름 재사용 폼' });

      const deleteRes = await agent.delete(`/api/admin/templates/${created.body.id}?force=true`);
      expect(deleteRes.status).toBe(204);

      const recreated = await agent
        .post('/api/admin/templates')
        .field('name', '재사용 이름 테스트')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(recreated.status).toBe(201);
      expect(recreated.body.name).toBe('재사용 이름 테스트');
    });

    it('하드 삭제(참조 폼 없음)된 템플릿과 같은 이름도 다시 등록할 수 있다(201)', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '하드삭제 재사용 이름')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(created.status).toBe(201);

      const deleteRes = await agent.delete(`/api/admin/templates/${created.body.id}`);
      expect(deleteRes.status).toBe(204);

      const recreated = await agent
        .post('/api/admin/templates')
        .field('name', '하드삭제 재사용 이름')
        .attach('file', VALID_FORM_FIXTURE_PATH);
      expect(recreated.status).toBe(201);
    });
  });

  describe('DELETE /:id (ADR 0014 삭제 규칙)', () => {
    it('참조하는 폼이 없으면 204이고, 이후 GET은 404다', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '미참조 템플릿')
        .attach('file', VALID_FORM_FIXTURE_PATH);

      const res = await agent.delete(`/api/admin/templates/${created.body.id}`);
      expect(res.status).toBe(204);

      const getRes = await agent.get(`/api/admin/templates/${created.body.id}`);
      expect(getRes.status).toBe(404);
    });

    it('참조하는 폼이 있으면 409이고 details에 폼 1개·방문 1건·신청 1건을 담는다', async () => {
      const flow = await createFixtureFlow(agent);
      await visitAndSubmit(ctx, flow.form.slug);

      const res = await agent.delete(`/api/admin/templates/${flow.templateId}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toBe('사용 중인 템플릿입니다(폼 1개, 방문 1건, 신청 1건)');
      expect(res.body.details).toEqual({ forms: 1, visits: 1, submissions: 1 });
    });

    it('force=true면 204이고, 목록 제외·GET 404·폼 비활성화·공개 페이지 404·캠페인 stats는 그대로 유지된다', async () => {
      const flow = await createFixtureFlow(agent);
      await visitAndSubmit(ctx, flow.form.slug);

      const statsBefore = await agent.get(`/api/admin/campaigns/${flow.campaignId}/stats`);
      expect(statsBefore.status).toBe(200);

      const res = await agent.delete(`/api/admin/templates/${flow.templateId}?force=true`);
      expect(res.status).toBe(204);

      const listRes = await agent.get('/api/admin/templates');
      expect(listRes.body.find((t: { id: string }) => t.id === flow.templateId)).toBeUndefined();

      const getRes = await agent.get(`/api/admin/templates/${flow.templateId}`);
      expect(getRes.status).toBe(404);

      const formRes = await agent.get(`/api/admin/forms/${flow.form.id}`);
      expect(formRes.body.isActive).toBe(false);

      const publicRes = await ctx.http().get(`/p/${flow.form.slug}`);
      expect(publicRes.status).toBe(404);

      const statsAfter = await agent.get(`/api/admin/campaigns/${flow.campaignId}/stats`);
      expect(statsAfter.body).toEqual(statsBefore.body);
    });

    it('없는(형식은 유효한) uuid는 404다', async () => {
      const res = await agent.delete(`/api/admin/templates/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('미인증 요청은 401이다', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '미인증 삭제 템플릿')
        .attach('file', VALID_FORM_FIXTURE_PATH);

      const res = await ctx.http().delete(`/api/admin/templates/${created.body.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /:id/preview (§4.2 미리보기)', () => {
    it('200 text/html, CSP·X-Frame-Options 헤더, sandbox 본문을 반환하고 방문·쿠키를 남기지 않는다', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '미리보기 템플릿')
        .attach('file', VALID_FORM_FIXTURE_PATH);

      const res = await agent.get(`/api/admin/templates/${created.body.id}/preview`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('sandbox="allow-scripts allow-forms"');
      expect(res.text).not.toContain('allow-same-origin');
      expect(res.text).not.toContain('VISIT_TOKEN');
      expect(res.headers['set-cookie']).toBeUndefined();

      const [{ count }] = await ctx.ds.query(`SELECT count(*) FROM visits`);
      expect(Number(count)).toBe(0);
    });

    it('미인증 요청은 401이다', async () => {
      const created = await agent
        .post('/api/admin/templates')
        .field('name', '미리보기 템플릿')
        .attach('file', VALID_FORM_FIXTURE_PATH);

      const res = await ctx.http().get(`/api/admin/templates/${created.body.id}/preview`);
      expect(res.status).toBe(401);
    });

    it('존재하지 않는(형식은 유효한) id는 404이다', async () => {
      const res = await agent.get(`/api/admin/templates/${randomUUID()}/preview`);
      expect(res.status).toBe(404);
    });

    it('uuid 형식이 아닌 id는 400이다', async () => {
      const res = await agent.get('/api/admin/templates/not-a-uuid/preview');
      expect(res.status).toBe(400);
    });
  });
});
