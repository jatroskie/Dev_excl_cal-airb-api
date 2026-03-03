const { chromium } = require('playwright');

async function loginToOperaCloud() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.getByRole('textbox', { name: 'User Name' }).click();
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');

    // Click "Sign In" and wait for navigation implicitly
    await page.getByRole('button', { name: 'Sign In' }).click({ waitUntil: 'networkidle' });

    // Handle popup after clicking "Click to go to OPERA Cloud"
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
    const page1 = await page1Promise;

    // Wait for the popup to fully load
    await page1.waitForLoadState('networkidle');

    // Explicit wait for 18 seconds as per your requirement
    await page1.waitForTimeout(18000);

    // Verify successful login on the popup page
    const isLoggedIn = await page1.isVisible('.welcome-message'); // Adjust this selector
    if (!isLoggedIn) {
      throw new Error('Login failed: Dashboard not detected');
    }

    console.log('Login successful!');
    return { page: page1, browser };

  } catch (error) {
    console.error('Login error:', error);
    await browser.close();
    throw error;
  }
}

class OperaCloudExtractor {
  constructor(page) {
    this.page = page;
  }

  async extractGuestData() {
    try {
      await this.page.waitForSelector('.guest-list'); // Adjust selector
      const guestData = await this.page.evaluate(() => {
        return document.querySelector('.guest-list').innerText;
      });
      return guestData;
    } catch (error) {
      console.error('Guest data extraction failed:', error);
      throw error;
    }
  }

  async extractReservationData() {
    try {
      await this.page.waitForSelector('.reservation-table'); // Adjust selector
      const reservationData = await this.page.evaluate(() => {
        return document.querySelector('.reservation-table').innerText;
      });
      return reservationData;
    } catch (error) {
      console.error('Reservation data extraction failed:', error);
      throw error;
    }
  }
}

async function main() {
  let browser;
  try {
    const { page, browser: browserInstance } = await loginToOperaCloud();
    browser = browserInstance;

    const extractor = new OperaCloudExtractor(page);
    const guestData = await extractor.extractGuestData();
    console.log('Guest Data:', guestData);

    const reservationData = await extractor.extractReservationData();
    console.log('Reservation Data:', reservationData);
  } catch (error) {
    console.error('Main execution failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();