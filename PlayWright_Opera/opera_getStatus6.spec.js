import { test, expect } from '@playwright/test';

// Sorted room numbers in ascending order with types, duplicates removed
const rooms = [
  { number: '0317', type: '1-BR' },
  { number: '0318', type: 'STU-URB' },
  { number: '0319', type: 'STU-URB' },
  { number: '0320', type: 'STU-URB' },
  { number: '0321', type: 'STU-URB' },
  { number: '0323', type: 'STU-URB' },
  { number: '0400', type: 'STU-BALC' },
  { number: '0401', type: 'STU-BALC' },
  { number: '0402', type: 'STU-BALC' },
  { number: '0403', type: 'STU-URB' },
  { number: '0404', type: 'STU-URB' },
  { number: '0405', type: 'STU-URB' },
  { number: '0406', type: 'STU-URB' },
  { number: '0407', type: 'STU-URB' },
  { number: '0408', type: 'STU-URB' },
  { number: '0409', type: 'STU-URB' },
  { number: '0411', type: 'STU-URB' },
  { number: '0412', type: 'STU-URB' },
  { number: '0413', type: '1-BR' },
  { number: '0415', type: '1-BR' },
  { number: '0416', type: 'STU-URB' },
  { number: '0417', type: 'STU-URB' },
  { number: '0418', type: 'STU-URB' },
  { number: '0419', type: 'STU-URB' },
  { number: '0420', type: 'STU-URB' },
  { number: '0501', type: 'STU-BALC' },
  { number: '0502', type: 'STU-BALC' },
  { number: '0503', type: 'STU-BALC' },
  { number: '0504', type: 'STU-LUX' },
  { number: '0506', type: 'STU-LUX' },
  { number: '0507', type: 'STU-LUX' },
  { number: '0508', type: 'STU-LUX' },
  { number: '0509', type: 'STU-LUX' },
  { number: '0511', type: 'STU-LUX' },
  { number: '0513', type: '2-BR' },
  { number: '0514', type: 'STU-BALC' },
  { number: '0515', type: '2-BR' },
  { number: '0516', type: 'STU-LUX' },
  { number: '0517', type: 'STU-LUX' },
  { number: '0518', type: 'STU-LUX' },
  { number: '0519', type: 'STU-LUX' },
  { number: '0520', type: 'STU-LUX' },
];

test.use({
  viewport: { width: 1920, height: 1080 },
  launchOptions: { headless: false, slowMo: 500 },
});

test.describe('Check All Rooms for March 7, 2025', () => {
  test('check room diary for all rooms', async ({ page, context }) => {
    // Login page
    await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3DtaR4ycFSFmNO%2FnT0%2BgBCLOWFMvlv1tE%2Fb23LgnnkFd9eHLrM3L%2FBfDuYexVAc5PIEqg3OuMBPwnlzIEqtV18MbOl92E8B2pgDX4APOZWLXEpnH3TXRegDUBQ2ZwN6GxaaV5kS2Rqk9ZVH%2F4eoln%2F4QxC3aSKFI1JEwashiZojIw1zKe5D3Z%2F9UKv5D4cNMJWMhKhWf0y45pdYgQ97Rlpg3zLPfapIunIPOFWs4guHoexQzRjEHwLZl8IjGKNcF%2BBQs24ODGvYIN5cZgv2BUwgnpaGjwt0yev8x%2BszAorxzL3gKwST3Z6QwepM%2Fym%2F%2BbUb%2BtKvUiUxLFKMPBbg7rI1lSps0%2FAJrirQNzfIB8q5Rkk774%2FcJa9LC1lnr3wD%2BL%2F%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3De05da65aa99369a5a9cea827be6b71aacb506440&ECID-Context=1.006BsUAkFzl03zOUuipmWH0001ZW0000%5ER%3BkXjE', { waitUntil: 'networkidle' });

    // Login
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Handle popup and switch back to main page
    console.log('Opening popup...');
    const page1Promise = context.waitForEvent('page', { timeout: 60000 });
    await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
    const page1 = await page1Promise;
    console.log('Popup opened. URL:', page1.url());
    
    // Wait for popup to close and main page to update
    await page1.waitForEvent('close', { timeout: 60000 });
    console.log('Popup closed. Continuing on main page...');
    await page.waitForURL(/opera-cloud-index/, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Room Diary on main page
    await page.getByRole('link', { name: 'Bookings' }).click();
    await page.waitForLoadState('networkidle');
    const roomDiary = page.getByText('Room Diary');
    await roomDiary.waitFor({ state: 'visible', timeout: 60000 });
    await roomDiary.click({ timeout: 60000 });

    // Set date once
    await page.locator('input[name="pt1\\:oc_pg_pt\\:r1\\:1\\:pt1\\:oc_srch_tmpl_kfm3f1\\:ode_bscrn_tmpl\\:oc_srch_fltrs\\:fe22\\:nd1\\:odec_nvdt_it0"]').fill('07.03.2025');

    // Loop through all rooms
    for (const room of rooms) {
      console.log(`Checking Room ${room.number} (${room.type})...`);
      await page.getByRole('textbox', { name: 'Room', exact: true }).fill(room.number);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.waitForLoadState('networkidle');

      // Check for occupant
      const reservation = page.locator('div, span, td').filter({ hasText: /^(CI|IH) \| .*/ }).first();
      try {
        await reservation.waitFor({ state: 'visible', timeout: 5000 });
        const occupant = await reservation.textContent();
        console.log(`Room ${room.number} (${room.type}): ${occupant.trim()}`);
      } catch (e) {
        console.log(`Room ${room.number} (${room.type}): Unoccupied`);
      }

      // Modify search criteria to reset
      await page.getByRole('link', { name: 'Modify Search Criteria' }).click();
      await page.waitForLoadState('networkidle');
    }
  });
});