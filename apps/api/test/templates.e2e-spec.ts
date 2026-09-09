import 'reflect-metadata';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  VALID_FORM_FIXTURE_PATH,
  NO_FORM_FIXTURE_PATH,
  TestContext,
} from './utils';

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
});
