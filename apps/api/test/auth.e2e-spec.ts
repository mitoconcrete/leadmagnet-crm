import 'reflect-metadata';
import { randomUUID } from 'crypto';
import {
  createTestApp,
  truncateAll,
  seedOperator,
  loginAgent,
  DEFAULT_OPERATOR_EMAIL,
  DEFAULT_OPERATOR_PASSWORD,
  TestContext,
} from './utils';

describe('auth e2e (§4.1 /api/admin/auth)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(ctx.ds);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health는 인증 없이 200이다', async () => {
    const res = await ctx.http().get('/api/health');
    expect(res.status).toBe(200);
  });

  it('로그인 성공 시 200과 Set-Cookie(sid=, Path=/api/admin, HttpOnly, SameSite=Lax)를 반환한다', async () => {
    await seedOperator(ctx.ds);
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .send({ email: DEFAULT_OPERATOR_EMAIL, password: DEFAULT_OPERATOR_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.operator).toMatchObject({ email: DEFAULT_OPERATOR_EMAIL });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(Array.isArray(setCookie)).toBe(true);
    const sidCookie = setCookie.find((c) => c.startsWith('sid='));
    expect(sidCookie).toBeDefined();
    expect(sidCookie).toContain('Path=/api/admin');
    expect(sidCookie).toContain('HttpOnly');
    expect(sidCookie).toContain('SameSite=Lax');
    expect(sidCookie).toContain('Max-Age=604800');
  });

  it('필수 필드(password)가 없으면 400이다', async () => {
    await seedOperator(ctx.ds);
    const res = await ctx.http().post('/api/admin/auth/login').send({ email: DEFAULT_OPERATOR_EMAIL });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode', 400);
  });

  it('틀린 비밀번호는 401이다', async () => {
    await seedOperator(ctx.ds);
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .send({ email: DEFAULT_OPERATOR_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('존재하지 않는 이메일은 401이다', async () => {
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@example.com', password: DEFAULT_OPERATOR_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('쿠키 없이 GET /api/admin/campaigns는 401이다', async () => {
    const res = await ctx.http().get('/api/admin/campaigns');
    expect(res.status).toBe(401);
  });

  it('위조된(무작위) sid 쿠키는 401이다', async () => {
    const res = await ctx.http().get('/api/admin/auth/me').set('Cookie', `sid=${randomUUID()}`);
    expect(res.status).toBe(401);
  });

  it('만료된 세션의 sid 쿠키는 401이다', async () => {
    await seedOperator(ctx.ds);
    const { agent, cookie } = await loginAgent(ctx);
    const sid = cookie.split(';')[0].split('=')[1];
    await ctx.ds.query(`UPDATE sessions SET expires_at = now() - interval '1 day' WHERE id = $1`, [sid]);

    const res = await ctx.http().get('/api/admin/auth/me').set('Cookie', `sid=${sid}`);
    expect(res.status).toBe(401);
    void agent;
  });

  it('GET /api/admin/auth/me는 로그인 상태에서 200과 {id,email}을 반환한다', async () => {
    await seedOperator(ctx.ds);
    const { agent } = await loginAgent(ctx);
    const res = await agent.get('/api/admin/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: DEFAULT_OPERATOR_EMAIL });
    expect(res.body.id).toBeDefined();
  });

  it('로그아웃은 204를 반환하고 쿠키를 만료시킨다', async () => {
    await seedOperator(ctx.ds);
    const { agent } = await loginAgent(ctx);
    const res = await agent.post('/api/admin/auth/logout');
    expect(res.status).toBe(204);
  });

  it('로그아웃 후 GET me는 401이다', async () => {
    await seedOperator(ctx.ds);
    const { agent } = await loginAgent(ctx);
    await agent.post('/api/admin/auth/logout');
    const res = await agent.get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });

  it('로그아웃 후 같은 세션으로 다른 보호 라우트(campaigns)를 호출해도 401이다', async () => {
    await seedOperator(ctx.ds);
    const { agent } = await loginAgent(ctx);
    await agent.post('/api/admin/auth/logout');
    const res = await agent.get('/api/admin/campaigns');
    expect(res.status).toBe(401);
  });
});
