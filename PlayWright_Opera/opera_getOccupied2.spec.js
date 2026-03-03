import { test, expect } from '@playwright/test';

test.describe('Check Room 0319 for March 7, 2025', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    launchOptions: { headless: false, slowMo: 1000 }, // Show browser, slow down
  });

  test('check room diary', async ({ page }) => {
    // Navigate with explicit wait
    await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });

    // Handle login if required (uncomment and adjust)
    // await page.fill('#username', 'your-username');
    // await page.fill('#password', 'your-password');
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/.*dashboard.*/);

    // Navigate to Room Diary
    await page.getByRole('link', { name: 'Bookings' }).click();
    await page.waitForLoadState('networkidle'); // Wait for full load

    // Debug and click Room Diary
    const roomDiary = page.getByText('Room Diary');
    console.log('Waiting for Room Diary to be visible...');
    await roomDiary.waitFor({ state: 'visible', timeout: 60000 });
    const isVisible = await roomDiary.isVisible();
    console.log('Room Diary visible:', isVisible);
    if (!isVisible) {
      await page.screenshot({ path: 'room-diary-fail.png' });
      throw new Error('Room Diary not visible - check UI state');
    }
    await roomDiary.click({ timeout: 60000 });

    // Search criteria
    await page.getByRole('textbox', { name: 'Property' }).click();
    await page.getByTitle('Search and Select Property').first().click();
    await page.getByLabel(/Start Date/i).fill('03/07/2025'); // MM/DD/YYYY
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle'); // Wait for results

    // Check room 0319
    const roomRow = page.locator('text=0319');
    await roomRow.waitFor({ state: 'visible', timeout: 60000 });
    const reservationBlock = roomRow.locator('xpath=following::td[contains(@data-date, "2025-03-07")]');
    const isBooked = await reservationBlock.isVisible();

    if (isBooked) {
      const reservationName = await reservationBlock.getAttribute('title') || await reservationBlock.textContent();
      console.log(`Room 0319 is booked on March 7, 2025. Reservation Name: ${reservationName || 'Unknown'}`);
    } else {
      console.log('Room 0319 is not booked on March 7, 2025.');
    }
  });
});