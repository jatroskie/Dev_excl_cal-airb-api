const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { loginToOperaCloud } = require('./login3');

class OperaCloudExtractor {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
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
      
      // Check current URL to determine if we're on the main interface
      const currentUrl = this.page.url();
      console.log('Current URL in ensureLoggedIn:', currentUrl);
      
      // If we're not on the main interface (containing operacloud), go there
      if (!currentUrl.includes('operacloud') || currentUrl === 'about:blank') {
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
      
      return true;
    } catch (error) {
      console.error('Error ensuring logged in:', error.message);
      throw error;
    }
  }

  async navigateToManageReservation(page) {
    // Click on Bookings
    console.log('Bookings menu item found and visible.');
    const bookingsMenuItem = page.locator('#pt1\\:toggle');
    
    if (await bookingsMenuItem.isEnabled()) {
      console.log('Bookings menu item is enabled.');
      console.log('Clicking Bookings menu...');
      await bookingsMenuItem.click();
      console.log('Bookings menu clicked successfully.');
    
      // Click on Reservations
      console.log('Clicking Reservations submenu...');
      const reservationsMenuItem = page.getByRole('menuitem', { name: 'Reservations' });
      await reservationsMenuItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Reservations menu item found and visible.');
      await reservationsMenuItem.click();
      console.log('Reservations submenu clicked successfully.');
    
      // Click on Manage Reservation
      console.log('Clicking Manage Reservation...');
      const manageReservationItem = page.getByRole('menuitem', { name: 'Manage Reservation' });
      await manageReservationItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Manage Reservation item found and visible.');
      await manageReservationItem.click();
      console.log('Manage Reservation clicked successfully.');
    
      // Wait for the search page to load
      await page.waitForTimeout(3000);
    } else {
      console.log('Bookings menu not enabled, trying a different approach');
      // Try a direct navigation approach if menu navigation fails
      await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/pages/reservation/manageReservation', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
    }
  }

  async verifyMainInterface(page, roomNumber) {
    try {
      console.log(`Verifying main interface for room ${roomNumber}...`);
      // Check if we're on the main interface
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (!currentUrl.includes('operacloud')) {
        throw new Error('Not on the Opera Cloud interface');
      }
      
      // Check if we're on the Manage Reservation page
      if (currentUrl.includes('manageReservation')) {
        console.log('Already on Manage Reservation screen, skipping navigation.');
        return true;
      }
      
      // Check for the Bookings menu
      const bookingsMenuItem = page.locator('#pt1\\:toggle');
      await bookingsMenuItem.waitFor({ state: 'visible', timeout: 30000 });
      console.log('Bookings menu item found and visible.');
      
      if (await bookingsMenuItem.isEnabled()) {
        console.log('Bookings menu item is enabled.');
        return true;
      } else {
        throw new Error('Bookings menu is disabled');
      }
    } catch (error) {
      console.error(`Error verifying main interface: ${error.message}`);
      throw error;
    }
  }

  async downloadReservationCSV(page, roomNumber) {
    console.log(`Starting download process for room ${roomNumber}...`);
    try {
      // Verify we're on the main interface before proceeding
      await this.verifyMainInterface(page, roomNumber);
      
      // Navigate to the Manage Reservation screen if not already there
      const currentUrl = page.url();
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
      
      // Fill the search form
      const today = new Date();
      const startDate = '01.01.2024';
      const endDate = '31.07.2025';
      
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
          return { success: true, message: `No reservations found for room ${roomNumber}` };
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
      // Read room data from CSV
      const rooms = [];
      
      console.log(`Reading room data from ${roomListFile}...`);
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(roomListFile)
          .pipe(csv())
          .on('data', (data) => rooms.push(data))
          .on('end', () => {
            console.log(`Read ${rooms.length} rooms from CSV.`);
            resolve();
          })
          .on('error', (error) => {
            console.error('Error reading CSV:', error);
            reject(error);
          });
      });
      
      this.totalRoomsToProcess = rooms.length;
      
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
          const roomType = room.RoomType;
          
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
              
              // Process the room
              const result = await this.downloadReservationCSV(this.page, roomNumber);
              console.log(`Successfully downloaded ${result.path || 'empty file for'} room ${roomNumber}`);
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
}

module.exports = OperaCloudExtractor;