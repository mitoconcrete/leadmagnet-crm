import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import { createTestApp, truncateAll, seedOperator, loginAgent, PUBLIC_BASE_URL, TestContext } from './utils';

/**
 * ADR 0018: 등록 HTML은 살균하지 않고 격리한다. 이 스펙은 공격 픽스처를 실제로
 * 업로드→캠페인→폼으로 만들어, 공개 페이지·미리보기 응답이 구조적으로 격리를
 * 지키는지(sandbox 속성, CSP, srcdoc 이스케이프, 관리자 API 미노출)만 검증한다.
 * 브라우저에서 실제로 공격이 막히는지는 e2e/isolation.spec.ts(Playwright)가 검증한다.
 */

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const ATTACK_FIXTURES = [
  'attack-cookie-and-admin-api.html',
  'attack-parent-and-navigation.html',
  'attack-native-form.html',
  'attack-srcdoc-escape.html',
  'attack-exfil-beacon.html',
] as const;

interface AttackFlow {
  templateId: string;
  form: { id: string; slug: string };
  html: string;
}

/** 공격 픽스처를 업로드하고 캠페인·폼을 만든다(createFixtureFlow와 달리 임의 파일 경로를 받는다). */
async function createAttackFlow(
  agent: request.SuperAgentTest,
  fixtureFile: string,
  label: string,
): Promise<AttackFlow> {
  const fixturePath = path.join(FIXTURES_DIR, fixtureFile);
  const html = fs.readFileSync(fixturePath, 'utf-8');

  const templateRes = await agent.post('/api/admin/templates').field('name', label).attach('file', fixturePath);
  expect(templateRes.status).toBe(201);
  const templateId = templateRes.body.id as string;

  const campaignRes = await agent.post('/api/admin/campaigns').send({ name: `공격 캠페인 ${label}` });
  expect(campaignRes.status).toBe(201);
  const campaignId = campaignRes.body.id as string;

  const formRes = await agent.post('/api/admin/forms').send({ campaignId, templateId, name: `공격 폼 ${label}` });
  expect(formRes.status).toBe(201);
  const form = { id: formRes.body.id as string, slug: formRes.body.slug as string };

  return { templateId, form, html };
}

/** 래퍼 응답에서 srcdoc="..." 속성 값을 추출한다(wrapper.ts의 고정된 뒤이은 style 속성을 경계로 삼는다). */
function extractSrcdoc(body: string): string {
  const match = /srcdoc="([\s\S]*?)" style="border:0;width:100%;height:100vh"/.exec(body);
  if (!match) throw new Error('srcdoc 속성을 응답 본문에서 찾지 못했다');
  return match[1];
}

function assertWrapperStructure(res: request.Response): string {
  expect(res.status).toBe(200);

  const csp = res.headers['content-security-policy'];
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain(`connect-src ${PUBLIC_BASE_URL}/api/public/`);
  expect(csp).toContain("form-action 'none'");
  expect(csp).toContain("frame-src 'self'");
  expect(res.headers['x-frame-options']).toBeDefined();

  expect(res.text).toContain('sandbox="allow-scripts allow-forms"');
  expect(res.text).not.toContain('allow-same-origin');

  const srcdoc = extractSrcdoc(res.text);
  expect(srcdoc.includes('"')).toBe(false);

  const iframeCloseCount = (res.text.match(/<\/iframe>/g) ?? []).length;
  expect(iframeCloseCount).toBe(1);

  return srcdoc;
}

describe('isolation attacks e2e (ADR 0018 구조 불변식)', () => {
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

  describe.each(ATTACK_FIXTURES)('%s', (fixtureFile) => {
    it('업로드는 살균 없이 201이고 저장 HTML이 원문과 바이트 동일하다', async () => {
      const flow = await createAttackFlow(agent, fixtureFile, fixtureFile);

      const detail = await agent.get(`/api/admin/templates/${flow.templateId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.html).toBe(flow.html);
    });

    it('GET /p/:slug 래퍼가 sandbox·CSP·srcdoc 이스케이프 구조 불변식을 지킨다', async () => {
      const flow = await createAttackFlow(agent, fixtureFile, fixtureFile);

      const res = await ctx.http().get(`/p/${flow.form.slug}`);
      assertWrapperStructure(res);
    });

    it('GET /api/admin/templates/:id/preview 래퍼가 동일한 구조 불변식을 지킨다', async () => {
      const flow = await createAttackFlow(agent, fixtureFile, fixtureFile);

      const res = await agent.get(`/api/admin/templates/${flow.templateId}/preview`);
      assertWrapperStructure(res);
    });
  });

  it("attack-srcdoc-escape의 'pwned' 문자열은 이스케이프된 채로만 srcdoc 안에 존재하고 원문 스크립트 태그가 그대로 새지 않는다", async () => {
    const flow = await createAttackFlow(agent, 'attack-srcdoc-escape.html', 'srcdoc 이스케이프');

    const res = await ctx.http().get(`/p/${flow.form.slug}`);
    assertWrapperStructure(res);

    expect(res.text).not.toContain("<script>window['par'+'ent'].document.body.innerHTML='pwned'</script>");
    expect(res.text).toContain('pwned');
    expect(res.text).toContain('&#39;pwned&#39;');
  });

  it('공격 픽스처 흐름에서도 Origin: null이고 sid 쿠키가 없으면 관리자 API는 401이며 ACAO 헤더가 없다', async () => {
    await createAttackFlow(agent, 'attack-cookie-and-admin-api.html', '무쿠키 확인');

    const res = await ctx.http().get('/api/admin/campaigns').set('Origin', 'null');
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it("attack-cookie-and-admin-api를 등록·공개 페이지로 렌더링해도(HTTP 응답 생성만, 스크립트 미실행) 관리자 API에 부작용을 남기지 않는다 — 'ATTACK-H3-MARKER' 캠페인이 생기지 않는다", async () => {
    const flow = await createAttackFlow(agent, 'attack-cookie-and-admin-api.html', '부작용 없음 확인');

    await ctx.http().get(`/p/${flow.form.slug}`);
    await agent.get(`/api/admin/templates/${flow.templateId}/preview`);

    const [{ count }] = await ctx.ds.query(
      `SELECT count(*)::int AS count FROM campaigns WHERE name = 'ATTACK-H3-MARKER'`,
    );
    expect(count).toBe(0);
  });
});
