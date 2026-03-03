const { chromium } = require('playwright');

async function loginToOperaCloud() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Login page loaded.');

    console.log('Filling credentials...');
    await page.getByRole('textbox', { name: 'User Name' }).click();
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
    console.log('Credentials filled.');

    console.log('Clicking Sign In...');
    await page.getByRole('button', { name: 'Sign In' }).click({ waitUntil: 'networkidle' });
    console.log('Sign In clicked.');

    console.log('Waiting for popup and clicking OPERA Cloud link...');
    const page1Promise = page.waitForEvent('popup', { timeout: 60000 });
    await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
    const page1 = await page1Promise;
    console.log('Popup captured. URL:', page1.url());

    console.log('Waiting for popup to load...');
    await page1.waitForLoadState('load', { timeout: 60000 });
    console.log('Popup loaded. Current URL:', page1.url());

    console.log('Checking all pages for dashboard...');
    const dashboardUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
    await page.waitForTimeout(5000);
    const pages = context.pages();
    console.log('Open pages:', pages.map(p => p.url()));

    const dashboardPage = pages.find(p => p.url().includes('opera-cloud-index/OperaCloud')) || page1;
    if (!dashboardPage) {
      throw new Error('Dashboard page not found among open pages');
    }

    console.log('Dashboard page found. URL:', dashboardPage.url());
    await dashboardPage.waitForLoadState('load', { timeout: 60000 });
    console.log('Dashboard loaded.');

    console.log('Verifying login...');
    const loginIndicator = dashboardPage.getByTitle('OPERA Cloud');
    await loginIndicator.waitFor({ state: 'visible', timeout: 30000 });
    const isLoggedIn = await loginIndicator.isVisible();
    if (!isLoggedIn) {
      throw new Error('Login failed: Dashboard not detected');
    }

    console.log('Login successful!');
    return { page: dashboardPage, browser };
  } catch (error) {
    console.error('Login error:', error);
    if (!page.isClosed()) await page.close();
    if (!browser.isConnected()) await browser.close();
    throw error;
  }
}

class OperaCloudExtractor {
  constructor(page) {
    this.page = page;
  }

  async extractGuestData() {
    try {
      console.log('Extracting guest data...');
      await this.page.waitForSelector('.guest-list', { timeout: 30000 }); // Replace with real selector
      const guestData = await this.page.evaluate(() => {
        const element = document.querySelector('.guest-list'); // Replace with real selector
        return element ? element.innerText : 'No guest data found';
      });
      console.log('Guest data extracted successfully.');
      return guestData;
    } catch (error) {
      console.error('Guest data extraction failed:', error.message);
      throw error;
    }
  }

  async extractReservationData() {
    try {
      console.log('Extracting reservation data...');
      await this.page.waitForSelector('.reservation-table', { timeout: 30000 }); // Replace with real selector
      const reservationData = await this.page.evaluate(() => {
        const element = document.querySelector('.reservation-table'); // Replace with real selector
        return element ? element.innerText : 'No reservation data found';
      });
      console.log('Reservation data extracted successfully.');
      return reservationData;
    } catch (error) {
      console.error('Reservation data extraction failed:', error.message);
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

    console.log('Main function completed.');
  } catch (error) {
    console.error('Main execution failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();