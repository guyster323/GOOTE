
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'line',
  webServer: {
    command: process.env.PLAYWRIGHT_USE_PRODUCTION ? 'npm run start' : 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_USE_PRODUCTION,
    timeout: 120 * 1000, // 2분 대기
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
