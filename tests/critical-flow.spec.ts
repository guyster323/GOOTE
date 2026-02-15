import { test, expect } from '@playwright/test';

test.describe('Critical Flow: Auth Guard & Public Access', () => {
  test('비로그인 사용자가 /dashboard 접근 시 로그인 화면으로 리다이렉트되어야 함', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await expect(page).toHaveURL(/\/?\?mode=login&redirect=%2Fdashboard/);
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('비로그인 사용자가 /my-apps/register 접근 시 로그인 화면으로 리다이렉트되어야 함', async ({ page }) => {
    await page.goto('http://localhost:3000/my-apps/register');
    await expect(page).toHaveURL(/\/?\?mode=login&redirect=%2Fmy-apps%2Fregister/);
  });

  test('비로그인 사용자가 /onboarding 접근 시 로그인 화면으로 리다이렉트되어야 함', async ({ page }) => {
    await page.goto('http://localhost:3000/onboarding');
    await expect(page).toHaveURL(/\/?\?mode=login&redirect=%2Fonboarding/);
  });

  test('공개 경로 /apps/[id] 는 비로그인 상태에서도 접근 가능해야 함', async ({ page }) => {
    await page.goto('http://localhost:3000/apps/test-app-id');
    await expect(page).toHaveURL(/\/apps\/test-app-id/);
  });
});
