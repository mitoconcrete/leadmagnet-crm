import { defineConfig, devices } from '@playwright/test';

/**
 * ADR 0018: 격리 시나리오(e2e/isolation.spec.ts) 1개 파일에만 쓰는 브라우저 검증.
 * 실행 중인 compose 스택(web 3000, api 3001)을 전제로 한다.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
