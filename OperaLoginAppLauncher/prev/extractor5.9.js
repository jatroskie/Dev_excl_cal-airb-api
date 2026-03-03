const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

// Try to load csv-parser, but provide a fallback if it's not installed
let csv;
try {
  csv = require('csv-parser');
} catch (e) {
  // Create a simple fallback for CSV parsing
  console.log('csv-parser module not found, using simple CSV parser fallback');
  csv = {
    parser: function() {
      return {
        on: function(event, callback) {
          this.handlers = this.handlers || {};
          this.handlers[event] = callback;
          return this;
        },
        write: function(chunk) {
          const lines = chunk.toString().split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(v => v.trim());
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              this.handlers['data'](row);
            }
          }
          
          return this;
        },
        end: function() {
          if (this.handlers['end']) {
            this.handlers['end']();
          }
          return this;
        },
        emit: function(event, data) {
          if (this.handlers[event]) {
            this.handlers[event](data);
          }
          return this;
        }
      };
    }
  };
}

class OperaCloudExtractor {
  constructor(page, context, browser, launchBrowser, loginFunction) {
    this.browser = browser || null;
    this.context = context || null;
    this.page = page || null;
    this.launchBrowser = launchBrowser;
    this.loginFunction = loginFunction || loginToOperaCloud;
    this.isLoggedIn = page != null;
    this.currentBatchProgress = 0;
    this.totalRoomsProcessed = 0;
    this.totalRoomsToProcess = 0;
    this.successfulRooms = 0;
    this.failedRooms = new Set();
  }

