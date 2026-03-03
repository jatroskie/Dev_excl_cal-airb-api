// extractor.js - This version correctly exports an object for app.js to use.
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login');

// Custom error to signal a fatal session failure that requires a re-login.
class SessionExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

class OperaExtractor {
  constructor(headless = true, debug = false, switchMode = false) {
    this.headless = headless;
    this.debug = debug;
    this.switchMode = switchMode;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.baseWait = this.headless ? 4000 : 2000;
  }

  async initialize() {
    const { browser, context, page } = await loginToOperaCloud(this.headless);
    this.browser = browser;
    this.context = context;
    this.page = page;
    try {
      await page.waitForNavigation({ timeout: 60000 });
    } catch (e) {
      // Silent
    }
    await page.waitForTimeout(4000);
  }

  async switchHotel(hotelName, hotelCode) {
    try {
      const page = this.page;
      const correctHotelText = `${hotelCode} - ${hotelName}`;
      const hotelLocator = page.getByText(correctHotelText, { exact: true });

      if (await hotelLocator.isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log(`Already on correct hotel: ${hotelName}.`);
        return;
      }

      console.log(`Switching to ${hotelName}...`);
      const menuLocator = page.locator('[id="pt1\\:oc_pg_pt\\:ode_pg_mnhdr_rght_cntnt_lnk"]');
      await menuLocator.waitFor({ state: 'visible', timeout: 30000 });
      await menuLocator.click();

      const changeLocation = page.getByRole('link', { name: 'Change Location' });
      await changeLocation.waitFor({ state: 'visible', timeout: 30000 });
      await changeLocation.click();

      const dialogLocator = page.locator('div[role="dialog"]:has-text("Select Location")');
      await dialogLocator.waitFor({ state: 'visible', timeout: 30000 });

      const searchInput = dialogLocator.getByRole('textbox', { name: 'Search Text' });
      await searchInput.fill(hotelName);

      const searchButton = dialogLocator.getByRole('button', { name: 'Search', exact: true });
      if (this.debug) await this.takeScreenshot(`before_search_${hotelName}`);
      await searchButton.click();

      const hotelResultLocator = dialogLocator.getByText(hotelName, { exact: true });
      await hotelResultLocator.waitFor({ state: 'visible', timeout: 30000 });
      await hotelResultLocator.click();

      const selectButton = dialogLocator.getByRole('button', { name: 'Select' });
      if (this.debug) await this.takeScreenshot(`before_select_${hotelName}`);
      await selectButton.click();

      await dialogLocator.waitFor({ state: 'hidden', timeout: 15000 });
      await hotelLocator.waitFor({ state: 'visible', timeout: 45000 });
      console.log(`Successfully switched to ${hotelName}.`);
    } catch (error) {
      if (error.message.includes('Target page, context or browser has been closed')) {
        throw new SessionExpiredError('Browser closed during hotel switch.');
      }
      throw error; // Re-throw other errors
    }
  }

