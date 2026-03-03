import { test, expect } from '@playwright/test';

test('test Opera Cloud Room Diary', async ({ page }) => {
  // Navigate to the page
  await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });

  // If login is required, add it here (example)
  // await page.fill('#username', 'your-username');
  // await page.fill('#password', 'your-password');
  // await page.click('button[type="submit"]');
  // await page.waitForURL(/.*dashboard.*/); // Adjust to post-login URL

  // Click 'Bookings' and wait for navigation
  await page.getByRole('link', { name: 'Bookings' }).click();
  await page.waitForLoadState('domcontentloaded'); // Ensure page is ready

  // Ensure 'Room Diary' is visible before clicking
  const roomDiary = page.getByText('Room Diary');
  await roomDiary.waitFor({ state: 'visible', timeout: 60000 }); // Wait up to 60s
  await roomDiary.click({ timeout: 60000 });

  // Continue with the rest
  await page.getByRole('textbox', { name: 'Property' }).click();
  await page.getByRole('textbox', { name: 'Property' }).fill('TBA0319');
  await page.getByTitle('Search and Select Property').first().click();
});
