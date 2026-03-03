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
        await this.page.getByRole('link', { name: 'Modify Search Criteria' }).click();
        console.log('Modify Search Criteria clicked...');
        await this.page.waitForTimeout(2000);
        await this.page.waitForLoadState('networkidle');
      }
      console.log(`Searching for room ${roomNumber}...`);
      const roomInput = this.page.getByRole('textbox', { name: 'Room', exact: true });
      await roomInput.waitFor({ timeout: 15000, state: 'visible' });
      await roomInput.click();
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
      
      // Wait for search results to load
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
         
      // Click on View Options
      await this.page.getByRole('link', { name: 'View Options' }).click();
      console.log('View Options clicked...');
           
      // IMPROVED: Add a longer wait for menu to stabilize
      await this.page.waitForTimeout(3000);

      // Wait for dialog or menu to appear
      console.log('Waiting for export menu to fully load...');
      try {
        await this.page.waitForSelector('ul[role="menu"]', { timeout: 5000 });
      } catch (e) {
        console.log('Export menu not detected with selector, continuing anyway...');
      }

      // IMPROVED: Try multiple different approaches to click Export with longer timeouts
      try {
        // First attempt - using nth to select first Export option
        console.log('Trying first approach for Export...');
        await this.page.getByText('Export').nth(0).click({ timeout: 5000 });
        await this.page.waitForTimeout(3000); // Added longer wait after click
      } catch (err1) {
        console.log('First approach failed, trying second approach...');
        try {
          // Second attempt with role and exact text
          await this.page.getByRole('menuitem', { name: 'Export', exact: true }).click({ timeout: 5000 });
          await this.page.waitForTimeout(3000); // Added longer wait after click
        } catch (err2) {
          console.log('Second approach failed, trying third approach...');
          try {
            // Third attempt with more specific CSS selector
            await this.page.locator('li.xri a:has-text("Export")').first().click({ timeout: 5000 });
            await this.page.waitForTimeout(3000); // Added longer wait after click
          } catch (err3) {
            // Final fallback approach - use JavaScript click
            console.log('Using JavaScript click as fallback...');
            await this.page.evaluate(() => {
              // Find all elements containing the text "Export" and click the first one
              const elements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent.trim() === 'Export');
              if (elements.length > 0) elements[0].click();
            });
            await this.page.waitForTimeout(3000); // Added longer wait after click
          }
        }
      }
      
      console.log('Export clicked (or attempted), waiting...');
      
      // IMPROVED: Wait for the export dialog to appear
      console.log('Waiting for export dialog to fully load...');
      try {
        await this.page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
      } catch (e) {
        console.log('Export dialog not detected with selector, continuing anyway...');
      }
      
      // IMPROVED: Similar approach for CSV selection with longer timeouts
      try {
        // First attempt for CSV
        console.log('Trying first approach for CSV...');
        await this.page.getByText('CSV', { exact: true }).first().click({ timeout: 5000 });
        await this.page.waitForTimeout(3000); // Added longer wait after click
      } catch (csvErr1) {
        console.log('First CSV approach failed, trying second approach...');
        try {
          // Second attempt with role
          await this.page.getByRole('menuitem', { name: 'CSV', exact: true }).click({ timeout: 5000 });
          await this.page.waitForTimeout(3000); // Added longer wait after click
        } catch (csvErr2) {
          console.log('Second CSV approach failed, trying third approach...');
          try {
            // Third attempt with specific CSS
            await this.page.locator('li a:has-text("CSV")').first().click({ timeout: 5000 });
            await this.page.waitForTimeout(3000); // Added longer wait after click
          } catch (csvErr3) {
            // Final fallback - JavaScript click
            console.log('Using JavaScript click for CSV as fallback...');
            await this.page.evaluate(() => {
              const elements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent.trim() === 'CSV');
              if (elements.length > 0) elements[0].click();
            });
            await this.page.waitForTimeout(3000); // Added longer wait after click
          }
        }
      }
      
      console.log('CSV clicked (or attempted), waiting for dialog...');
      
      // IMPROVED: Wait longer for the file name dialog
      await this.page.waitForTimeout(3000);
      await this.page.waitForLoadState('networkidle');
      
      // IMPROVED: More robust way to wait for File Name input
      console.log('Waiting for file name dialog...');
      try {
        await this.page.waitForSelector('input[type="text"][id*="fileName"]', { timeout: 8000 });
      } catch (e) {
        console.log('File name input not detected with selector, trying to continue...');
      }
      
      // Multiple attempts to find the file name input
      let fileNameInput;
      try {
        fileNameInput = this.page.getByRole('textbox', { name: 'File Name' });
        await fileNameInput.waitFor({ state: 'visible', timeout: 8000 });
      } catch (e) {
        console.log('First attempt to find File Name input failed, trying alternative selector...');
        try {
          fileNameInput = this.page.locator('input[id*="fileName"]').first();
          await fileNameInput.waitFor({ state: 'visible', timeout: 8000 });
        } catch (e2) {
          console.log('Second attempt to find File Name input failed, trying JavaScript fallback...');
          // Try a JavaScript fallback to find and fill the input
          await this.page.evaluate((roomNum) => {
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
            const fileInput = inputs.find(input => 
              input.id.includes('fileName') || 
              input.name.includes('fileName') || 
              input.placeholder?.includes('File Name')
            );
            if (fileInput) {
              fileInput.value = roomNum;
              fileInput.dispatchEvent(new Event('input', { bubbles: true }));
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, roomNumber);
        }
      }

      // Only proceed with click and fill if we found the input element
      if (fileNameInput && await fileNameInput.isVisible().catch(() => false)) {
        // Click on the File Name textbox
        await fileNameInput.click();
        // Fill in the File Name textbox with the room number
        await fileNameInput.fill(roomNumber);
        console.log('Enter the file name as room number...');
      } else {
        console.log('Could not find File Name input visually, using JavaScript fallback instead');
      }
      
      // IMPROVED: Wait longer after filling the filename
      await this.page.waitForTimeout(2000);
      
      // Set up download listener before clicking export
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

      // IMPROVED: Flexible approach for final Export button with longer timeouts
      try {
        console.log('Trying first approach for Export button...');
        await this.page.getByRole('button', { name: 'Export', exact: true }).first().click({ timeout: 5000 });
        await this.page.waitForTimeout(2000); // Added wait after click
      } catch (expBtnErr1) {
        console.log('First Export button approach failed, trying second approach...');
        try {
          // Try with more specific selector
          await this.page.locator('button:has-text("Export")').first().click({ timeout: 5000 });
          await this.page.waitForTimeout(2000); // Added wait after click
        } catch (expBtnErr2) {
          // Last resort - JavaScript click
          console.log('Using JavaScript click for Export button as fallback...');
          await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
              .filter(btn => btn.textContent.includes('Export'));
            if (buttons.length > 0) buttons[0].click();
          });
          await this.page.waitForTimeout(2000); // Added wait after click
        }
      }
      
      console.log('Export (download) button clicked...');
      console.log('Waiting for download...');
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
        // If saving fails but download succeeded, try to use suggestedFilename as fallback
        if (download.suggestedFilename()) {
          const tempPath = path.join(this.downloadPath, download.suggestedFilename());
          const alternativePath = path.join(this.downloadPath, `${roomNumber}_reservations_alt.csv`);
          try {
            await download.saveAs(tempPath);
            // Rename the file to our desired name format
            await fs.rename(tempPath, alternativePath);
            console.log(`Saved download to alternative path: ${alternativePath}`);
            this.failureCount = 0;
            return alternativePath;
          } catch (altSaveError) {
            console.error(`Alternative save also failed: ${altSaveError.message}`);
            throw saveError; // Throw the original error
          }
        } else {
          throw saveError;
        }
      }

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

      // IMPROVED: Better error handling and longer wait before retry
      if (error.message.includes('Target page, context or browser has been closed') || 
          error.message.includes('Protocol error') ||
          error.message.includes('failed to save download') ||
          error.message.includes('strict mode violation') ||
          error.message.includes('waiting for') ||
          error.message.includes('timeout') ||  // Added timeout error
          error.message.includes('not visible') ||  // Added visibility error
          error.message.includes('detached')) {  // Added detached error
        console.log(`Retrying for room ${roomNumber}, attempt ${attempt + 1} of ${this.maxAttempts}...`);
        
        // IMPROVED: Longer pause before retry
        await this.page.waitForTimeout(5000);
        
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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