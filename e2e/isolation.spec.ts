import * as fs from 'fs';
import * as path from 'path';
import { test, expect, type BrowserContext, type Page, type Frame } from '@playwright/test';

/**
 * ADR 0018 브라우저 격리 검증. 실행 중인 compose 스택(web http://localhost:3000,
 * api http://localhost:3001)을 전제로 한다. 서버 e2e(apps/api/test/isolation-attacks.e2e-spec.ts)가
 * 확인한 헤더·속성 문자열이 실제 브라우저에서도 공격을 막는지를 확인한다.
 */

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin1234';

const FIXTURES_DIR = path.join(__dirname, '..', 'apps', 'api', 'test', 'fixtures');

const FIXTURE_FILES = {
  cookieAndAdminApi: 'attack-cookie-and-admin-api.html',
  parentAndNavigation: 'attack-parent-and-navigation.html',
  nativeForm: 'attack-native-form.html',
  srcdocEscape: 'attack-srcdoc-escape.html',
  exfilBeacon: 'attack-exfil-beacon.html',
} as const;

interface AttackFlow {
  templateId: string;
  templateName: string;
  slug: string;
  code: string;
}

let context: BrowserContext;
const flows: Partial<Record<keyof typeof FIXTURE_FILES, AttackFlow>> = {};

/** 반복 로컬 실행 시 /templates 목록에 동명 행이 누적되지 않도록 실행마다 고유한 접미사를 붙인다. */
const RUN_ID = Date.now().toString(36);

/** page.frames()에서 등록 HTML이 렌더된 srcdoc iframe을 찾는다(관리자 미리보기처럼 중첩돼 있어도 평탄화된 목록에서 찾는다). */
async function findAttackFrame(page: Page): Promise<Frame> {
  await expect
    .poll(() => page.frames().some((f) => f.url() === 'about:srcdoc'), { timeout: 15_000 })
    .toBe(true);
  const frame = page.frames().find((f) => f.url() === 'about:srcdoc');
  if (!frame) throw new Error('srcdoc 프레임을 찾지 못했다');
  return frame;
}

/** srcdoc iframe 안 #attack-result가 채워질 때까지 기다린 뒤 JSON으로 파싱한다. */
async function readAttackResult(page: Page): Promise<Record<string, unknown>> {
  const frame = await findAttackFrame(page);
  await frame.waitForSelector('#attack-result');
  await expect
    .poll(async () => (await frame.locator('#attack-result').textContent())?.trim(), { timeout: 15_000 })
    .not.toBe('대기 중');
  const text = await frame.locator('#attack-result').textContent();
  return JSON.parse(text ?? '{}');
}

interface ObservedAdminRequest {
  url: string;
  cookie: string;
}

/**
 * 관리자 리뷰 지적 대응: CORS로 응답을 못 읽는 것(TypeError)과 CSP·쿠키 Path로 격리되는 것은
 * 다른 사건이다. `/api/admin/**`로 나가는 실제 네트워크 요청을 가로채 쿠키 헤더를 직접
 * 확인하고, 응답 상태도 별도로 수집한다. 제외 대상: (1) `/preview` 자체(관리자가 iframe을
 * 열기 위한 최초 내비게이션), (2) page의 메인 프레임이 보내는 요청(예: /templates 자체의
 * AuthGate `/auth/me`, 템플릿 목록 조회 — 공격 iframe이 아니라 정상 관리자 화면이 보낸
 * 합법적 요청이다). 공격 iframe(및 그 안에 중첩된 미리보기 iframe)에서 나간 요청만 남긴다.
 * 반드시 `page.goto()` 이전에 등록해야 한다.
 */
function observeAdminApiRequests(page: Page): {
  requests: ObservedAdminRequest[];
  responseStatuses: number[];
} {
  const requests: ObservedAdminRequest[] = [];
  const responseStatuses: number[] = [];

  void page.route('**/api/admin/**', async (route) => {
    const req = route.request();
    const fromAttackFrame = req.frame() !== page.mainFrame();
    if (fromAttackFrame && !req.url().includes('/preview')) {
      const headers = await req.allHeaders();
      requests.push({ url: req.url(), cookie: headers['cookie'] ?? '' });
    }
    await route.continue();
  });

  page.on('response', (res) => {
    const fromAttackFrame = res.request().frame() !== page.mainFrame();
    if (fromAttackFrame && res.url().includes('/api/admin/') && !res.url().includes('/preview')) {
      responseStatuses.push(res.status());
    }
  });

  return { requests, responseStatuses };
}

/** 기록된 요청이 0건(CSP가 막음)이거나, 있다면 전부 sid 쿠키 없이 나갔고 401이어야 한다. */
function assertNoAuthenticatedAdminRequest(observed: {
  requests: ObservedAdminRequest[];
  responseStatuses: number[];
}): void {
  if (observed.requests.length === 0) {
    return;
  }
  for (const req of observed.requests) {
    expect(req.cookie).not.toContain('sid=');
  }
  for (const status of observed.responseStatuses) {
    expect(status).toBe(401);
  }
}

