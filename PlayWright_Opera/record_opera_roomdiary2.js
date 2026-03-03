import { test, expect } from '@playwright/test';

// Extract room numbers and types from your data, ignoring Dirty/Inspected/Out of Order
const rooms = [
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
  { number: '0317', type: '1-BR' },
];

test.describe('Check All Rooms for March 7, 2025', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    launchOptions: { headless: false, slowMo: 500 }, // Show browser
  });

  test('check room diary for all rooms', async ({ page }) => {
    // Login page
    await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3Dhu5z7gRL1B8YOdJq4tMLq%2BrqxBOI1hEl6%2BM9EoADfKGnF1lOsYoMkeqJ1wJL5ncoHAwaBRBZCIMbwvqHdLXK0SS0rPJocpKA4hNY03LMvlAVHk7i9D4AghPj2%2F%2Bny%2FYDyRDdJf33jGMOaY7M091JOUHitRtkYbL6NswtEAqnT8QbW1RIwZYD75F%2BTkMbYbzvzxqjSuKqAnVO46Mlise1R0u5gkoGmtfr61RRSozgV4FUwoGy48ur483Pq494Zjjy%2FOnTPP9RLjUDPraSva8eTrVoEdGh5azrSb1loPXWki%2FeQsts4BQaxqNUoxj7FJ27A9xjU9RoeAzmJpzgZp8Mdk8r2hw9akSB0frXtz5kkWk70mDEl9Qrz2syUshArr%2Fs%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3Da5f7a8c81796b6adb06b6af82658d755392f620c&ECID-Context=1.006BsP1vzlF03zOUuipmWH0002pj0001M2%3BkXjE', { waitUntil: 'networkidle' });

    // Login
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Handle popup and navigate to Opera Cloud
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
    const page1 = await page1Promise;
    await page1.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });

    // Navigate to Room Diary
    await page1.getByRole('link', { name: 'Bookings' }).click();
    await page1.waitForLoadState('networkidle');
    const roomDiary = page1.getByText('Room Diary');
    await roomDiary.waitFor({ state: 'visible', timeout: 60000 });
    await roomDiary.click({ timeout: 60000 });

    // Set date once for all rooms
    await page1.getByPlaceholder('DD.MM.YYYY').fill('07.03.2025');
    
    // Loop through all rooms
    for (const room of rooms) {
      console.log(`Checking Room ${room.number} (${room.type})...`);
      await page1.getByRole('textbox', { name: 'Room', exact: true }).fill(room.number);
      await page1.getByRole('button', { name: 'Search', exact: true }).click();
      await page1.waitForLoadState('networkidle');

      // Check for occupant (assuming reservation appears as text like "CI | Name")
      const reservation = page1.locator(`text=/CI \\| .*/`).first();
      try {
        await reservation.waitFor({ state: 'visible', timeout: 5000 });
        const occupant = await reservation.textContent();
        console.log(`Room ${room.number} (${room.type}): ${occupant}`);
      } catch (e) {
        console.log(`Room ${room.number} (${room.type}): Unoccupied`);
      }
      
      // Clear the Room field for the next iteration
      await page1.getByRole('textbox', { name: 'Room', exact: true }).fill('');
    }
  });
});