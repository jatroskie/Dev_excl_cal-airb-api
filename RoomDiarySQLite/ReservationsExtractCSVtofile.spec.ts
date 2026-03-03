import { test, expect } from '@playwright/test';
import path from 'path';

// Constants for sensitive data (use environment variables in production)
const LOGIN_URL = 'https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3D2N0Cn5n9bqIzKHmYaP1YxZ%2BqzuqVzA5rt9RZW0fA1oyqBHjCKerxhpwIV4JTjo%2FI4Brs7c4KnHVKro8U4I%2F%2F8NEjr9O4AyASMh5qYKocFKTqzvyQioT2GFtLnNXDbumrFk3i%2FkgZ2HFlJBpj%2FrKT8nu4bhYH6uyUb8zRiuPvvLh1aeYtsBCMMHT8DetY%2FwHjtZuyLWMvANZzAAGraDjGZwoZFyVmg9ACw0pNOTJ4hxT0rcqG5dOfHbvOgmYVl2KbRCGt0qtOevbvgHVnHDBfS2PPvPqN6SXSviuvOqRZIn%2FxGu%2BLSEBCdXYpTlR1WPdRsc1vw2B9ChLYiHrsa9dSSiLfs%2B9VEn0hdjtNvWMKCPCF3%2FoDejVZuVmM5tKYJzCn%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D50060869025c8f152c712f33e1c6c9047e2be000&ECID-Context=1.006BtYPJ9PU03zOUuipmWH0001bn0002K7%3BkXjE';
const OPERA_CLOUD_URL = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
const USERNAME = 'johant';
const PASSWORD = 'Dexter123456#'; // Use environment variables in production
const FILE_NAME = 'Opera_Reservations_2025';

test('Download Opera Cloud Reservations CSV for 2025', async ({ page, context }) => {
  let operaPage: any = null; // Type 'any' to avoid TypeScript strictness for now

  try {
    console.log('Starting test: Navigating to login page');
    // Step 1: Navigate to login page and log in
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.locator('input[name="User Name"]').fill(USERNAME);
    await page.locator('input[name="Password"]').fill(PASSWORD);
    await page.locator('button:has-text("Sign In")').click();
    await expect(page.locator('a:has-text("Click to go to OPERA Cloud")')).toBeVisible({ timeout: 20000 }); // Increased to 20 seconds

    console.log('Navigating to OPERA Cloud');
    // Step 2: Navigate to OPERA Cloud and bookings section
    const [newPage] = await Promise.all([
      context.waitForEvent('page'), // Wait for the popup/new page
      page.locator('a:has-text("Click to go to OPERA Cloud")').click(),
    ]);
    operaPage = newPage;
    await operaPage.waitForLoadState('networkidle', { timeout: 30000 }); // Increased to 30 seconds
    await expect(operaPage).toHaveURL(OPERA_CLOUD_URL, { timeout: 30000 }); // Increased to 30 seconds

    // Debug: Check the page content to ensure navigation worked
    console.log('Current URL:', operaPage.url());
    const bookingsLink = operaPage.locator('a:has-text("Bookings")');
    await expect(bookingsLink).toBeVisible({ timeout: 30000 }); // Increased to 30 seconds

    // Step 3: Navigate to Manage Reservations
    console.log('Navigating to Bookings and Manage Reservations');
    await bookingsLink.click();
    await operaPage.waitForLoadState('networkidle', { timeout: 30000 }); // Increased to 30 seconds
    await operaPage.waitForTimeout(5000); // Added 5-second delay for stability
    await operaPage.locator('text=Manage Reservation').click();

    // Step 4: Set search criteria for 2025 reservations
    console.log('Setting search criteria for 2025 reservations');
    await operaPage.locator('input[name="Arrival From"]').fill('01.01.2025');
    await operaPage.locator('input[name="Arrival To"]').fill('31.12.2025');
    await operaPage.locator('button[title="Search and Select Reservation"]').first.click();

    // Step 5: Select all reservations and search
    console.log('Selecting all reservations and searching');
    await operaPage.locator('#pt1\\:oc_pg_pt\\:r1\\:1\\:pt1\\:oc_srch_tmpl_167b9q\\:ode_bscrn_tmpl\\:oc_srch_swtchr\\:odec_srch_swtchr_advncd_sf\\:fe25\\:lov7\\:odec_lov_pc\\:odec_lov_tLovTable\\:0\\:odec_lov_ms1\\:odec_mltslct_chkbx').click();
    await operaPage.locator('button:has-text("Select")').click();
    await operaPage.locator('button:has-text("Search")').click();

    // Step 6: Export as CSV
    console.log('Exporting reservations as CSV');
    await operaPage.locator('a:has-text("View Options")').click();
    await operaPage.locator('text=Export').click();
    await operaPage.locator('text=CSV').click();

    // Step 7: Set file name and initiate download
    console.log('Setting file name for export');
    await operaPage.locator('input[name="File Name"]').fill(FILE_NAME);
    await operaPage.locator('a:has-text("Close")').click();

    // Step 8: Trigger download and save file
    console.log('Triggering CSV download');
    const downloadPromise = operaPage.waitForEvent('download', { timeout: 45000 }); // Increased to 45 seconds
    await operaPage.locator('a:has-text("View Options")').click();
    await operaPage.locator('#f1\\:\\:__af_Z_window text=Export').click();
    await operaPage.locator('text=CSV').click();
    await operaPage.locator('button:has-text("Export")').click();

    const download = await downloadPromise;
    const filePath = path.join(__dirname, `${FILE_NAME}.csv`);
    await download.saveAs(filePath);

    // Step 9: Verify download
    expect(await download.path()).toBeTruthy();
    console.log(`CSV file downloaded successfully to: ${filePath}`);

  } catch (error) {
    console.error('Test failed:', error.message);
    throw error; // Fail the test if an error occurs
  } finally {
    // Close operaPage if it exists, then close the original page and context
    if (operaPage) {
      await operaPage.close().catch(() => console.log('Failed to close operaPage, it may already be closed'));
    }
    await page.close().catch(() => console.log('Failed to close page, it may already be closed'));
    await context.close().catch(() => console.log('Failed to close context, it may already be closed'));
  }
});