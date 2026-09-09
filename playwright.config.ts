import { defineConfig, devices } from '@playwright/test';

/**
 * 브라우저로만 검증되는 두 가지에만 쓴다: 격리 공격 시나리오(e2e/isolation.spec.ts, ADR 0018)와 데스크톱 레이아웃 실측(e2e/layout.spec.ts, ADR 0021).
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