  async initialize() {
    try {
      const result = await loginToOperaCloud();
      
      if (result.error) {
        console.error('Login failed in extractor initialization:', result.error.message);
        throw result.error;
      }
      
      this.browser = result.browser;
      this.context = result.context;
      this.page = result.page;
      this.isLoggedIn = true;
      
      console.log('Login process completed successfully.');
      
      // Configure download behavior
      console.log('Configuring download behavior...');
      
      // Ensure downloads directory exists
      const downloadsPath = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }
      
      return true;
    } catch (error) {
      console.error('Error during initialization:', error.message);
      await this.cleanup();
      throw error;
    }
  }
  
  async ensureLoggedIn() {
    try {
      console.log('Ensuring logged in...');
      if (!this.page || this.page.isClosed()) {
        console.log('Page is closed or null, creating a new page');
        this.page = await this.context.newPage();
      }
      
      try {
        // Check current URL to determine if we're on the main interface
        const currentUrl = await this.page.url();
        console.log('Current URL in ensureLoggedIn:', currentUrl);
        
        // If we're on PopupChecker, create a new page
        if (currentUrl.includes('PopupChecker')) {
          console.log('On PopupChecker page, creating new page for main dashboard');
          const newPage = await this.context.newPage();
          // Close the old page if it's still open
          if (this.page && !this.page.isClosed()) {
            await this.page.close().catch(e => console.log('Error closing old page:', e.message));
          }
          this.page = newPage;
        }
        
        // Navigate to main dashboard if needed
        if (!currentUrl.includes('operacloud') || currentUrl === 'about:blank' || currentUrl.includes('PopupChecker')) {
          console.log('Not on the main interface, redirecting to dashboard...');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          // Wait for the page to be fully loaded
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
          
          console.log('Redirected to main interface successfully.');
        } else {
          console.log('Already on the main interface.');
        }
      } catch (error) {
        if (error.message.includes('closed') || error.message.includes('detached')) {
          console.log('Page closed unexpectedly during URL check, creating new page');
          this.page = await this.context.newPage();
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout during recovery, continuing anyway');
          });
        } else {
          throw error;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring logged in:', error.message);
      throw error;
    }
  }

  async navigateToManageReservation(page) {
    try {
      console.log('Looking for Bookings menu item...');
      
      // Target the Bookings menu item using the class and role attributes you provided
      const bookingsMenuItem = page.locator('div.x2c8[role="menuitem"][aria-label="Bookings"]');
      
      // Wait for it to be visible
      await bookingsMenuItem.waitFor({ state: 'visible', timeout: 30000 });
      console.log('Bookings menu item found and visible.');
      
      // Click on the Bookings menu
      console.log('Clicking Bookings menu...');
      await bookingsMenuItem.click();
      console.log('Bookings menu clicked successfully.');
      await page.waitForTimeout(2000);
      
      // Look for Reservations submenu
      console.log('Clicking Reservations submenu...');
      const reservationsMenuItem = page.getByRole('menuitem').filter({ hasText: 'Reservations' });
      await reservationsMenuItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Reservations menu item found and visible.');
      await reservationsMenuItem.click();
      console.log('Reservations submenu clicked successfully.');
      await page.waitForTimeout(2000);
      
      // Look for Manage Reservation option
      console.log('Clicking Manage Reservation...');
      const manageReservationItem = page.getByRole('menuitem').filter({ hasText: 'Manage Reservation' });
      await manageReservationItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Manage Reservation item found and visible.');
      await manageReservationItem.click();
      console.log('Manage Reservation clicked successfully.');
      
      // Wait for the search page to load
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error('Error navigating to Manage Reservation:', error.message);
      console.log('Taking screenshot to debug navigation failure...');
      
      try {
        const downloadsPath = path.join(__dirname, 'downloads');
        await page.screenshot({ path: path.join(downloadsPath, 'navigation_failure.png') });
        
        // Try alternative navigation - look for any clickable elements with relevant text
        console.log('Trying alternative navigation approach...');
        
        // Try to find anchor with text "Bookings"
        const bookingsLink = page.locator('a:has-text("Bookings")');
        if (await bookingsLink.isVisible({ timeout: 5000 })) {
          console.log('Found Bookings link, clicking...');
          await bookingsLink.click();
          await page.waitForTimeout(2000);
        }
        
        // Look for any elements containing "Reservations"
        const reservationsElement = page.locator(':text("Reservations")').first();
        if (await reservationsElement.isVisible({ timeout: 5000 })) {
          console.log('Found Reservations element, clicking...');
          await reservationsElement.click();
          await page.waitForTimeout(2000);
        }
        
        // Look for any elements containing "Manage Reservation"
        const manageReservationElement = page.locator(':text("Manage Reservation")').first();
        if (await manageReservationElement.isVisible({ timeout: 5000 })) {
          console.log('Found Manage Reservation element, clicking...');
          await manageReservationElement.click();
          await page.waitForTimeout(3000);
        }
      } catch (fallbackError) {
        console.error('Alternative navigation also failed:', fallbackError.message);
      }
      
      console.log('Proceeding with current page state regardless of navigation result...');
    }
  }

  async verifyMainInterface(page, roomNumber) {
    try {
      // Fix: Use this.page as fallback if no page is provided
      const activePage = page || this.page;
      if (!activePage) {
        throw new Error("No page object available");
      }
      
      console.log(`Verifying main interface for room ${roomNumber}...`);
      
      try {
        // Check if we're on the main interface
        const currentUrl = await activePage.url();
        console.log('Current URL:', currentUrl);
        
        // If we're on the popup checker page, we need to:
        // 1. Create a new page in the same context
        // 2. Navigate to the main dashboard
        if (currentUrl.includes('PopupChecker')) {
          console.log('On popup checker page, creating new page for main interface...');
          // Create a new page in the same context
          this.page = await this.context.newPage();
          
          // Navigate to the main dashboard
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });
          
          // Wait for the page to load
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
          
          console.log('Created new page and navigated to main interface');
          
          // Use the new page for further operations
          return await this.verifyMainInterface(this.page, roomNumber);
        }
        
        if (!currentUrl.includes('operacloud')) {
          throw new Error('Not on the Opera Cloud interface');
        }
        
        // Check if we're on the Manage Reservation page
        if (currentUrl.includes('manageReservation')) {
          console.log('Already on Manage Reservation screen, skipping navigation.');
          return true;
        }
        
        // Just verify we're on the Opera Cloud interface without waiting for specific elements
        console.log('Successfully verified we are on the Opera Cloud interface');
        return true;
        
      } catch (error) {
        // If we got a "page closed" error, create a new page and try again
        if (error.message.includes('closed') || error.message.includes('detached')) {
          console.log('Page appears to be closed, creating a new page...');
          this.page = await this.context.newPage();
          await this.ensureLoggedIn();
          return await this.verifyMainInterface(this.page, roomNumber);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error verifying main interface: ${error.message}`);
      throw error;
    }
  }

  async downloadReservationCSV(roomNumber, startDateParam, endDateParam) {
    console.log(`Starting download process for room ${roomNumber}...`);
    try {
      // Fix: Use this.page instead of expecting a page parameter
      const page = this.page;
      if (!page) {
        throw new Error("No page object available");
      }
      
      // Verify we're on the main interface before proceeding
      await this.verifyMainInterface(page, roomNumber);
      
      // Navigate to the Manage Reservation screen if not already there
      const currentUrl = await page.url();
      if (!currentUrl.includes('Reservation')) {
        console.log("Navigating to Manage Reservation screen...");
        await this.navigateToManageReservation(page);
      } else {
        console.log("Already on Manage Reservation screen, skipping navigation.");
        // If already on the search screen, click "Modify Search Criteria" to prepare for a new search
        try {
          const modifySearchButton = page.getByRole('link', { name: 'Modify Search Criteria' });
          if (await modifySearchButton.isVisible({ timeout: 5000 })) {
            console.log("Modify Search Criteria clicked...");
            await modifySearchButton.click();
            await page.waitForTimeout(1000);
          }
        } catch (error) {
          console.log("Modify Search not visible or couldn't be clicked, continuing with search...");
        }
      }
      
      // Search for the room
      console.log(`Searching for room ${roomNumber}...`);
      
      // Fix: Use parameters if provided, otherwise use defaults
      const startDate = startDateParam || '01.01.2024';
      const endDate = endDateParam || '31.07.2025';
      
      try {
        // Fill Arrival From date
        const arrivalFromInput = page.getByRole('textbox', { name: 'Arrival From' });
        console.log("Arrival From input found, clicking to activate...");
        await arrivalFromInput.click();
        console.log("Arrival From input found, filling...");
        await arrivalFromInput.fill(startDate);
        
        // Fill Arrival To date
        const arrivalToInput = page.getByRole('textbox', { name: 'Arrival To' });
        console.log("Arrival To input found, clicking to activate...");
        await arrivalToInput.click();
        console.log("Arrival To input found, filling...");
        await arrivalToInput.fill(endDate);
        
        // Fill room number
        const roomInput = page.getByRole('textbox', { name: 'Room' });
        await roomInput.click();
        await roomInput.fill(roomNumber);
        
        // Click Search
        console.log("Clicking Search button...");
        const searchButton = page.getByRole('button', { name: 'Search' });
        await searchButton.click();
        console.log("Search button clicked successfully.");
        
        // Wait for search results or "no results" message
        await page.waitForTimeout(3000);
        
        // Check if there are no search results
        const noResultsElement = page.locator('text="You have no search results yet."');
        const hasNoResults = await noResultsElement.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (hasNoResults) {
          console.log(`No reservation results found for room ${roomNumber}, skipping CSV export.`);
          // Create an empty CSV file to indicate processing was completed
          const downloadPath = path.join(__dirname, 'downloads', `${roomNumber}_reservations.csv`);
          fs.writeFileSync(downloadPath, 'No reservations found for this room');
          console.log(`Created empty CSV file for room ${roomNumber} at ${downloadPath}`);
          return { success: true, message: `No reservations found for room ${roomNumber}`, path: downloadPath };
        }
        
        // If we have results, proceed with the export
        console.log("View Options clicked...");
        const viewOptionsLink = page.getByRole('link', { name: 'View Options' });
        await viewOptionsLink.waitFor({ state: 'visible', timeout: 5000 });
        await viewOptionsLink.click();
        
        console.log("Export clicked...");
        const exportLink = page.getByRole('menuitem', { name: 'Export' });
        await exportLink.waitFor({ state: 'visible', timeout: 5000 });
        await exportLink.click();
        
        console.log("CSV clicked...");
        const csvLink = page.getByRole('menuitem', { name: 'CSV' });
        await csvLink.waitFor({ state: 'visible', timeout: 5000 });
        await csvLink.click();
        
        // Wait for export dialog to appear
        const exportDialog = page.locator('div[role="dialog"]').filter({ hasText: 'Export' });
        await exportDialog.waitFor({ state: 'visible', timeout: 10000 });
        
        // Wait for file name input field and fill it
        const filenameInput = page.getByRole('textbox', { name: 'File Name' });
        await filenameInput.waitFor({ state: 'visible', timeout: 5000 });
        await filenameInput.fill(roomNumber);
        console.log("Entered file name as room number...");
        
        // Click Export button to start download
        const exportButton = page.getByRole('button', { name: 'Export' }).last();
        await exportButton.click();
        console.log("Export (download) button clicked...");
        
        // Wait for download to start and complete
        console.log("Download started, waiting for completion...");
        
        // Set up download path
        const downloadPath = path.join(__dirname, 'downloads', `${roomNumber}_reservations.csv`);
        
        // Wait for the download to complete (shown by a success message or dialog closing)
        await page.waitForTimeout(5000); // Give time for download to start
        
        // Check if download completed by checking for file existence
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          if (fs.existsSync(downloadPath)) {
            console.log(`Downloaded CSV for room ${roomNumber} to ${downloadPath}`);
            break;
          }
          await page.waitForTimeout(1000);
          attempts++;
        }
        
        if (attempts >= maxAttempts && !fs.existsSync(downloadPath)) {
          throw new Error(`Download failed or timed out for room ${roomNumber}`);
        }
        
        return { success: true, path: downloadPath };
        
      } catch (error) {
        console.error(`Reservation CSV download failed for room ${roomNumber}: ${error.message}`);
        
        // Take a screenshot of the error
        const errorScreenshotPath = path.join(__dirname, 'downloads', `error_${roomNumber}_${Date.now()}.png`);
        await page.screenshot({ path: errorScreenshotPath });
        console.log(`Saved error screenshot to ${errorScreenshotPath}`);
        
        throw error; // Rethrow to be handled by the caller
      }
    } catch (error) {
      throw error; // Rethrow to be handled by the caller
    }
  }

  async processRoomBatches(roomListFile, batchSize = 5) {
    try {
      // Read room data from CSV or text file
      const rooms = [];
      
      console.log(`Reading room data from ${roomListFile}...`);
      
      if (!fs.existsSync(roomListFile)) {
        throw new Error(`Room list file ${roomListFile} does not exist`);
      }
      
      // Determine file type and parse accordingly
      const fileExtension = path.extname(roomListFile).toLowerCase();
      
      if (fileExtension === '.csv') {
        // Use csv-parser if available, otherwise use the fallback
        if (typeof csv.parser === 'function') {
          // Using our fallback parser
          const fileContent = fs.readFileSync(roomListFile, 'utf8');
          const parser = csv.parser();
          parser
            .on('data', (data) => rooms.push(data))
            .on('end', () => {})
            .write(fileContent)
            .end();
        } else {
          // Using the real csv-parser
          await new Promise((resolve, reject) => {
            fs.createReadStream(roomListFile)
              .pipe(csv())
              .on('data', (data) => rooms.push(data))
              .on('end', () => resolve())
              .on('error', (error) => reject(error));
          });
        }
      } else {
        // Simple text file with one room per line
        const fileContent = fs.readFileSync(roomListFile, 'utf8');
        const lines = fileContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            // Assume the format is "RoomNumber,RoomType" or just "RoomNumber"
            const parts = trimmedLine.split(',');
            rooms.push({
              RoomNumber: parts[0].trim(),
              RoomType: parts.length > 1 ? parts[1].trim() : 'Unknown'
            });
          }
        }
      }
      
      console.log(`Read ${rooms.length} rooms from file.`);
      
      this.totalRoomsToProcess = rooms.length;
      
      if (rooms.length === 0) {
        console.log('No rooms to process. Check the input file format.');
        return {
          success: true,
          totalProcessed: 0,
          successfulProcessed: 0,
          failedRooms: []
        };
      }
      
      // Process rooms in batches
      const totalBatches = Math.ceil(rooms.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        console.log(`Processing batch ${batchIndex + 1} of ${totalBatches}`);
        
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, rooms.length);
        const currentBatch = rooms.slice(startIndex, endIndex);
        
        this.currentBatchProgress = 0;
        
        for (const room of currentBatch) {
          const roomNumber = room.RoomNumber;
          const roomType = room.RoomType || 'Unknown';
          
          console.log(`Processing room ${roomNumber} (Type: ${roomType})...`);
          
          let attempts = 0;
          const maxAttempts = 2;
          let success = false;
          
          while (attempts < maxAttempts && !success) {
            try {
              // Check if the page is still valid
              if (!this.page || this.page.isClosed()) {
                console.log(`Page closed unexpectedly for room ${roomNumber}, attempt ${attempts + 1} of ${maxAttempts}, reopening...`);
                await this.ensureLoggedIn();
              }
              
              // Fix: Pass just roomNumber instead of this.page, roomNumber
              const result = await this.downloadReservationCSV(roomNumber);
              console.log(`Successfully downloaded ${result.path || 'empty file for room'} ${roomNumber}`);
              success = true;
              this.successfulRooms++;
              
            } catch (error) {
              attempts++;
              console.log(`Attempt ${attempts}/${maxAttempts} failed for room ${roomNumber}: ${error.message}`);
              
              if (attempts < maxAttempts) {
                // If page is closed, reopen it
                if (!this.page || this.page.isClosed()) {
                  console.log(`Page closed unexpectedly for room ${roomNumber}, attempt ${attempts} of ${maxAttempts}, reopening...`);
                  await this.ensureLoggedIn();
                }
              } else {
                console.log('Too many failures, restarting full browser...');
                await this.restartBrowser();
                this.failedRooms.add(roomNumber);
              }
            }
          }
          
          this.currentBatchProgress++;
          this.totalRoomsProcessed++;
        }
        
        console.log(`Batch completed. Progress: ${this.successfulRooms}/${this.totalRoomsToProcess} rooms processed successfully.`);
      }
      
      // Report on any failed rooms
      if (this.failedRooms.size > 0) {
        console.log(`Failed to process ${this.failedRooms.size} rooms: ${Array.from(this.failedRooms).join(', ')}`);
      }
      
      console.log('All batches completed successfully!');
      
      return {
        success: true,
        totalProcessed: this.totalRoomsProcessed,
        successfulProcessed: this.successfulRooms,
        failedRooms: Array.from(this.failedRooms)
      };
      
    } catch (error) {
      console.error('Error processing room batches:', error.message);
      throw error;
    }
  }

  async restartBrowser() {
    console.log('Restarting full browser...');
    try {
      // Clean up existing resources
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(e => console.log('Error closing page:', e.message));
      }
      
      if (this.context) {
        await this.context.close().catch(e => console.log('Error closing context:', e.message));
      }
      
      if (this.browser) {
        await this.browser.close().catch(e => console.log('Error closing browser:', e.message));
      }
      
      // Login again to get a fresh session
      const result = await loginToOperaCloud();
      
      if (result.error) {
        console.error('Login failed during browser restart:', result.error.message);
        throw result.error;
      }
      
      this.browser = result.browser;
      this.context = result.context;
      this.page = result.page;
      this.isLoggedIn = true;
      
      console.log('Browser successfully restarted with proper login flow');
      return true;
      
    } catch (error) {
      console.error('Error restarting browser:', error.message);
      throw error;
    }
  }

  async cleanup() {
    console.log('Cleaning up resources...');
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
        console.log('Page closed successfully.');
      }
      
      if (this.context) {
        await this.context.close();
        console.log('Context closed successfully.');
      }
      
      if (this.browser) {
        await this.browser.close();
        console.log('Browser closed successfully.');
      }
      
    } catch (error) {
      console.error('Error during cleanup:', error.message);
    }
  }
  
  async keepSessionAlive() {
    console.log('Keeping session alive...');
    if (this.page && !this.page.isClosed()) {
      try {
        // Check current URL
        const currentUrl = await this.page.url();
        console.log(`Current URL for keep-alive: ${currentUrl}`);
        
        if (currentUrl.includes('operacloud')) {
          console.log('On OPERA Cloud interface - session is active');
          return true;
        } else {
          console.log('Not on OPERA Cloud interface, navigating back to main page...');
          await this.ensureLoggedIn();
          return true;
        }
      } catch (error) {
        console.error('Error in keep alive check:', error.message);
        throw error;
      }
    } else {
      console.log('Page is closed or null, cannot keep session alive');
      throw new Error('Page is not available for keep alive check');
    }
  }
}

module.exports = OperaCloudExtractor;