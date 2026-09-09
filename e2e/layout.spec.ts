import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';

/**
 * ADR 0021 실측: 1440×900에서 대시보드·캠페인 상세·템플릿 페이지가 바깥 문서를
 * 스크롤하지 않고(document.documentElement.scrollHeight <= window.innerHeight, 오차 1px),
 * 목록 섹션([role=region])은 내용이 넘쳐 자체 스크롤이 생겼는지(scrollHeight > clientHeight)를 확인한다.
 *
 * 이 스펙은 apps/api·apps/web이 함께 떠 있는 compose 스택을 전제로 한다(ADR 0018과 동일한 조건).
 * track/h5 브랜치 코드만으로는 스택이 없으므로 통합 단계에서 실행한다.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin1234';

const SEED_HTML = '<!doctype html><html><body><form>' +
  '<input name="email" type="email">' +
  '<button type="submit">제출</button>' +
  '</form></body></html>';

interface SeedResult {
  campaignId: string;
  formSlugs: string[];
}

/**
 * 관리자로 로그인한 API 컨텍스트로 캠페인 30개, 폼 10개(+링크), 템플릿 21개(폼용 1개 +
 * 붙여넣기 20개)를 만든다. 서로 의존하지 않는 호출(캠페인 30개, 템플릿 21개, 폼+링크 10쌍)은
 * Promise.all로 병렬화해 순차 실행 대비 시딩 시간을 크게 줄인다.
 */
async function seedAdminData(api: APIRequestContext): Promise<SeedResult> {
  const loginRes = await api.post('/api/admin/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginRes.ok(), '관리자 로그인 실패').toBeTruthy();

  const CAMPAIGN_COUNT = 30;
  const campaignResults = await Promise.all(
    Array.from({ length: CAMPAIGN_COUNT }, (_, i) =>
      api.post('/api/admin/campaigns', { data: { name: `레이아웃 실측 캠페인 ${i + 1}` } }),
    ),
  );
  for (const res of campaignResults) expect(res.ok()).toBeTruthy();
  const campaigns = (await Promise.all(campaignResults.map((res) => res.json()))) as { id: string }[];
  const campaignId = campaigns[0].id;

  const PASTE_TEMPLATE_COUNT = 20;
  const [formTemplateRes, ...pasteTemplateResults] = await Promise.all([
    api.post('/api/admin/templates', { multipart: { html: SEED_HTML, name: '레이아웃 실측 폼 템플릿' } }),
    ...Array.from({ length: PASTE_TEMPLATE_COUNT }, (_, i) =>
      api.post('/api/admin/templates', {
        multipart: { html: SEED_HTML, name: `레이아웃 실측 템플릿 ${i + 1}` },
      }),
    ),
  ]);
  expect(formTemplateRes.ok()).toBeTruthy();
  for (const res of pasteTemplateResults) expect(res.ok()).toBeTruthy();
  const formTemplate = (await formTemplateRes.json()) as { id: string };

  const FORM_COUNT = 10;
  const formSlugs = await Promise.all(
    Array.from({ length: FORM_COUNT }, async (_, i) => {
      const formRes = await api.post('/api/admin/forms', {
        data: { campaignId, templateId: formTemplate.id, name: `레이아웃 실측 폼 ${i + 1}` },
      });
      expect(formRes.ok()).toBeTruthy();
      const form = (await formRes.json()) as { id: string; slug: string };

      const linkRes = await api.post(`/api/admin/forms/${form.id}/links`, { data: { channel: 'instagram' } });
      expect(linkRes.ok()).toBeTruthy();

      return form.slug;
    }),
  );

  return { campaignId, formSlugs };
}

/**
 * 공개 페이지를 방문해 iframe(srcdoc) 안 폼을 실제로 제출한다(주입 스크립트 경로 그대로).
 * 방문마다 새 visit이 생기고, 제출 성공 시 신청(submission) 1건이 쌓인다.
 */
async function visitAndSubmit(page: Page, slug: string, index: number): Promise<void> {
  await page.goto(`${API_BASE_URL}/p/${slug}`);
  const frame = page.frameLocator('iframe');
  await frame.locator('input[name="email"]').fill(`visitor+${index}@example.com`);
  await frame.locator('button[type="submit"]').click();
  await frame.locator('[data-lead-success]').waitFor({ timeout: 10_000 });
}

/** 페이지가 바깥 문서를 스크롤하지 않는지(오차 1px), 목록 섹션에 내부 스크롤이 생겼는지 확인한다. */
async function expectNoOuterScrollButInnerScroll(page: Page): Promise<void> {
  const { docHeight, innerHeight } = await page.evaluate(() => ({
    docHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(docHeight).toBeLessThanOrEqual(innerHeight + 1);

  const regions = page.getByRole('region');
  const regionCount = await regions.count();
  expect(regionCount).toBeGreaterThan(0);

  let hasOverflowingRegion = false;
  for (let i = 0; i < regionCount; i += 1) {
    const region = regions.nth(i);
    const overflowing = await region.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (overflowing) hasOverflowingRegion = true;
  }
  expect(hasOverflowingRegion, '내용이 넘쳐 내부 스크롤이 생긴 [role=region] 섹션이 하나도 없습니다').toBe(true);
}

test.describe('데스크톱 우선 레이아웃(ADR 0021) — 1440×900 무스크롤 실측', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  let seed: SeedResult;

  test.beforeAll(async ({ browser }) => {
    // 캠페인 30개(병렬)·템플릿 21개(병렬)·폼 10개+링크 10개(병렬 쌍) API 호출과 브라우저
    // 제출 25회를 한 훅에서 처리해 기본 60초를 넘길 수 있다. 넉넉히 240초로 늘린다.
    test.setTimeout(240_000);

    const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    seed = await seedAdminData(api);

    // 신청 명단이 목록 안에서 스크롤될 만큼 쌓이도록 공개 페이지를 방문·제출한다.
    // GET /api/admin/submissions는 기본 limit=20(페이지당 20건)이므로 25건이면 첫 페이지
    // 20행이 꽉 차 목록 영역이 넘치기(overflow)에 충분하다(스펙: 60건 목표, 시간이 길면 30건 허용).
    const context = await browser.newContext();
    const page = await context.newPage();
    const SUBMISSION_COUNT = 25;
    for (let i = 0; i < SUBMISSION_COUNT; i += 1) {
      const slug = seed.formSlugs[i % seed.formSlugs.length];
      await visitAndSubmit(page, slug, i);
    }
    await context.close();
    await api.dispose();
  });

  test('대시보드(/)는 바깥 스크롤 없이 캠페인·채널 성과 목록이 자체 스크롤된다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/`);
    await page.getByRole('heading', { name: '캠페인 성과' }).waitFor();

    await expectNoOuterScrollButInnerScroll(page);
  });

  test('템플릿(/templates)은 바깥 스크롤 없이 템플릿 목록이 자체 스크롤된다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/templates`);
    await page.getByRole('heading', { name: '템플릿 목록' }).waitFor();

    await expectNoOuterScrollButInnerScroll(page);
  });

  test('캠페인 상세(/campaigns/:id)는 바깥 스크롤 없이 폼 목록·신청 명단이 자체 스크롤된다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/campaigns/${seed.campaignId}`);
    await page.getByRole('heading', { name: '성과' }).waitFor();

    await expectNoOuterScrollButInnerScroll(page);
  });
});