  async downloadReservationCSV(roomNumber, startDate, endDate, property = '') {
    try {
      const page = this.page;

      const is404 = await page.getByText('Error 404--Not Found').isVisible({ timeout: 2000 }).catch(() => false);
      if (is404) {
        console.log('404 Error page detected. Recovering by navigating to Manage Reservations...');
        await this.navigateToManageReservation(page);
      }

      const arrivalFromInput = page.getByRole('textbox', { name: 'Arrival From' });
      if (!await arrivalFromInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        const modifyButton = page.getByRole('link', { name: 'Modify Search Criteria' });
        try {
          await modifyButton.waitFor({ state: 'visible', timeout: 10000 });
          await modifyButton.click({ force: true });
          await page.waitForTimeout(1500);
        } catch (e) {
          console.log('Could not find search form or modify button. Re-navigating...');
          await this.navigateToManageReservation(page);
        }
      }

      const arrivalFrom = page.getByRole('textbox', { name: 'Arrival From' });
      await arrivalFrom.waitFor({ state: 'visible', timeout: 30000 });
      await arrivalFrom.click();
      await arrivalFrom.fill(startDate);
      await page.waitForTimeout(400);

      const arrivalTo = page.getByRole('textbox', { name: 'Arrival To' });
      await arrivalTo.waitFor({ state: 'visible', timeout: 30000 });
      await arrivalTo.click();
      await arrivalTo.fill(endDate);
      await page.waitForTimeout(400);

      const roomInput = page.getByRole('textbox', { name: 'Room' }).nth(0);
      await roomInput.waitFor({ state: 'visible', timeout: 30000 });
      await roomInput.click();
      await roomInput.fill(roomNumber);
      await page.waitForTimeout(400);

      const searchButton = page.getByRole('button', { name: 'Search' }).nth(1);
      await searchButton.waitFor({ state: 'visible', timeout: 30000 });
      await searchButton.click({ force: true });

      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(this.baseWait);

      try {
        await page.locator('table:has-text("Confirmation Number")').first().waitFor({ state: 'visible', timeout: 30000 });
      } catch (e) {
        // Silent
      }

      const noResults = page.locator('text="You have no search results yet."');
      if (await noResults.isVisible({ timeout: 5000 }).catch(() => false)) {
        const emptyPath = path.join(__dirname, 'downloads', `${property}-${roomNumber}.csv`);
        fs.writeFileSync(emptyPath, 'No reservations found');
        return emptyPath;
      }

      const viewOptions = page.getByRole('link', { name: 'View Options' });
      await viewOptions.waitFor({ state: 'visible', timeout: 30000 });
      await viewOptions.click({ force: true });
      await page.waitForTimeout(1500);

      const exportMenu = page.getByRole('menuitem', { name: 'Export' });
      await exportMenu.waitFor({ state: 'visible', timeout: 30000 });
      await exportMenu.click({ force: true });
      await page.waitForTimeout(1500);

      await page.locator('label:has-text("CSV")').first().click({ force: true });
      await page.waitForTimeout(1000);

      const filenameInput = page.getByRole('textbox', { name: 'File Name' });
      await filenameInput.waitFor({ state: 'visible', timeout: 30000 });
      await filenameInput.click();
      await filenameInput.fill(`${property}-${roomNumber}`);
      await page.waitForTimeout(400);

      const exportButton = page.getByRole('button', { name: 'Export' }).last();
      await exportButton.waitFor({ state: 'visible', timeout: 30000 });

      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
      await exportButton.click({ force: true });
      
      const download = await downloadPromise;
      const savePath = path.join(__dirname, 'downloads', `${property}-${roomNumber}.csv`);
      await download.saveAs(savePath);
      await page.waitForTimeout(1500);

      return savePath;
    } catch (error) {
      if (error.message.includes('Target page, context or browser has been closed')) {
        throw new SessionExpiredError(`Browser closed during download for room ${roomNumber}.`);
      }
      throw error; // Re-throw other non-session errors
    }
  }

  async takeScreenshot(name) {
    if (!this.debug || !this.page || this.page.isClosed()) return;
    const screenshotPath = path.join(__dirname, 'downloads', `debug_${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  }

  async navigateToManageReservation(page) {
    try {
      const bookingsMenu = page.locator('div[role="menuitem"][aria-label="Bookings"]');
      await bookingsMenu.waitFor({ state: 'visible', timeout: 30000 });
      await bookingsMenu.click();
      await page.waitForTimeout(1000);

      const reservationsSub = page.locator('tr[role="menuitem"] td:has-text("Reservations")').first();
      await reservationsSub.waitFor({ state: 'visible', timeout: 10000 });
      await reservationsSub.click();
      await page.waitForTimeout(1000);

      const manageRes = page.locator('tr[role="menuitem"] td:has-text("Manage Reservation")').first();
      await manageRes.waitFor({ state: 'visible', timeout: 10000 });
      await manageRes.click();
      await page.waitForTimeout(1500);
    } catch (error) {
      console.log('UI menu navigation failed. Attempting direct URL navigation...');
      await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/pages/reservation/manageReservation', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close().catch(e => console.error("Error closing browser:", e.message));
      this.browser = null;
    }
  }
}

// THIS IS THE KEY CHANGE: Exporting an object with named properties.
module.exports = { OperaExtractor, SessionExpiredError };