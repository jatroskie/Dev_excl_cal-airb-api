const path = require('path');
const fs = require('fs').promises;

class OperaCloudExtractor {
  constructor(page, context, browser, launchBrowser, loginToOperaCloud) {
    this.page = page;
    this.context = context;
    this.browser = browser;
    this.launchBrowser = launchBrowser;
    this.loginToOperaCloud = loginToOperaCloud; // Store the login function
    this.downloadPath = path.join(__dirname, 'downloads');
    this.failureCount = 0;
    this.maxFailuresBeforeRestart = 1;
    this.maxAttempts = 2;
    
    // Centralized wait times (in milliseconds)
    this.waitTimes = {
      shortWait: 1000,          // 1 second for minor waits
      standardWait: 2000,       // 2 seconds for standard operations
      loadWait: 3000,           // 3 seconds for UI loading
      navigationWait: 5000,     // 5 seconds for page navigation
      exportActionWait: 1500,   // 1.5 seconds for export actions
      elementWait: 5000,        // 5 seconds for element visibility/clickability
      networkWait: 30000,       // 30 seconds for network operations
      downloadWait: 60000       // 60 seconds for file downloads
    };
  }

  async downloadReservationCSV(roomNumber, startDate, endDate, attempt = 1, resumeStep = 'start') {
    try {
      // IMPORTANT: Commenting out refreshPage call that was causing issues
      // await this.refreshPage(); // <-- THIS LINE WAS CAUSING THE PROBLEM

      if (!this.page || this.page.isClosed()) {
        if (attempt > this.maxAttempts) {
          throw new Error('Max retry attempts reached for reopening page');
        }
        console.log(`Page closed unexpectedly for room ${roomNumber}, attempt ${attempt} of ${this.maxAttempts}, reopening...`);
        this.page = await this.context.newPage();
        await this.ensureLoggedIn();
        // Always start from the beginning if page was closed
        resumeStep = 'start';
      }

      // Step 1: Navigate to main interface or Manage Reservation screen
      if (resumeStep === 'start') {
        console.log(`Starting download process for room ${roomNumber}...`);
        
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
        const isManageReservationScreen = await this.page.getByRole('heading', { name: 'Manage Reservation' }).isVisible({ timeout: this.waitTimes.elementWait }).catch(() => false);
        if (!isManageReservationScreen) {
          const bookingsMenu = this.page.getByRole('link', { name: 'Bookings' });
          await bookingsMenu.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
          console.log('Bookings menu item found and visible.');
          const isEnabled = await bookingsMenu.isEnabled();
          if (!isEnabled) throw new Error('Bookings menu item is not enabled.');
          console.log('Bookings menu item is enabled.');

          await this.page.waitForLoadState('networkidle');

          console.log('Clicking Bookings menu...');
          await bookingsMenu.click();
          console.log('Bookings menu clicked successfully.');
          await this.page.waitForTimeout(this.waitTimes.standardWait);

          console.log('Clicking Reservations submenu...');
          const reservationsMenu = this.page.locator('[id="pt1\\:oc_pg_pt\\:dm1\\:odec_drpmn_mb_grp\\:1\\:odec_drpmn_mb_mn_grp\\:0\\:odec_drpmn_mb_mn_si"]').getByText('Reservations', { exact: true });
          await reservationsMenu.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
          console.log('Reservations menu item found and visible.');
          const isReservationsEnabled = await reservationsMenu.isEnabled();
          if (!isReservationsEnabled) throw new Error('Reservations menu item is not enabled.');
          await reservationsMenu.click();
          console.log('Reservations submenu clicked successfully.');
          await this.page.waitForTimeout(this.waitTimes.standardWait);

          console.log('Clicking Manage Reservation...');
          const manageReservation = this.page.getByText('Manage Reservation', { exact: true });
          await manageReservation.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
          console.log('Manage Reservation item found and visible.');
          const isManageEnabled = await manageReservation.isEnabled();
          if (!isManageEnabled) throw new Error('Manage Reservation item is not enabled.');
          await manageReservation.click();
          await this.page.waitForLoadState('networkidle');
          await this.page.getByRole('heading', { name: 'Manage Reservation' }).waitFor({ timeout: this.waitTimes.networkWait });
          console.log('Manage Reservation clicked successfully.');
        } else {
          console.log('Already on Manage Reservation screen, skipping navigation.');
          await this.page.getByRole('link', { name: 'Modify Search Criteria' }).click();
          console.log('Modify Search Criteria clicked...');
          await this.page.waitForTimeout(this.waitTimes.standardWait);
          await this.page.waitForLoadState('networkidle');
        }
        
        resumeStep = 'search';
      }

      // Step 2: Search for the reservation
      if (resumeStep === 'search') {
        console.log(`Searching for room ${roomNumber}...`);
        const roomInput = this.page.getByRole('textbox', { name: 'Room', exact: true });
        await roomInput.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        await roomInput.click();
        await roomInput.fill(roomNumber);
        
        const arrivalFromInput = this.page.getByRole('textbox', { name: 'Arrival From' });
        await arrivalFromInput.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
        console.log('Arrival From input found, clicking to activate...');
        await arrivalFromInput.click();
        console.log('Arrival From input found, filling...');
        await arrivalFromInput.fill(startDate);

        const arrivalToInput = this.page.getByRole('textbox', { name: 'Arrival To' });
        await arrivalToInput.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
        console.log('Arrival To input found, clicking to activate...');
        await arrivalToInput.click();
        console.log('Arrival To input found, filling...');
        await arrivalToInput.fill(endDate);

        console.log('Clicking Search button...');
        const searchButton = this.page.locator('.odec-search-switcher-search-button');
        await searchButton.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        const isSearchEnabled = await searchButton.isEnabled();
        if (!isSearchEnabled) throw new Error('Search button is not enabled.');
        await searchButton.click();
        console.log('Search button clicked successfully.');
        
        // Wait for search results to load
        await this.page.waitForLoadState('networkidle', { timeout: this.waitTimes.networkWait });
        
        resumeStep = 'export';
      }

      // Step 3: Export options
      if (resumeStep === 'export') {
        // Click on View Options
        const viewOptionsButton = this.page.getByRole('link', { name: 'View Options' });
        await viewOptionsButton.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        await viewOptionsButton.click();
        console.log('View Options clicked...');
        
        // Add a wait for menu to stabilize
        await this.page.waitForTimeout(this.waitTimes.loadWait);
        
        // Click on Export
        const exportOption = this.page.getByText('Export').first();
        await exportOption.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        await exportOption.click();
        console.log('Export clicked...');
        
        await this.page.waitForTimeout(this.waitTimes.loadWait);
        
        // Click on CSV
        const csvOption = this.page.getByText('CSV', { exact: true }).first();
        await csvOption.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        await csvOption.click();
        console.log('CSV clicked...');
        
        // Wait for the file name dialog
        await this.page.waitForTimeout(this.waitTimes.loadWait);
        await this.page.waitForLoadState('networkidle');
        
        resumeStep = 'download';
      }

      // Step 4: Download file
      if (resumeStep === 'download') {
        // Find the File Name input
        const fileNameInput = this.page.getByRole('textbox', { name: 'File Name' });
        await fileNameInput.waitFor({ state: 'visible', timeout: this.waitTimes.elementWait });
        
        // Click on the File Name textbox
        await fileNameInput.click();
        // Fill in the File Name textbox with the room number
        await fileNameInput.fill(roomNumber);
        console.log('Entered file name as room number...');
        
        // Wait after filling the filename
        await this.page.waitForTimeout(this.waitTimes.exportActionWait);
        
        // Set up download listener before clicking export
        const downloadPromise = this.page.waitForEvent('download', { timeout: this.waitTimes.downloadWait });

        // Click the final Export button
        const exportButton = this.page.getByRole('button', { name: 'Export', exact: true }).first();
        await exportButton.waitFor({ state: 'visible', timeout: this.waitTimes.elementWait });
        await exportButton.click();
        console.log('Export (download) button clicked...');
        
        // Now wait for the download to complete
        const download = await downloadPromise;
        console.log('Download started, waiting for completion...');

        // Make sure download directory exists
        await fs.mkdir(this.downloadPath, { recursive: true });
        
        // Generate filename and full path
        const filePath = path.join(this.downloadPath, `${roomNumber}_reservations.csv`);
        
        try {
          // Wait for download to complete and save file with retry logic
          await this.saveDownloadWithRetry(download, filePath);
          console.log(`Downloaded CSV for room ${roomNumber} to ${filePath}`);
        } catch (saveError) {
          console.error(`Failed to save download for room ${roomNumber}: ${saveError.message}`);
          throw saveError;
        }
      }

      this.failureCount = 0;
      return path.join(this.downloadPath, `${roomNumber}_reservations.csv`);
    } catch (error) {
      this.failureCount++;
      console.error(`Reservation CSV download failed for room ${roomNumber}: ${error.message}`);
      
      // Take screenshot for debugging
      const errorPath = path.join(this.downloadPath, `error_${roomNumber}_${Date.now()}.png`);
      try {
        if (this.page && !this.page.isClosed()) {
          await this.page.screenshot({ path: errorPath, fullPage: true });
          console.log(`Saved error screenshot to ${errorPath}`);
        }
      } catch (screenshotError) {
        console.error(`Failed to take screenshot: ${screenshotError.message}`);
      }

      // Determine which step to resume from based on error
      let nextResumeStep = 'start'; // Default to starting over
      
      if (error.message.includes('View Options') || error.message.includes('Export')) {
        nextResumeStep = 'export';
      } else if (error.message.includes('Search button') || error.message.includes('Room') || 
                 error.message.includes('Arrival From') || error.message.includes('Arrival To')) {
        nextResumeStep = 'search';
      } else if (error.message.includes('File Name') || error.message.includes('download')) {
        nextResumeStep = 'download';
      }
      
      // Restart browser if too many failures
      if (this.failureCount >= this.maxFailuresBeforeRestart) {
        console.log('Too many failures, restarting full browser...');
        await this.restartBrowser();
        this.failureCount = 0;
        nextResumeStep = 'start'; // Always start from beginning after browser restart
      }
      
      // Retry if not exceeding max attempts
      if (attempt < this.maxAttempts) {
        console.log(`Retrying for room ${roomNumber}, attempt ${attempt + 1} of ${this.maxAttempts} resuming from ${nextResumeStep}...`);
        await this.page.waitForTimeout(this.waitTimes.navigationWait);
        return await this.downloadReservationCSV(roomNumber, startDate, endDate, attempt + 1, nextResumeStep);
      }
      
      throw error;
    }
  }

