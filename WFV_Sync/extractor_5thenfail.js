// extractor.js - Full version with all methods, including processRooms and cleanup
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
  }

  async initialize() {
    const { browser, context, page } = await loginToOperaCloud(this.headless);
    this.browser = browser;
    this.context = context;
    this.page = page;
    // Add post-login stabilization from original: waitForNavigation or timeout
    try {
      await page.waitForNavigation({ timeout: 60000 });
    } catch (e) {
      console.log('Post-login navigation wait timeout, continuing.');
    }
    await page.waitForTimeout(7000); // From original delay before extractor
    if (this.debug) await this.takeScreenshot('after_login_stabilization');
  }

  async downloadReservationCSV(roomNumber, startDate, endDate) {
    const page = this.page;
    const currentUrl = await page.url();
    if (this.debug) console.log(`Current URL before navigation: ${currentUrl}`);

    if (!currentUrl.includes('manageReservation')) {
      await this.navigateToManageReservation(page);
    } else {
      // Click Modify Search Criteria if on results, with longer wait
      const modifyButton = page.getByRole('link', { name: 'Modify Search Criteria' });
      try {
        await modifyButton.waitFor({ state: 'visible', timeout: 30000 });
        await modifyButton.click({ force: true });
        await page.waitForTimeout(3000); // From original
        if (this.debug) await this.takeScreenshot(`modify_search_${roomNumber}`);
      } catch (e) {
        console.log('Modify Search Criteria not found or visible, proceeding.');
      }
    }

    // Fill dates and room with clicks, fills, and waits (from original)
    const arrivalFrom = page.getByRole('textbox', { name: 'Arrival From' });
    await arrivalFrom.waitFor({ state: 'visible', timeout: 30000 });
    await arrivalFrom.click();
    await arrivalFrom.fill(startDate);
    await page.waitForTimeout(1000); // Human-like delay

    const arrivalTo = page.getByRole('textbox', { name: 'Arrival To' });
    await arrivalTo.waitFor({ state: 'visible', timeout: 30000 });
    await arrivalTo.click();
    await arrivalTo.fill(endDate);
    await page.waitForTimeout(1000);

    const roomInput = page.getByRole('textbox', { name: 'Room' }).nth(0);
    await roomInput.waitFor({ state: 'visible', timeout: 30000 });
    await roomInput.click();
    await roomInput.fill(roomNumber);
    await page.waitForTimeout(1000);

    const searchButton = page.getByRole('button', { name: 'Search' }).nth(1);
    await searchButton.waitFor({ state: 'visible', timeout: 30000 });
    await searchButton.click({ force: true });
    if (this.debug) await this.takeScreenshot(`after_search_click_${roomNumber}`);

    // Extended wait for results to render: networkidle + timeout + wait for table or View Options
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => console.log('Network idle timeout after search, continuing.'));
    await page.waitForTimeout(7000); // Increased stabilization delay for results to load, inspired by original post-login delays
    try {
      // Wait for results table or View Options to confirm rendering
      await page.locator('table, div:has-text("Confirmation Number")').waitFor({ state: 'visible', timeout: 30000 });
      // Or alternatively wait for View Options if table not direct
      await page.getByRole('link', { name: 'View Options' }).waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      console.warn(`Results table or View Options not detected for ${roomNumber}, may be no results or slow load: ${e.message}`);
    }
    if (this.debug) await this.takeScreenshot(`after_search_results_render_${roomNumber}`);

    // Check for no results with longer timeout
    const noResults = page.locator('text="You have no search results yet."');
    try {
      await noResults.waitFor({ state: 'visible', timeout: 15000 }); // Extended for slow render
      console.log(`No results for ${roomNumber}, creating empty CSV.`);
      const emptyPath = path.join(__dirname, 'downloads', `${roomNumber}.csv`);
      fs.writeFileSync(emptyPath, 'No reservations found');
      return emptyPath;
    } catch {
      // Results present
    }

    // Export with robust waits and fallbacks
    const viewOptions = page.getByRole('link', { name: 'View Options' });
    await viewOptions.waitFor({ state: 'visible', timeout: 30000 });
    await viewOptions.click({ force: true });
    await page.waitForTimeout(3000); // From original
    if (this.debug) await this.takeScreenshot(`view_options_${roomNumber}`);

    const exportMenu = page.getByRole('menuitem', { name: 'Export' });
    await exportMenu.waitFor({ state: 'visible', timeout: 30000 });
    await exportMenu.click({ force: true });
    await page.waitForTimeout(3000);
    if (this.debug) await this.takeScreenshot(`export_menu_${roomNumber}`);

    // CSV selection with alternatives from original
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
    await page.waitForTimeout(2000);

    // File name with wait
    const filenameInput = page.getByRole('textbox', { name: 'File Name' });
    await filenameInput.waitFor({ state: 'visible', timeout: 30000 });
    await filenameInput.click();
    await filenameInput.fill(roomNumber);
    await page.waitForTimeout(1000);

    // Export button, setup for download or new page (enhanced from original)
    const exportButton = page.getByRole('button', { name: 'Export' }).last();
    await exportButton.waitFor({ state: 'visible', timeout: 30000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    const newPagePromise = this.context.waitForEvent('page', { timeout: 30000 }).catch(() => null);
    await exportButton.click({ force: true });
    await page.waitForTimeout(5000); // Longer delay for export processing
    if (this.debug) await this.takeScreenshot(`after_export_click_${roomNumber}`);

    let download = await downloadPromise.catch(() => null);
    if (!download) {
      console.log('No direct download, checking for new page or popup...');
      const newPage = await newPagePromise;
      if (newPage) {
        console.log('New page opened for export:', newPage.url());
        await newPage.waitForLoadState('networkidle', { timeout: 60000 });
        await newPage.waitForTimeout(7000); // From original stabilization delay
        download = await newPage.waitForEvent('download', { timeout: 30000 }).catch(() => null);
        if (this.debug) await newPage.screenshot({ path: path.join(__dirname, 'downloads', `new_page_export_${roomNumber}.png`), fullPage: true });
      }
    }

    if (!download) throw new Error(`Download failed for ${roomNumber} after extended waits`);

    const savePath = path.join(__dirname, 'downloads', `${roomNumber}.csv`);
    await download.saveAs(savePath);
    await page.waitForTimeout(3000); // Post-save delay
    console.log(`Saved CSV for ${roomNumber}: ${savePath}`);
    const fileSize = fs.statSync(savePath).size;
    if (fileSize === 0 || fileSize < 100) { // Check for near-empty
      console.warn(`Warning: CSV for ${roomNumber} seems empty (size: ${fileSize} bytes), may need manual check.`);
      if (this.debug) await this.takeScreenshot(`empty_csv_warning_${roomNumber}`);
    }

    return savePath;
  }

  async takeScreenshot(name) {
    const screenshotPath = path.join(__dirname, 'downloads', `debug_${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  }

  async navigateToManageReservation(page) {
    try {
      const bookingsMenu = page.locator('div[role="menuitem"][aria-label="Bookings"]');
      await bookingsMenu.waitFor({ state: 'visible', timeout: 30000 });
      await bookingsMenu.click();
      await page.waitForTimeout(2000);

      const reservationsSub = page.locator('tr[role="menuitem"] td:has-text("Reservations")').first();
      await reservationsSub.waitFor({ state: 'visible', timeout: 10000 });
      await reservationsSub.click();
      await page.waitForTimeout(2000);

      const manageRes = page.locator('tr[role="menuitem"] td:has-text("Manage Reservation")').first();
      await manageRes.waitFor({ state: 'visible', timeout: 10000 });
      await manageRes.click();
      await page.waitForTimeout(3000);
      if (this.debug) await this.takeScreenshot('after_navigation');
    } catch (error) {
      console.error('Navigation error, trying direct URL...');
      await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/pages/reservation/manageReservation', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      if (this.debug) await this.takeScreenshot('after_direct_nav');
    }
  }

  async processRooms(roomFile, startDate, endDate, batchSize = 5) {
    let rooms = fs.readFileSync(roomFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    if (this.debug) {
      rooms = rooms.slice(0, 10).concat(rooms.slice(-5));
      console.log(`Debug mode: Processing ${rooms.length} rooms (first 10 + last 5).`);
    }

    for (let i = 0; i < rooms.length; i += batchSize) {
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(rooms.length / batchSize)}`);
      const batch = rooms.slice(i, i + batchSize);
      for (const room of batch) {
        let attempts = 0;
        while (attempts < 3) {
          try {
            const path = await this.downloadReservationCSV(room, startDate, endDate);
            console.log(`Downloaded ${path} for ${room}`);
            break;
          } catch (error) {
            attempts++;
            console.error(`Attempt ${attempts}/3 failed for ${room}: ${error.message}`);
            if (this.debug) await this.takeScreenshot(`error_${room}_attempt${attempts}`);
            if (attempts < 3) await page.waitForTimeout(5000); // Delay before retry
          }
        }
        if (attempts === 3) this.failedRooms.push(room);
      }
      await page.waitForTimeout(3000); // Batch delay
    }
    if (this.failedRooms.length) console.log(`Failed rooms: ${this.failedRooms.join(', ')}`);
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = OperaExtractor;