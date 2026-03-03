// extractor.js - Added generalized switchHotel method; processRooms now takes property for filename prefix
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login');

class OperaExtractor {
  constructor(headless = true, debug = false) {
    this.headless = headless;
    this.debug = debug;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.failedRooms = [];
    this.baseWait = this.headless ? 5000 : 3000; // Faster base: 5s headless, 3s debug
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
    await page.waitForTimeout(5000); // Reduced from 7000 for faster
  }

  async switchHotel(hotelName, hotelCode) {
    const page = this.page;
    const correctHotelText = `${hotelCode} - ${hotelName}`; // e.g., 'WFV - Waterfront Village' or 'LAW - Lawhill Apartments'
    const hotelLocator = page.getByText(correctHotelText);
    if (await hotelLocator.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log(`Already on correct hotel: ${hotelName}.`);
      return;
    }

    console.log(`Switching to ${hotelName}...`);
    // Menu click from script
    const menuLocator = page.locator('[id="pt1\\:oc_pg_pt\\:ode_pg_mnhdr_rght_cntnt_lnk"]');
    await menuLocator.waitFor({ state: 'visible', timeout: 30000 });
    await menuLocator.click();

    // Change Location
    const changeLocation = page.getByRole('link', { name: 'Change Location' });
    await changeLocation.waitFor({ state: 'visible', timeout: 30000 });
    await changeLocation.click();

    // Select hotel by text
    const hotelOption = page.getByText(hotelName);
    await hotelOption.waitFor({ state: 'visible', timeout: 30000 });
    await hotelOption.click();

    // Select button
    const selectButton = page.getByRole('button', { name: 'Select' });
    await selectButton.waitFor({ state: 'visible', timeout: 30000 });
    await selectButton.click();

    // Wait for switch and verify
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    if (await hotelLocator.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log(`Successfully switched to ${hotelName}.`);
    } else {
      throw new Error(`Failed to switch to ${hotelName}.`);
    }
  }