const MARKER_CAMPAIGN_NAME = 'ATTACK-H3-MARKER';

/** 로그인된 context.request(쿠키 공유)로 마커 캠페인 개수를 센다 — CORS로 가려지지 않는 서버 측 진실. */
async function countMarkerCampaigns(): Promise<number> {
  const res = await context.request.get(`${PUBLIC_BASE_URL}/api/admin/campaigns`);
  if (!res.ok()) throw new Error(`캠페인 목록 조회 실패: ${res.status()}`);
  const campaigns = (await res.json()) as Array<{ name: string }>;
  return campaigns.filter((c) => c.name === MARKER_CAMPAIGN_NAME).length;
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ baseURL: WEB_BASE_URL });
  const loginPage = await context.newPage();
  await loginPage.goto('/login');
  await loginPage.getByLabel('이메일').fill(ADMIN_EMAIL);
  await loginPage.getByLabel('비밀번호').fill(ADMIN_PASSWORD);
  await loginPage.getByRole('button', { name: '로그인' }).click();
  await loginPage.waitForURL((url) => !url.pathname.startsWith('/login'));
  await loginPage.close();

  for (const [key, fixtureFile] of Object.entries(FIXTURE_FILES) as [keyof typeof FIXTURE_FILES, string][]) {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, fixtureFile));
    const templateName = `${fixtureFile}-${RUN_ID}`;

    const templateRes = await context.request.post('/api/admin/templates', {
      multipart: { name: templateName, file: { name: fixtureFile, mimeType: 'text/html', buffer } },
    });
    if (!templateRes.ok()) throw new Error(`템플릿 업로드 실패(${fixtureFile}): ${templateRes.status()}`);
    const template = await templateRes.json();

    const campaignRes = await context.request.post('/api/admin/campaigns', {
      data: { name: `h3 격리 캠페인 ${templateName}` },
    });
    const campaign = await campaignRes.json();

    const formRes = await context.request.post('/api/admin/forms', {
      data: { campaignId: campaign.id, templateId: template.id, name: `h3 격리 폼 ${templateName}` },
    });
    const form = await formRes.json();

    const linkRes = await context.request.post(`/api/admin/forms/${form.id}/links`, {
      data: { channel: 'instagram' },
    });
    const link = await linkRes.json();

    flows[key] = {
      templateId: template.id as string,
      templateName,
      slug: form.slug as string,
      code: link.code as string,
    };
  }
});

test.afterAll(async () => {
  await context.close();
});

/** 브라우저(Chromium)는 URL 경로의 비-ASCII 문자를 퍼센트 인코딩해 보고하므로, page.url()과
 * 비교할 때도 WHATWG URL로 정규화한 문자열을 써서 인코딩 표현 차이로 인한 오검출을 막는다. */
function publicUrl(flow: AttackFlow): string {
  return new URL(`${PUBLIC_BASE_URL}/p/${flow.slug}?src=${flow.code}`).toString();
}

test('공개 페이지: 등록 HTML은 관리자 쿠키를 읽지 못하고 관리자 API에 인증된 요청/부작용을 남기지 못한다', async () => {
  const flow = flows.cookieAndAdminApi!;
  const page = await context.newPage();
  const observed = observeAdminApiRequests(page);

  const markerCountBefore = await countMarkerCampaigns();

  await page.goto(publicUrl(flow));
  const result = await readAttackResult(page);

  // Chromium: opaque origin sandbox에서 document.cookie 접근 자체가 SecurityError를 던진다
  // (getter가 빈 문자열을 반환하는 게 아니다). 다른 값이 나오면 sandbox가 약화된 것이다.
  const cookieEntry = result.cookie as { threw: boolean; value?: string; error?: string };
  expect(cookieEntry.threw).toBe(true);
  expect(cookieEntry.error).toBe('SecurityError');

  // "응답을 못 읽는다(TypeError)"는 CORS로도 설명되므로 증거가 되지 않는다. 실제 네트워크
  // 요청이 쿠키 없이 나갔거나(또는 아예 안 나갔거나) 401이었는지를 직접 확인한다.
  assertNoAuthenticatedAdminRequest(observed);

  // CORS로 응답을 못 읽어도 요청이 서버에 도달해 상태를 바꿨을 수 있다 — 이건 가려지지 않는다.
  const markerCountAfter = await countMarkerCampaigns();
  expect(markerCountBefore).toBe(0);
  expect(markerCountAfter).toBe(0);

  await page.close();
});

