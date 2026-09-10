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

/**
 * 지정한 role=region 목록 영역의 tbody 행 수가 최소 minRows에 도달할 때까지 기다린다.
 * 데이터(캠페인·템플릿·신청)가 화면에 실제로 렌더된 뒤에 스크롤 측정을 하도록 해
 * "렌더 전에 측정하는" 타이밍 경쟁(flaky)을 없앤다. 목록은 시드가 누적되므로 정확히
 * n건이 아니라 최소 n건 이상임을 확인한다.
 */
async function waitForMinRows(page: Page, regionName: string, minRows: number, timeoutMs = 20_000): Promise<void> {
  const rows = page.getByRole('region', { name: regionName }).locator('tbody').getByRole('row');
  await expect.poll(() => rows.count(), { timeout: timeoutMs }).toBeGreaterThanOrEqual(minRows);
}

/** 페이지가 바깥 문서를 스크롤하지 않는지(오차 1px), 목록 섹션에 내부 스크롤이 생겼는지 확인한다. */
async function expectNoOuterScrollButInnerScroll(page: Page): Promise<void> {
  // CI에서는 문서 높이 계산도 렌더 직후에는 아직 안정화되지 않을 수 있어 poll로 감싼다.
  await expect
    .poll(
      async () => {
        const { docHeight, innerHeight } = await page.evaluate(() => ({
          docHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }));
        return docHeight <= innerHeight + 1;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  // 데이터 렌더 이후 레이아웃이 안정화될 때까지 기다린 뒤 내부 스크롤 여부를 확인한다(flaky 방지).
  // CI에서는 시딩된 신청 목록 렌더가 로컬보다 늦어 넘칠 때까지 더 오래 걸릴 수 있어 타임아웃을 늘렸다.
  await expect
    .poll(
      async () => {
        const regions = page.getByRole('region');
        const regionCount = await regions.count();
        for (let i = 0; i < regionCount; i += 1) {
          const overflowing = await regions.nth(i).evaluate((el) => el.scrollHeight > el.clientHeight);
          if (overflowing) return true;
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
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
    // 이번 실행에서 캠페인 30개를 만들었고, 목록은 전체 캠페인을 누적해서 보여준다.
    await waitForMinRows(page, '캠페인 성과 목록', 30);

    await expectNoOuterScrollButInnerScroll(page);
  });

  test('템플릿(/templates)은 바깥 스크롤 없이 템플릿 목록이 자체 스크롤된다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/templates`);
    await page.getByRole('heading', { name: '템플릿 목록' }).waitFor();
    // 이번 실행에서 템플릿 21개(폼용 1개 + 붙여넣기 20개)를 만들었고, 목록은 누적된다.
    await waitForMinRows(page, '템플릿 목록', 21);

    await expectNoOuterScrollButInnerScroll(page);
  });

  test('등록 모달의 붙여넣기 textarea는 AI 안내가 기본 접힘인 상태에서 뷰포트 높이만큼 크게 렌더된다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/templates`);
    await page.getByRole('button', { name: '새 템플릿 등록' }).click();

    // AI 안내(AiPromptBox)는 기본 접힘이라 트리거 한 줄만 보이고, 펼친 내용(프롬프트 복사 버튼)은 없다.
    await expect(page.getByRole('button', { name: /AI 프롬프트/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '프롬프트 복사' })).toBeHidden();

    await page.getByRole('tab', { name: 'HTML 붙여넣기' }).click();

    const textarea = page.locator('#template-paste-html');
    await textarea.waitFor();
    const clientHeight = await textarea.evaluate((el) => el.clientHeight);
    expect(clientHeight).toBeGreaterThanOrEqual(500);
  });

  test('등록 모달의 AI 안내 트리거를 클릭하면 떠 있는 패널이 열려 프롬프트와 복사 버튼이 보인다', async ({ page }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/templates`);
    await page.getByRole('button', { name: '새 템플릿 등록' }).click();

    await page.getByRole('button', { name: /AI 프롬프트/ }).click();

    await expect(page.getByText('AI로 만들기', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '프롬프트 복사' })).toBeVisible();
  });

  test('AI 안내 Popover를 열어도 떠서 겹칠 뿐 아래 붙여넣기 textarea의 크기·위치는 그대로다(폼을 밀지 않는다)', async ({
    page,
  }) => {
    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/templates`);
    await page.getByRole('button', { name: '새 템플릿 등록' }).click();
    await page.getByRole('tab', { name: 'HTML 붙여넣기' }).click();

    const textarea = page.locator('#template-paste-html');
    await textarea.waitFor();
    const boxBefore = await textarea.boundingBox();
    const heightBefore = await textarea.evaluate((el) => el.clientHeight);

    await page.getByRole('button', { name: /AI 프롬프트/ }).click();
    await expect(page.getByRole('button', { name: '프롬프트 복사' })).toBeVisible();
    // CI의 서브픽셀 반올림·스크롤바 리플로우가 안정화될 시간을 준다(로컬은 즉시 안정적이라 필요 없었다).
    await page.waitForTimeout(150);

    const boxAfter = await textarea.boundingBox();
    const heightAfter = await textarea.evaluate((el) => el.clientHeight);

    // 정확히 같은 값이 아니라 1px 오차까지 허용한다(CI 서브픽셀·스크롤바 리플로우 대응).
    expect(heightAfter).toBeGreaterThanOrEqual(heightBefore - 1);
    expect(heightAfter).toBeLessThanOrEqual(heightBefore + 1);
    expect(Math.abs((boxAfter?.x ?? 0) - (boxBefore?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((boxAfter?.y ?? 0) - (boxBefore?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((boxAfter?.width ?? 0) - (boxBefore?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((boxAfter?.height ?? 0) - (boxBefore?.height ?? 0))).toBeLessThanOrEqual(1);
  });

  test('캠페인 상세(/campaigns/:id)는 바깥 스크롤 없이 폼 목록·신청 명단이 자체 스크롤된다', async ({ page }) => {
    // beforeAll의 시딩 타임아웃(240s)과는 별개로, 이 테스트 자체도 CI에서 poll(각 15s)
    // 여유를 두려면 기본 60s로는 빠듯할 수 있어 명시적으로 늘린다.
    test.setTimeout(90_000);

    await page.request.post(`${WEB_BASE_URL}/api/admin/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    await page.goto(`${WEB_BASE_URL}/campaigns/${seed.campaignId}`);
    await page.getByRole('heading', { name: '성과' }).waitFor();
    // 신청 25건을 제출했고 명단은 page=1&limit=20이라 첫 페이지가 20행으로 꽉 찬다.
    await waitForMinRows(page, '신청 명단', 20);

    await expectNoOuterScrollButInnerScroll(page);
  });
});

/**
 * 전역 폰트 실측. globals.css의 --font-sans가 자기 참조(var(--font-sans))라 값이
 * 비어 CSS가 font-sans 유틸을 브라우저 기본값으로 떨어뜨리는 버그를 잡는다. 클래스
 * 이름만으로는 실제 적용 여부를 알 수 없으므로 getComputedStyle로 실측한다.
 * 로그인 없이 접근 가능한 /login에서 확인해 seedAdminData(무거운 훅)에 의존하지 않는다.
 */
test('전역 폰트: body와 한글 텍스트 요소의 font-family가 Geist/Noto 웹폰트를 포함한다(브라우저 기본 sans-serif로 떨어지지 않는다)', async ({
  page,
}) => {
  await page.goto(`${WEB_BASE_URL}/login`);

  const bodyFontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFontFamily).toMatch(/Geist|Noto/i);

  const heading = page.getByText('관리자 로그인', { exact: true });
  await heading.waitFor();
  const headingFontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(headingFontFamily).toMatch(/Geist|Noto/i);
});