  // Helper method to save download with retry
  async saveDownloadWithRetry(download, filePath, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await download.saveAs(filePath);
        // Verify file was created
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          return true;
        }
        console.warn(`Download saved but file is empty (${stats.size} bytes), retrying...`);
      } catch (error) {
        lastError = error;
        console.warn(`Download save attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, this.waitTimes.standardWait * attempt));
      }
    }
    throw new Error(`Failed to save download after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async ensureLoggedIn() {
    console.log('Ensuring logged in...');
    try {
      const currentUrl = this.page.url();
      console.log(`Current URL in ensureLoggedIn: ${currentUrl}`);
      if (!currentUrl.includes('opera-cloud-index')) {
        console.log('Not on the main interface, redirecting to dashboard...');
        await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { waitUntil: 'networkidle' });
        await this.page.waitForURL(/opera-cloud-index/, { timeout: this.waitTimes.networkWait });
        await this.page.getByRole('link', { name: 'Bookings' }).waitFor({ timeout: this.waitTimes.networkWait });
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
      // Instead of navigating to a new page which causes a full refresh,
      // perform a lighter interaction that won't trigger a page reload
      if (!this.page || this.page.isClosed()) {
        console.error('Page is closed, cannot keep session alive. Attempting to recover...');
        await this.restartBrowser();
        return;
      }

      // Check if we're still on the main interface
      const currentUrl = this.page.url();
      console.log(`Current URL in keepSessionAlive: ${currentUrl}`);
      
      // Look for a safe element to interact with (like clicking a tab or expanding a menu)
      const bookingsMenuVisible = await this.page.getByRole('link', { name: 'Bookings' })
        .isVisible({ timeout: this.waitTimes.shortWait })
        .catch(() => false);
      
      if (bookingsMenuVisible) {
        // Just move the mouse over the element to trigger activity without clicking
        await this.page.getByRole('link', { name: 'Bookings' }).hover();
        console.log('Hovered over Bookings menu to keep session alive.');
      } else {
        // If we can't find a safe element to interact with, perform a light action
        // Execute a harmless JavaScript in page context to trigger session activity
        await this.page.evaluate(() => {
          console.log('Session keep-alive ping: ' + new Date().toISOString());
          return document.title; // Just get the title without changing anything
        });
        console.log('Executed lightweight JavaScript to keep session alive.');
      }
    } catch (error) {
      console.error('Error in keepSessionAlive:', error.message);
      // Don't throw the error here - just log it and continue
    }
  }

  // Fix refreshPage method - IMPORTANT UPDATE
  async refreshPage() {
    console.log('Refreshing page between room processing...');
    try {
      if (!this.page || this.page.isClosed()) {
        console.error('Page is closed, cannot refresh. Will attempt recovery in next steps.');
        return;
      }

      // Instead of using page.reload() which causes a full navigation,
      // use a lighter approach to reset the UI state
      
      // Check if we're on the Manage Reservation screen
      const isManageReservationScreen = await this.page.getByRole('heading', { name: 'Manage Reservation' })
        .isVisible({ timeout: this.waitTimes.shortWait })
        .catch(() => false);
      
      if (isManageReservationScreen) {
        // If we're already on the Manage Reservation screen, just click Modify Search Criteria
        // which resets the search form without a full page reload
        const modifySearchBtn = this.page.getByRole('link', { name: 'Modify Search Criteria' });
        const modifyBtnVisible = await modifySearchBtn.isVisible({ timeout: this.waitTimes.shortWait }).catch(() => false);
        
        if (modifyBtnVisible) {
          console.log('Clicking Modify Search Criteria to reset search form...');
          await modifySearchBtn.click();
          await this.page.waitForTimeout(this.waitTimes.standardWait);
          await this.page.waitForLoadState('networkidle');
          console.log('Search form reset successfully.');
          return;
        }
      }
      
      // If we're not on the Manage Reservation screen or can't find the Modify button,
      // use keepSessionAlive as a safer alternative to a full page reload
      await this.keepSessionAlive();
      console.log('Used keepSessionAlive as alternative to full page refresh.');
    } catch (error) {
      console.error('Error refreshing page:', error.message);
      // Don't throw the error - just log it
    }
  }

  async restartBrowser() {
    console.log('Restarting full browser...');
    
    // Close existing browser if it exists
    if (this.browser) {
      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } catch (err) {
        console.log('Error closing browser:', err.message);
      }
    }
    
    try {
      // Use the provided loginToOperaCloud function for proper login
      if (this.loginToOperaCloud) {
        const result = await this.loginToOperaCloud();
        
        // Update class properties
        this.browser = result.browser;
        this.context = result.context;
        this.page = result.page;
        
        console.log('Browser successfully restarted with proper login flow');
      } else {
        // Fallback to basic browser launch if loginToOperaCloud not available
        const result = await this.launchBrowser();
        
        // Update class properties
        this.browser = result.browser;
        this.context = result.context;
        this.page = result.page;
        
        console.log('Browser restarted with basic launch (no login)');
      }
      return true;
    } catch (error) {
      console.error('Failed to restart browser:', error.message);
      return false;
    }
  }
}

module.exports = OperaCloudExtractor;