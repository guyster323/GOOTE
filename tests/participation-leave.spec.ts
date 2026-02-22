import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const appId = process.env.PW_LEAVE_APP_ID;
const storageStatePath = process.env.PW_STORAGE_STATE;

if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('Participation Leave Regression', () => {
  test('참여 중인 앱에서 나가기 버튼으로 정상 이탈할 수 있어야 함', async ({ page }) => {
    test.skip(!appId, 'PW_LEAVE_APP_ID 환경변수가 필요합니다.');
    test.skip(!storageStatePath, 'PW_STORAGE_STATE(로그인 상태 파일 경로) 환경변수가 필요합니다.');
    test.skip(Boolean(storageStatePath) && !fs.existsSync(storageStatePath), 'PW_STORAGE_STATE 파일을 찾을 수 없습니다.');

    await page.goto(`/apps/${appId}`);

    const leaveButton = page.getByRole('button', { name: '나가기' });
    await expect(leaveButton).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await leaveButton.click();

    await expect(page.getByText('테스트 참여를 종료했습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '나가기' })).toHaveCount(0);
  });
});