  async downloadReservationCSV(roomNumber, startDate, endDate, slowMode = false, property = '') {
    const page = this.page;
    const currentUrl = await page.url();

    if (!currentUrl.includes('manageReservation')) {
      await this.navigateToManageReservation(page);
    } else {
      const modifyButton = page.getByRole('link', { name: 'Modify Search Criteria' });
      try {
        await modifyButton.waitFor({ state: 'visible', timeout: 30000 });
        await modifyButton.click({ force: true });
        await page.waitForTimeout(2000); // Reduced from 3000
      } catch {
        // Silent
      }
    }

    const arrivalFrom = page.getByRole('textbox', { name: 'Arrival From' });
    await arrivalFrom.waitFor({ state: 'visible', timeout: 30000 });
    await arrivalFrom.click();
    await arrivalFrom.fill(startDate);
    await page.waitForTimeout(500); // Faster human-like delay

    const arrivalTo = page.getByRole('textbox', { name: 'Arrival To' });
    await arrivalTo.waitFor({ state: 'visible', timeout: 30000 });
    await arrivalTo.click();
    await arrivalTo.fill(endDate);
    await page.waitForTimeout(500);

    const roomInput = page.getByRole('textbox', { name: 'Room' }).nth(0);
    await roomInput.waitFor({ state: 'visible', timeout: 30000 });
    await roomInput.click();
    await roomInput.fill(roomNumber);
    await page.waitForTimeout(500);

    const searchButton = page.getByRole('button', { name: 'Search' }).nth(1);
    await searchButton.waitFor({ state: 'visible', timeout: 30000 });
    await searchButton.click({ force: true });

    // Wait for results: networkidle + adjustable timeout
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    const resultsWait = slowMode ? this.baseWait * 1.5 : this.baseWait;
    await page.waitForTimeout(resultsWait);

    try {
      await page.locator('table:has-text("Confirmation Number")').first().waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      // Silent warn
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
    await page.waitForTimeout(2000); // Reduced

    const exportMenu = page.getByRole('menuitem', { name: 'Export' });
    await exportMenu.waitFor({ state: 'visible', timeout: 30000 });
    await exportMenu.click({ force: true });
    await page.waitForTimeout(2000);

    let csvLocator = page.locator('label:has-text("CSV"), *:text("CSV")').first();
    const alternativeCsvSelectors = [
      'a:has-text("CSV")',
      'button:has-text("CSV")',
      '.button:has-text("CSV")',
      'text="CSV"'
    ];
    try {
      await csvLocator.waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      for (const sel of alternativeCsvSelectors) {
        csvLocator = page.locator(sel);
        if (await csvLocator.count() > 0) break;
      }
    }
    await csvLocator.click({ force: true });
    await page.waitForTimeout(1500); // Reduced

    const filenameInput = page.getByRole('textbox', { name: 'File Name' });
    await filenameInput.waitFor({ state: 'visible', timeout: 30000 });
    await filenameInput.click();
    await filenameInput.fill(`${property}-${roomNumber}`);
    await page.waitForTimeout(500);

    const exportButton = page.getByRole('button', { name: 'Export' }).last();
    await exportButton.waitFor({ state: 'visible', timeout: 30000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    const newPagePromise = this.context.waitForEvent('page', { timeout: 30000 }).catch(() => null);
    await exportButton.click({ force: true });
    await page.waitForTimeout(3000); // Reduced from 5000

    let download = await downloadPromise.catch(() => null);
    if (!download) {
      const newPage = await newPagePromise;
      if (newPage) {
        await newPage.waitForLoadState('networkidle', { timeout: 60000 });
        await newPage.waitForTimeout(5000); // Reduced from 7000
        download = await newPage.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      }
    }

    if (!download) throw new Error(`Download failed for ${roomNumber}`);

    const savePath = path.join(__dirname, 'downloads', `${property}-${roomNumber}.csv`);
    await download.saveAs(savePath);
    await page.waitForTimeout(2000); // Reduced post-save

    return savePath;
  }

  async takeScreenshot(name) {
    if (!this.debug) return; // Only in debug
    const screenshotPath = path.join(__dirname, 'downloads', `debug_${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
  }

  async navigateToManageReservation(page) {
    try {
      const bookingsMenu = page.locator('div[role="menuitem"][aria-label="Bookings"]');
      await bookingsMenu.waitFor({ state: 'visible', timeout: 30000 });
      await bookingsMenu.click();
      await page.waitForTimeout(1500); // Reduced

      const reservationsSub = page.locator('tr[role="menuitem"] td:has-text("Reservations")').first();
      await reservationsSub.waitFor({ state: 'visible', timeout: 10000 });
      await reservationsSub.click();
      await page.waitForTimeout(1500);

      const manageRes = page.locator('tr[role="menuitem"] td:has-text("Manage Reservation")').first();
      await manageRes.waitFor({ state: 'visible', timeout: 10000 });
      await manageRes.click();
      await page.waitForTimeout(2000); // Reduced
    } catch (error) {
      await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/pages/reservation/manageReservation', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    }
  }

  async processRooms(roomFile, startDate, endDate, batchSize = 5, property = '') {
    let rooms = fs.readFileSync(roomFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    if (this.debug) {
      rooms = rooms.slice(0, 10).concat(rooms.slice(-5));
    }

    let totalRooms = rooms.length;
    let completed = 0;
    let avgTimePerRoom = 0;
    const startTime = Date.now();

    for (let i = 0; i < rooms.length; i += batchSize) {
      const batch = rooms.slice(i, i + batchSize);
      for (const room of batch) {
        const roomStart = Date.now();
        let attempts = 0;
        let slowMode = false;
        while (attempts < 3) {
          try {
            const path = await this.downloadReservationCSV(room, startDate, endDate, slowMode, property);
            const fileSize = fs.statSync(path).size;
            if (fileSize < 100) { // Assume empty if small
              if (attempts < 2) {
                console.warn(`Empty CSV for ${room}, retrying with slower mode.`);
                slowMode = true;
                throw new Error('Empty CSV retry');
              } else {
                console.warn(`Final attempt failed for ${room}, empty CSV.`);
              }
            }
            console.log(`Downloaded ${path} for ${room}`);
            break;
          } catch (error) {
            attempts++;
            console.error(`Attempt ${attempts}/3 failed for ${room}: ${error.message}`);
            if (attempts < 3) await this.page.waitForTimeout(5000);
          }
        }
        if (attempts === 3) this.failedRooms.push(room);

        completed++;
        const roomTime = (Date.now() - roomStart) / 1000;
        avgTimePerRoom = ((avgTimePerRoom * (completed - 1)) + roomTime) / completed;
        const remaining = totalRooms - completed;
        const etaSeconds = remaining * avgTimePerRoom;
        const etaMinutes = Math.floor(etaSeconds / 60);
        const etaSecs = Math.floor(etaSeconds % 60);
        console.log(`Progress: ${completed}/${totalRooms} | Avg time/room: ${avgTimePerRoom.toFixed(2)}s | ETA: ${etaMinutes}m ${etaSecs}s`);
      }
      await this.page.waitForTimeout(2000); // Reduced batch delay
    }
    if (this.failedRooms.length) console.log(`Failed rooms: ${this.failedRooms.join(', ')}`);
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log(`Job completed in ${totalTime.toFixed(2)} minutes.`);
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = OperaExtractor;