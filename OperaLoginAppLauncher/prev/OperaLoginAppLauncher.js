const { chromium } = require('playwright');

async function loginToOperaCloud() {
  // Launch browser in non-headless mode for debugging (can be set to true in production)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the login page
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.getByRole('textbox', { name: 'User Name' }).click();
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    
   # await page.fill('input[name="username"]', 'johant'); // Adjust selector based on actual input name
   
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
   # await page.fill('input[name="password"]', 'Dexter123456#'); // Adjust selector based on actual input name

    // Click login button and wait
    await Promise.all([
     # page.click('button[type="submit"]'), // Adjust selector based on actual button
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
      page.waitForNavigation({ waitUntil: 'networkidle' }),
    ]);

    // Explicit wait for 18 seconds after login click
    await page.waitForTimeout(18000);

    // Verify successful login (adjust selector based on post-login element)
    const isLoggedIn = await page.isVisible('.welcome-message'); // Example selector
    if (!isLoggedIn) {
      throw new Error('Login failed: Dashboard not detected');
    }

    console.log('Login successful!');
    return { page, browser };

  } catch (error) {
    console.error('Login error:', error);
    await browser.close();
    throw error;
  }
}

// Structure for specialized apps
class OperaCloudExtractor {
  constructor(page) {
    this.page = page;
  }

  async extractGuestData() {
    // Example: Extract guest information
    try {
      await this.page.waitForSelector('.guest-list'); // Adjust selector
      const guestData = await this.page.evaluate(() => {
        // Add your extraction logic here
        return document.querySelector('.guest-list').innerText;
      });
      return guestData;
    } catch (error) {
      console.error('Guest data extraction failed:', error);
      throw error;
    }
  }

  async extractReservationData() {
    // Example: Extract reservation information
    try {
      await this.page.waitForSelector('.reservation-table'); // Adjust selector
      const reservationData = await this.page.evaluate(() => {
        // Add your extraction logic here
        return document.querySelector('.reservation-table').innerText;
      });
      return reservationData;
    } catch (error) {
      console.error('Reservation data extraction failed:', error);
      throw error;
    }
  }
}

// Main execution function
async function main() {
  let browser;
  try {
    // Perform login
    const { page, browser: browserInstance } = await loginToOperaCloud();
    browser = browserInstance;

    // Initialize extractor
    const extractor = new OperaCloudExtractor(page);

    // Use specialized apps
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

// Run the application
main();