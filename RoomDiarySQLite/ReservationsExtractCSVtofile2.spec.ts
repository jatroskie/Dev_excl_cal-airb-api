import { test, expect } from '@playwright/test';
import path from 'path';

// Constants for sensitive data (use environment variables in production)
const LOGIN_URL = 'https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3D519oUrl6K8dNK3HF8o1Rk5PyOn6rJ8KFymFP8VrzHV%2FFes1prqKJ1ZmoYBpgjiPv8V4uHO36V%2B0WwYwDoQ9J6f3n1cGhNjMQGgojOYBrukM9tQiLVbsxWBfHCAqgkUVoJMKZP%2BFbhIinDLHNAVRGFK93Ly3mai5IRGXS%2Bs2ukzauLfF3JeQMVJStU6up4g2G1Mz6RfepVgWdo3dxn4zZ9FrX9S%2FWvMpvhOLTw%2Ba4EW3Mr5FD4crpisaSDL1SyjFX8b8xvkUkWAypNnmavR%2BkuA5k5PGIRFGs4wfCHKc2n%2BavqriFArUEkvDSkRUk63lRxIJDppyqnhYPPbZqA9sa9ltBep90yZIxh%2F3cYDB2cgrV2jG%2B6iROi3qIwrFPb%2F6s%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D37d2a56f61644ea77e0f2fb7217bfa6f33501f14&ECID-Context=1.006BsbM%5EEZD03zOUuislkH00025f0001tN%3BkXjE';
const OPERA_CLOUD_URL = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
const USERNAME = 'johant';
const PASSWORD = 'Dexter123456#'; // Use environment variables in production
const FILE_NAME = 'Opera_Reservations_2025';

// Increase the default test timeout to 300 seconds
test.setTimeout(300000); // 300 seconds timeout for the entire test

test('Download Opera Cloud Reservations CSV for 2025', async ({ page, context }) => {
  let operaPage: any = null; // Type 'any' to avoid TypeScript strictness for now

  try {
    console.log('Starting test: Navigating to login page');
    // Login page
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 120000 }); // Increased to 120 seconds
    await page.waitForLoadState('networkidle', { timeout: 120000 }); // Ensure page is fully loaded

    // Debug: Check if the username field exists
    const usernameInput = page.getByRole('textbox', { name: 'User Name' });
    await expect(usernameInput).toBeVisible({ timeout: 120000 }); // Increased to 120 seconds
    console.log('Username field found, filling credentials');

    // Retry filling the username field if it fails
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        await usernameInput.click();
        await usernameInput.fill(USERNAME);
        break; // If successful, exit the loop
      } catch (error) {
        attempts++;
        console.log(`Attempt ${attempts} failed to fill username: ${error.message}`);
        if (attempts === maxAttempts) throw error;
        await page.waitForTimeout(10000); // Increased to 10 seconds before retrying
      }
    }

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await expect(passwordInput).toBeVisible({ timeout: 120000 }); // Increased to 120 seconds
    await passwordInput.click();
    await passwordInput.fill(PASSWORD);
    await page.locator('button:has-text("Sign In")').click();
    await expect(page.locator('a:has-text("Click to go to OPERA Cloud")')).toBeVisible({ timeout: 120000 }); // Increased to 120 seconds

    console.log('Navigating to OPERA Cloud');
    // Step 2: Navigate to OPERA Cloud and bookings section
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 120000 }), // Wait for the popup/new page with increased timeout
      page.locator('a:has-text("Click to go to OPERA Cloud")').click(),
    ]);
    operaPage = newPage;
    operaPage.on('close', () => console.log('Popup closed unexpectedly')); // Listen for unexpected closure

    // Try to wait for the popup to stabilize, handling potential closure
    try {
      await operaPage.waitForLoadState('networkidle', { timeout: 180000 }); // Increased to 180 seconds
      console.log('Popup reached networkidle state');
    } catch (loadError) {
      console.log('Popup failed to reach networkidle, checking if closed:', operaPage.isClosed());
      if (operaPage.isClosed()) {
        console.log('Popup closed prematurely. Attempting to recapture or proceed with main page...');
        // If the popup closes, try to continue with the main page or recapture the popup
        await page.waitForLoadState('networkidle', { timeout: 120000 });
        await expect(page).toHaveURL(/opera-cloud-index/, { timeout: 120000 });
        console.log('Continued on main page. URL:', page.url());
      } else {
        throw loadError; // Re-throw if not closed but still failed
      }
    }

    await expect(operaPage).toHaveURL(OPERA_CLOUD_URL, { timeout: 180000 }); // Increased to 180 seconds, if still open

    // Debug: Check the page content to ensure navigation worked
    console.log('Current URL:', operaPage.url());
    console.log('Page content:', await operaPage.content()); // Log page content for debugging
    console.log('Is page closed?', operaPage.isClosed()); // Check if the page is closed
    const bookingsLink = operaPage.locator('a:has-text("Bookings")');
    await expect(bookingsLink).toBeVisible({ timeout: 180000 }); // Increased to 180 seconds

    // Step 3: Navigate to Manage Reservations
    console.log('Navigating to Bookings and Manage Reservations');
    await bookingsLink.click();
    await operaPage.waitForLoadState('networkidle', { timeout: 180000 }); // Increased to 180 seconds
    await operaPage.waitForTimeout(15000); // Increased to 15-second delay for stability
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
    const downloadPromise = operaPage.waitForEvent('download', { timeout: 240000 }); // Increased to 240 seconds
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
    // Close operaPage if it exists and isn’t closed, then close the original page and context
    if (operaPage && !operaPage.isClosed()) {
      await operaPage.close().catch(() => console.log('Failed to close operaPage, it may already be closed'));
    }
    if (!page.isClosed()) {
      await page.close().catch(() => console.log('Failed to close page, it may already be closed'));
    }
    if (!context.isClosed()) {
      await context.close().catch(() => console.log('Failed to close context, it may already be closed'));
    }
  }
});