import { test } from '@playwright/test';

test('check popup', async ({ page, context }) => {
  await page.goto('https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/'); // replace with your login URL
  await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
  await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
  await page.getByRole('button', { name: 'Sign In' }).click();

  const page1Promise = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
  const page1 = await page1Promise;

  page1.on('console', (msg) => console.log(`PAGE LOG: ${msg.text()}`));
  page1.on('pageerror', (error) => console.log(`PAGE ERROR: ${error.message}`));
  page1.on('close', () => console.log('Popup Closed Unexpectedly'));

  await page1.waitForURL(/opera-cloud-index/, { timeout: 60000 });
  console.log('Popup loaded successfully!');
});