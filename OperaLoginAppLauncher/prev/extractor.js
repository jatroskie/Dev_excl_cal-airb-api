const path = require('path');
const fs = require('fs').promises;

class OperaCloudExtractor {
  constructor(page, context, browser, launchBrowser) {
    this.page = page;
    this.context = context;
    this.browser = browser;
    this.launchBrowser = launchBrowser; // Pass launchBrowser function
    this.downloadPath = path.join(__dirname, 'downloads');
    this.failureCount = 0;
    this.maxFailuresBeforeRestart = 3;
    this.maxAttempts = 2;
  }

  async downloadReservationCSV(roomNumber, startDate, endDate, attempt = 1) {
    try {
      if (!this.page || this.page.isClosed()) {
        if (attempt > this.maxAttempts) {
          throw new Error('Max retry attempts reached for reopening page');
        }
        console.log(`Page closed unexpectedly for room ${roomNumber}, attempt ${attempt} of ${this.maxAttempts}, reopening...`);
        this.page = await this.context.newPage();
        await this.ensureLoggedIn();
      }

      // Verify the page is on the main interface or Manage Reservation screen
      console.log(`Verifying main interface for room ${roomNumber}...`);
      const currentUrl = this.page.url();
      console.log(`Current URL: ${currentUrl}`);
      if (!currentUrl.includes('opera-cloud-index') && !currentUrl.includes('ManageReservation')) {
        console.log('Not on the main interface or Manage Reservation screen, redirecting...');
        await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });
        console.log(`Redirected to main interface. New URL: ${this.page.url()}`);
      }

      // Check if already on Manage Reservation screen
      const isManageReservationScreen = await this.page.getByRole('heading', { name: 'Manage Reservation' }).isVisible({ timeout: 10000 }).catch(() => false);
      if (!isManageReservationScreen) {
        const bookingsMenu = this.page.getByRole('link', { name: 'Bookings' });
        await bookingsMenu.waitFor({ timeout: 30000, state: 'visible' });
        console.log('Bookings menu item found and visible.');
        const isEnabled = await bookingsMenu.isEnabled();
        if (!isEnabled) throw new Error('Bookings menu item is not enabled.');
        console.log('Bookings menu item is enabled.');

        await this.page.waitForLoadState('networkidle');

        console.log('Clicking Bookings menu...');
        await bookingsMenu.click();
        console.log('Bookings menu clicked successfully.');
        await this.page.waitForTimeout(2000);

        console.log('Clicking Reservations submenu...');
        const reservationsMenu = this.page.locator('[id="pt1\\:oc_pg_pt\\:dm1\\:odec_drpmn_mb_grp\\:1\\:odec_drpmn_mb_mn_grp\\:0\\:odec_drpmn_mb_mn_si"]').getByText('Reservations', { exact: true });
        await reservationsMenu.waitFor({ timeout: 10000, state: 'visible' });
        console.log('Reservations menu item found and visible.');
        const isReservationsEnabled = await reservationsMenu.isEnabled();
        if (!isReservationsEnabled) throw new Error('Reservations menu item is not enabled.');
        await reservationsMenu.click();
        console.log('Reservations submenu clicked successfully.');
        await this.page.waitForTimeout(2000);

        console.log('Clicking Manage Reservation...');
        const manageReservation = this.page.getByText('Manage Reservation', { exact: true });
        await manageReservation.waitFor({ timeout: 10000, state: 'visible' });
        console.log('Manage Reservation item found and visible.');
        const isManageEnabled = await manageReservation.isEnabled();
        if (!isManageEnabled) throw new Error('Manage Reservation item is not enabled.');
        await manageReservation.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.getByRole('heading', { name: 'Manage Reservation' }).waitFor({ timeout: 30000 });
        console.log('Manage Reservation clicked successfully.');
      } else {
        console.log('Already on Manage Reservation screen, skipping navigation.');
        await this.page.waitForLoadState('networkidle');
      }

      console.log(`Searching for room ${roomNumber}...`);
      const roomInput = this.page.getByRole('textbox', { name: 'Room', exact: true });
      await roomInput.waitFor({ timeout: 15000, state: 'visible' });
      await roomInput.fill(roomNumber);

      // Use role-based locators for date fields with click and fill
      const arrivalFromInput = this.page.getByRole('textbox', { name: 'Arrival From' });
      await arrivalFromInput.waitFor({ timeout: 20000, state: 'visible' });
      console.log('Arrival From input found, clicking to activate...');
      await arrivalFromInput.click(); // Activate the input
      console.log('Arrival From input found, filling...');
      await arrivalFromInput.fill(startDate);

