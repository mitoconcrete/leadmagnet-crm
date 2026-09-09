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

test('공개 페이지: 등록 HTML은 관리자 쿠키를 읽지 못하고 관리자 API 호출이 200으로 성공하지 않는다', async () => {
  const flow = flows.cookieAndAdminApi!;
  const page = await context.newPage();
  await page.goto(publicUrl(flow));

  const result = await readAttackResult(page);

  // opaque origin sandbox에서 document.cookie는 빈 문자열이거나 접근 자체가 예외로 막힌다 — 둘 다 격리 성립.
  const cookieEntry = result.cookie as { threw: boolean; value?: string; error?: string };
  if (cookieEntry.threw) {
    expect(cookieEntry.error).toBeTruthy();
  } else {
    expect(cookieEntry.value).toBe('');
  }

  for (const key of ['relativeAdminCampaigns', 'absolute3001AdminCampaigns'] as const) {
    const entry = result[key] as { status?: number; error?: string };
    if (typeof entry.status === 'number') {
      expect(entry.status).not.toBe(200);
    } else {
      expect(entry.error).toBeTruthy();
    }
  }

  // 3000(관리자 오리진)은 connect-src 허용 목록 밖이라 요청 자체가 열리지 않아야 한다(TypeError).
  const adminOriginEntry = result.absolute3000AdminMe as { status?: number; error?: string };
  expect(adminOriginEntry.status).toBeUndefined();
  expect(adminOriginEntry.error).toBeTruthy();

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
  await page.goto('/templates');

  // 실행마다 고유한 템플릿 이름(RUN_ID 접미사)으로 정확히 한 행만 매치한다(반복 로컬 실행 누적 방지).
  const row = page.getByRole('row', { name: flow.templateName }).first();
  await row.getByRole('button', { name: '미리보기' }).click();

  const result = await readAttackResult(page);

  const cookieEntry = result.cookie as { threw: boolean; value?: string; error?: string };
  if (cookieEntry.threw) {
    expect(cookieEntry.error).toBeTruthy();
  } else {
    expect(cookieEntry.value).toBe('');
  }

  for (const key of ['relativeAdminCampaigns', 'absolute3001AdminCampaigns'] as const) {
    const entry = result[key] as { status?: number; error?: string };
    if (typeof entry.status === 'number') {
      expect(entry.status).not.toBe(200);
    } else {
      expect(entry.error).toBeTruthy();
    }
  }

  await page.close();
});