test('공개 페이지: 부모 창 접근·최상위 내비게이션·팝업·로컬스토리지가 모두 막힌다', async () => {
  const flow = flows.parentAndNavigation!;
  const url = publicUrl(flow);
  const page = await context.newPage();
  await page.goto(url);

  const result = await readAttackResult(page);

  expect((result.parentTitle as { error?: string }).error).toBe('SecurityError');
  expect((result.localStorage as { error?: string }).error).toBe('SecurityError');
  expect((result.windowOpen as { result?: string }).result).toBe('null');

  // top.location 대입은 예외 없이 조용히 막힐 수 있다 — 실제 내비게이션이 일어나지 않았음을 URL로 확인한다.
  expect(page.url()).toBe(url);

  // <a target="_top"> 클릭도 sandbox(allow-top-navigation-by-user-activation 없음)에서
  // 막혀야 한다 — evil.example로 실제 이동이 일어나지 않았음을 URL로 확인한다.
  const frame = await findAttackFrame(page);
  await frame.locator('#top-nav-link').click();
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);

  await page.close();
});

test('공개 페이지: 네이티브 폼 전송과 메타 리프레시가 evil.example로 나가지 않는다', async () => {
  // 이 픽스처는 CSP form-action 'none'/frame-src 'self' 위반으로 iframe 자체가
  // 내비게이션 차단(에러 문서로 대체)될 수 있으므로 내부 #attack-result가 아니라
  // 페이지 수준 네트워크 관찰과 URL 불변으로만 판단한다.
  const flow = flows.nativeForm!;
  const url = publicUrl(flow);
  const page = await context.newPage();

  const evilRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('evil.example')) evilRequests.push(req.url());
  });
  await page.route('**/evil.example/**', (route) => route.abort());

  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto(url);
  // 네이티브 폼 전송(form.submit())과 메타 리프레시가 처리될 시간을 준다.
  await page.waitForTimeout(2000);

  expect(evilRequests).toHaveLength(0);
  expect(page.url()).toBe(url);
  expect(cspViolations.length).toBeGreaterThan(0);

  await page.close();
});

test('공개 페이지: srcdoc 탈출 시도 문자열이 래퍼 문서로 새지 않는다', async () => {
  const flow = flows.srcdocEscape!;
  const page = await context.newPage();
  await page.goto(publicUrl(flow));

  await readAttackResult(page);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('pwned');

  const iframeCount = await page.locator('iframe').count();
  expect(iframeCount).toBe(1);

  await page.close();
});

test('공개 페이지: 이미지 비콘 유출은 실제로 시도된다(ADR 0003 잔여 위험, 네트워크는 abort로 차단)', async () => {
  const flow = flows.exfilBeacon!;
  const page = await context.newPage();

  let sawEvilImageRequest = false;
  page.on('request', (req) => {
    if (req.url().includes('evil.example')) sawEvilImageRequest = true;
  });
  await page.route('**/evil.example/**', (route) => route.abort());

  await page.goto(publicUrl(flow));
  const result = await readAttackResult(page);
  expect(result.beaconAttempted).toBe(true);

  await expect.poll(() => sawEvilImageRequest, { timeout: 10_000 }).toBe(true);

  test.info().annotations.push({
    type: 'known-risk',
    description:
      'ADR 0003 잔여 위험: document.cookie는 sandbox에서 접근이 막히지만, img-src *로 인해 ' +
      '등록 HTML은 방문자가 입력한 폼 값을 외부 이미지 비콘으로 유출할 수 있다. ' +
      '이 위협 모델에서 운영자는 신뢰 주체이며, 이 테스트는 해당 경로가 여전히 열려 있음을 문서화한다.',
  });

  await page.close();
});

test('관리자 화면 미리보기 Dialog 안(오리진 3000)에서도 쿠키·관리자 API 접근이 동일하게 차단된다', async () => {
  const flow = flows.cookieAndAdminApi!;
  const page = await context.newPage();
  const observed = observeAdminApiRequests(page);

  const markerCountBefore = await countMarkerCampaigns();

  await page.goto('/templates');

  // 실행마다 고유한 템플릿 이름(RUN_ID 접미사)으로 정확히 한 행만 매치한다(반복 로컬 실행 누적 방지).
  const row = page.getByRole('row', { name: flow.templateName }).first();
  await row.getByRole('button', { name: '미리보기' }).click();

  const result = await readAttackResult(page);

  const cookieEntry = result.cookie as { threw: boolean; value?: string; error?: string };
  expect(cookieEntry.threw).toBe(true);
  expect(cookieEntry.error).toBe('SecurityError');

  // 미리보기 Dialog 안(3000 오리진 문서 안에 중첩된 iframe)에서도 실제 네트워크 관찰로 판단한다.
  assertNoAuthenticatedAdminRequest(observed);

  const markerCountAfter = await countMarkerCampaigns();
  expect(markerCountBefore).toBe(0);
  expect(markerCountAfter).toBe(0);

  await page.close();
});