      const arrivalToInput = this.page.getByRole('textbox', { name: 'Arrival To' });
      await arrivalToInput.waitFor({ timeout: 20000, state: 'visible' });
      console.log('Arrival To input found, clicking to activate...');
      await arrivalToInput.click(); // Activate the input
      console.log('Arrival To input found, filling...');
      await arrivalToInput.fill(endDate);

      console.log('Clicking Search button...');
      const searchButton = this.page.locator('.odec-search-switcher-search-button');
      await searchButton.waitFor({ timeout: 15000, state: 'visible' });
      const isSearchEnabled = await searchButton.isEnabled();
      if (!isSearchEnabled) throw new Error('Search button is not enabled.');
      await searchButton.click();
      console.log('Search button clicked successfully.');

      console.log('Waiting for search results...');
      await this.page.getByRole('row', { name: roomNumber }).waitFor({ timeout: 30000 });

      console.log('Clicking export...');
      await this.page.getByRole('button', { name: 'Export' }).click();
      await this.page.getByRole('menuitem', { name: 'Export to CSV' }).waitFor({ timeout: 10000 });
      await this.page.getByRole('menuitem', { name: 'Export to CSV' }).click();

      console.log('Waiting for download...');
      const [download] = await Promise.all([
        this.page.waitForEvent('download', { timeout: 60000 }),
        this.page.getByRole('button', { name: 'Export' }).waitFor({ state: 'visible', timeout: 60000 })
      ]);

      const filePath = path.join(this.downloadPath, `${roomNumber}_reservations.csv`);
      await download.saveAs(filePath);
      console.log(`Downloaded CSV for room ${roomNumber} to ${filePath}`);

      this.failureCount = 0;
      return filePath;
    } catch (error) {
      this.failureCount++;
      console.error(`Reservation CSV download failed for room ${roomNumber}: ${error.message}`);
      const errorPath = path.join(this.downloadPath, `error_${roomNumber}_${Date.now()}.png`);
      try {
        if (this.page && !this.page.isClosed()) {
          await this.page.screenshot({ path: errorPath, fullPage: true });
          console.log(`Saved error screenshot to ${errorPath}`);
        }
      } catch (screenshotError) {
        console.error(`Failed to take screenshot: ${screenshotError.message}`);
      }

      if (error.message.includes('Target page, context or browser has been closed') || error.message.includes('Protocol error')) {
        console.log(`Retrying for room ${roomNumber}, attempt ${attempt + 1} of ${this.maxAttempts}...`);
        if (this.failureCount >= this.maxFailuresBeforeRestart) {
          console.log('Too many failures, restarting full browser...');
          await this.restartBrowser();
          this.failureCount = 0;
        }
        return await this.downloadReservationCSV(roomNumber, startDate, endDate, attempt + 1);
      }
      throw error;
    }
  }

  async ensureLoggedIn() {
    console.log('Ensuring logged in...');
    try {
      const currentUrl = this.page.url();
      console.log(`Current URL in ensureLoggedIn: ${currentUrl}`);
      if (!currentUrl.includes('opera-cloud-index')) {
        console.log('Not on the main interface, redirecting to dashboard...');
        await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });
        await this.page.waitForURL(/opera-cloud-index/, { timeout: 30000 });
        await this.page.getByRole('link', { name: 'Bookings' }).waitFor({ timeout: 30000 });
        console.log('Redirected to main interface successfully.');
      }
      console.log('Already on the main interface.');
    } catch (error) {
      console.error('Failed to ensure login:', error.message);
      throw error;
    }
  }

  async keepSessionAlive() {
    console.log('Keeping session alive...');
    try {
      await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });
      await this.page.getByRole('link', { name: 'Bookings' }).waitFor({ timeout: 30000 });
      console.log('Session kept alive.');
    } catch (error) {
      console.error('Failed to keep session alive:', error.message);
      throw error;
    }
  }

  async restartBrowser() {
    console.log('Restarting full browser...');
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      this.browser = await this.launchBrowser(); // Use the passed function
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
      await this.ensureLoggedIn();
      console.log('Browser restarted successfully.');
    } catch (error) {
      console.error('Failed to restart browser:', error.message);
      throw error;
    }
  }
}

module.exports = OperaCloudExtractor;