const path = require('path');
const fs = require('fs').promises;

class OperaCloudExtractor {
  constructor(page, context, browser, launchBrowser, loginToOperaCloud) {
    this.page = page;
    this.context = context;
    this.browser = browser;
    this.launchBrowser = launchBrowser;
    this.loginToOperaCloud = loginToOperaCloud; // Store login function
    this.downloadPath = path.join(__dirname, 'downloads');
    this.failureCount = 0;
    this.maxFailuresBeforeRestart = 2; // Increased from 1 to 2
    this.maxAttempts = 3; // Increased from 2 to 3
    this.previousRoomNumber = null;
    this.isRestarting = false; // Flag to prevent concurrent restarts

    this.waitTimes = {
      shortWait: 1000,
      standardWait: 2000,
      loadWait: 5000, // Increased from 3000 to 5000
      navigationWait: 10000, // Increased from 5000 to 10000
      exportActionWait: 2500, // Increased from 1500 to 2500
      elementWait: 10000, // Increased from 5000 to 10000
      networkWait: 60000, // Increased from 30000 to 60000
      downloadWait: 90000 // Increased from 60000 to 90000
    };
  }

  async downloadReservationCSV(roomNumber, startDate, endDate, attempt = 1, resumeStep = 'start') {
    if (this.isRestarting) {
      console.log(`Browser is currently restarting, waiting before processing room ${roomNumber}...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      return this.downloadReservationCSV(roomNumber, startDate, endDate, attempt, resumeStep);
    }
    
    try {
      console.log(`Starting download for room ${roomNumber}, attempt ${attempt}, step ${resumeStep}`);
      const isNewRoom = this.previousRoomNumber !== roomNumber;
      this.previousRoomNumber = roomNumber;

      // Verify page is still valid
      if (!this.page || this.page.isClosed()) {
        console.log(`Page is invalid or closed for room ${roomNumber}, restarting...`);
        await this.safeRestartBrowser();
        resumeStep = 'start';
      }

      // Check browser health
      try {
        const url = await this.page.url();
        console.log(`Current URL: ${url}`);
      } catch (urlError) {
        console.error(`Error accessing page URL: ${urlError.message}`);
        await this.safeRestartBrowser();
        resumeStep = 'start';
      }

      // For a new room, refresh the page to clear any previous state
      if (isNewRoom && attempt === 1 && resumeStep === 'start') {
        try {
          await this.safeRefreshPage();
        } catch (refreshError) {
          console.error(`Error during page refresh: ${refreshError.message}`);
          await this.safeRestartBrowser();
        }
      }

      // Execute steps based on the resume point
      if (resumeStep === 'start') {
        await this.navigateToManageReservation();
        resumeStep = 'search';
      }

      if (resumeStep === 'search') {
        await this.performSearch(roomNumber, startDate, endDate);
        resumeStep = 'export';
      }

      if (resumeStep === 'export') {
        await this.selectExportOptions();
        resumeStep = 'download';
      }

      if (resumeStep === 'download') {
        const filePath = await this.downloadFile(roomNumber);
        this.failureCount = 0; // Reset failure counter on success
        console.log(`Successfully downloaded CSV for room ${roomNumber}`);
        return filePath;
      }
    } catch (error) {
      console.error(`Error during download process for room ${roomNumber}: ${error.message}`);
      return await this.handleDownloadError(error, roomNumber, startDate, endDate, attempt);
    }
  }

  async safeRefreshPage() {
    try {
      console.log('Safely refreshing page...');
      if (!this.page || this.page.isClosed()) {
        throw new Error('Page is closed or null, cannot refresh');
      }
      
      const beforeRefreshPath = path.join(this.downloadPath, `before_refresh_${Date.now()}.png`);
      await this.page.screenshot({ path: beforeRefreshPath, fullPage: true })
        .catch(e => console.log(`Screenshot failed: ${e.message}`));

      // Check if we're on a valid page before refreshing
      try {
        const url = await this.page.url();
        console.log(`Pre-refresh URL: ${url}`);
        
        if (!url.includes('opera-cloud-index') && !url.includes('ManageReservation')) {
          console.log('Not on a recognized page, redirecting to dashboard instead of refreshing');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', 
            { waitUntil: 'domcontentloaded', timeout: 60000 });
          return;
        }
      } catch (urlError) {
        throw new Error(`Cannot access page URL: ${urlError.message}`);
      }

      // Perform the actual refresh with safety checks
      await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(this.waitTimes.loadWait);
      
      try {
        await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        await this.page.waitForLoadState('networkidle', { timeout: 30000 })
          .catch(e => console.log(`Network didn't reach idle: ${e.message}`));
      } catch (loadError) {
        console.log(`Load state waiting failed: ${loadError.message}`);
      }
      
      console.log('Page refreshed successfully');
      await this.ensureLoggedIn();
    } catch (error) {
      console.error(`Error in safeRefreshPage: ${error.message}`);
      throw error; // Let the caller handle the error
    }
  }

  async navigateToManageReservation() {
    console.log('Navigating to Manage Reservation screen...');
    
    // Verify page is valid
    if (!this.page || this.page.isClosed()) {
      throw new Error('Page is invalid or closed, cannot navigate');
    }

    // Get current URL with error handling
    let currentUrl = '';
    try {
      currentUrl = await this.page.url();
      console.log(`Current URL: ${currentUrl}`);
    } catch (urlError) {
      console.error(`Error getting page URL: ${urlError.message}`);
      throw new Error('Cannot access page URL, browser may be in an invalid state');
    }

    // Check login status first
    if (!currentUrl.includes('opera-cloud-index') && !currentUrl.includes('ManageReservation')) {
      console.log('Not on the main interface or Manage Reservation screen, ensuring login first...');
      await this.ensureLoggedIn();
      
      // Get URL again after login to verify
      try {
        currentUrl = await this.page.url();
        console.log(`URL after login check: ${currentUrl}`);
      } catch (urlError) {
        throw new Error(`Cannot access page URL after login: ${urlError.message}`);
      }
    }

    // Check if already on Manage Reservation screen
    let isManageReservationScreen = false;
    try {
      isManageReservationScreen = await this.page.getByRole('heading', { name: 'Manage Reservation' })
        .isVisible({ timeout: this.waitTimes.elementWait });
      console.log(`Is already on Manage Reservation screen: ${isManageReservationScreen}`);
    } catch (visibilityError) {
      console.log(`Error checking if on Manage Reservation screen: ${visibilityError.message}`);
      isManageReservationScreen = false;
    }

    if (isManageReservationScreen) {
      console.log('Already on Manage Reservation screen, refreshing search criteria...');
      try {
        const modifyLink = this.page.getByRole('link', { name: 'Modify Search Criteria' });
        if (await modifyLink.isVisible({ timeout: this.waitTimes.elementWait })) {
          await modifyLink.click();
          console.log('Modify Search Criteria clicked successfully');
          await this.page.waitForTimeout(this.waitTimes.standardWait);
          await this.page.waitForLoadState('networkidle', { timeout: 30000 })
            .catch(e => console.log(`Network didn't reach idle: ${e.message}`));
        } else {
          console.log('Modify Search Criteria link not visible, will navigate via menu instead');
          await this.navigateViaBookingsMenu();
        }
      } catch (modifyError) {
        console.error(`Error clicking Modify Search Criteria: ${modifyError.message}`);
        // Fall back to menu navigation
        await this.navigateViaBookingsMenu();
      }
    } else {
      await this.navigateViaBookingsMenu();
    }
  }

  async navigateViaBookingsMenu() {
    console.log('Navigating via Bookings menu...');
    
    // Take a screenshot before navigation for debugging
    await this.page.screenshot({ path: path.join(this.downloadPath, `before_navigation_${Date.now()}.png`) })
      .catch(e => console.log(`Screenshot failed: ${e.message}`));

    try {
      // Ensure we're on the main dashboard first
      try {
        const url = await this.page.url();
        if (!url.includes('opera-cloud-index')) {
          console.log('Not on main dashboard, redirecting...');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', 
            { waitUntil: 'domcontentloaded', timeout: 60000 });
          await this.page.waitForTimeout(this.waitTimes.loadWait);
        }
      } catch (urlError) {
        console.error(`Error checking URL: ${urlError.message}`);
        throw new Error('Cannot access page URL, browser may be in an invalid state');
      }

      // Wait for page to stabilize
      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await this.page.waitForLoadState('networkidle', { timeout: 30000 })
        .catch(e => console.log(`Network didn't reach idle: ${e.message}`));
      
      // Try multiple selectors for Bookings menu
      const bookingsSelectors = [
        'a:has-text("Bookings")',
        '[role="link"]:has-text("Bookings")',
        'button:has-text("Bookings")'
      ];
      
      let bookingsMenu = null;
      for (const selector of bookingsSelectors) {
        const menu = this.page.locator(selector);
        if (await menu.count() > 0 && await menu.isVisible()) {
          bookingsMenu = menu;
          console.log(`Found Bookings menu with selector: ${selector}`);
          break;
        }
      }
      
      if (!bookingsMenu) {
        // Fall back to role-based selector
        bookingsMenu = this.page.getByRole('link', { name: 'Bookings' });
        console.log('Using role-based selector for Bookings menu');
      }

      // Wait for Bookings menu to be interactive
      await bookingsMenu.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
      console.log('Bookings menu is visible');
      
      // Check if enabled and click with retry logic
      let clickAttempts = 0;
      const maxClickAttempts = 3;
      let clickSuccessful = false;
      
      while (!clickSuccessful && clickAttempts < maxClickAttempts) {
        try {
          clickAttempts++;
          if (!await bookingsMenu.isEnabled({ timeout: 5000 })) {
            console.log(`Bookings menu not enabled on attempt ${clickAttempts}, waiting...`);
            await this.page.waitForTimeout(2000 * clickAttempts);
            continue;
          }
          
          console.log(`Clicking Bookings menu (attempt ${clickAttempts})...`);
          await bookingsMenu.click({ timeout: 10000 });
          clickSuccessful = true;
          console.log('Bookings menu clicked successfully');
        } catch (clickError) {
          console.log(`Error clicking Bookings menu on attempt ${clickAttempts}: ${clickError.message}`);
          if (clickAttempts >= maxClickAttempts) throw clickError;
          await this.page.waitForTimeout(2000 * clickAttempts);
        }
      }
      
      await this.page.waitForTimeout(this.waitTimes.standardWait);

      // Click Reservations submenu with similar retry logic
      console.log('Locating Reservations submenu...');
      
      // Try multiple selectors for Reservations
      const reservationsSelectors = [
        'text="Reservations"',
        'a:has-text("Reservations")',
        '[id*="odec_drpmn_mb_mn_si"]:has-text("Reservations")',
        'li:has-text("Reservations")'
      ];
      
      let reservationsMenu = null;
      for (const selector of reservationsSelectors) {
        try {
          const menu = this.page.locator(selector).first();
          if (await menu.count() > 0 && await menu.isVisible({ timeout: 5000 })) {
            reservationsMenu = menu;
            console.log(`Found Reservations menu with selector: ${selector}`);
            break;
          }
        } catch (selectorError) {
          console.log(`Selector ${selector} failed: ${selectorError.message}`);
        }
      }
      
      if (!reservationsMenu) {
        console.log('Using complex ID selector for Reservations menu as fallback');
        reservationsMenu = this.page.locator('[id*="odec_drpmn_mb_mn_si"]').getByText('Reservations', { exact: true });
      }

      // Click with retry
      clickAttempts = 0;
      clickSuccessful = false;
      
      while (!clickSuccessful && clickAttempts < maxClickAttempts) {
        try {
          clickAttempts++;
          await reservationsMenu.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
          console.log(`Clicking Reservations submenu (attempt ${clickAttempts})...`);
          await reservationsMenu.click({ timeout: 10000 });
          clickSuccessful = true;
          console.log('Reservations submenu clicked successfully');
        } catch (clickError) {
          console.log(`Error clicking Reservations submenu on attempt ${clickAttempts}: ${clickError.message}`);
          if (clickAttempts >= maxClickAttempts) throw clickError;
          await this.page.waitForTimeout(2000 * clickAttempts);
        }
      }

      await this.page.waitForTimeout(this.waitTimes.standardWait);

      // Finally click Manage Reservation with same retry pattern
      console.log('Locating Manage Reservation option...');
      
      // Try multiple selectors for Manage Reservation
      const manageReservationSelectors = [
        'text="Manage Reservation"',
        'a:has-text("Manage Reservation")',
        'li:has-text("Manage Reservation")',
        '[role="menuitem"]:has-text("Manage Reservation")'
      ];
      
      let manageReservation = null;
      for (const selector of manageReservationSelectors) {
        try {
          const option = this.page.locator(selector).first();
          if (await option.count() > 0 && await option.isVisible({ timeout: 5000 })) {
            manageReservation = option;
            console.log(`Found Manage Reservation with selector: ${selector}`);
            break;
          }
        } catch (selectorError) {
          console.log(`Selector ${selector} failed: ${selectorError.message}`);
        }
      }
      
      if (!manageReservation) {
        // Fall back to getByText
        manageReservation = this.page.getByText('Manage Reservation', { exact: true });
        console.log('Using getByText selector for Manage Reservation');
      }

      // Click with retry
      clickAttempts = 0;
      clickSuccessful = false;
      
      while (!clickSuccessful && clickAttempts < maxClickAttempts) {
        try {
          clickAttempts++;
          await manageReservation.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
          console.log(`Clicking Manage Reservation (attempt ${clickAttempts})...`);
          await manageReservation.click({ timeout: 10000 });
          clickSuccessful = true;
          console.log('Manage Reservation clicked successfully');
        } catch (clickError) {
          console.log(`Error clicking Manage Reservation on attempt ${clickAttempts}: ${clickError.message}`);
          if (clickAttempts >= maxClickAttempts) throw clickError;
          await this.page.waitForTimeout(2000 * clickAttempts);
        }
      }

      // Wait for the page to load
      await this.page.waitForLoadState('networkidle', { timeout: this.waitTimes.networkWait })
        .catch(e => console.log(`Network didn't reach idle: ${e.message}`));
      
      // Verify we reached the Manage Reservation screen
      try {
        await this.page.getByRole('heading', { name: 'Manage Reservation' }).waitFor({ 
          timeout: this.waitTimes.networkWait,
          state: 'visible'
        });
        console.log('Successfully navigated to Manage Reservation screen');
      } catch (headingError) {
        console.error(`Error verifying Manage Reservation heading: ${headingError.message}`);
        throw new Error('Failed to navigate to Manage Reservation screen');
      }
    } catch (error) {
      console.error(`Error in navigateViaBookingsMenu: ${error.message}`);
      // Take a screenshot for debugging
      await this.page.screenshot({ path: path.join(this.downloadPath, `navigation_error_${Date.now()}.png`) })
        .catch(e => console.log(`Screenshot failed: ${e.message}`));
      throw error;
    }
  }

  async performSearch(roomNumber, startDate, endDate) {
    console.log(`Searching for room ${roomNumber}...`);
    
    // Verify the page is in the right state
    try {
      const searchHeading = this.page.getByRole('heading', { name: 'Manage Reservation' });
      const isVisible = await searchHeading.isVisible({ timeout: this.waitTimes.elementWait });
      if (!isVisible) {
        console.log('Not on Manage Reservation screen, navigating there first...');
        await this.navigateToManageReservation();
      }
    } catch (headingError) {
      console.log(`Error checking for Manage Reservation heading: ${headingError.message}`);
      await this.navigateToManageReservation();
    }

    // Find and fill room field with retry
    let fillAttempts = 0;
    const maxFillAttempts = 3;
    let roomInputFilled = false;
    
    while (!roomInputFilled && fillAttempts < maxFillAttempts) {
      try {
        fillAttempts++;
        console.log(`Filling room number (attempt ${fillAttempts})...`);
        
        // Try multiple selectors for room input
        const roomInputSelectors = [
          'input[name*="room"]',
          'input[placeholder*="Room"]',
          'input[aria-label="Room"]'
        ];
        
        let roomInput = null;
        for (const selector of roomInputSelectors) {
          const input = this.page.locator(selector);
          if (await input.count() > 0 && await input.isVisible({ timeout: 5000 })) {
            roomInput = input;
            console.log(`Found room input with selector: ${selector}`);
            break;
          }
        }
        
        if (!roomInput) {
          // Fall back to role-based selector
          roomInput = this.page.getByRole('textbox', { name: 'Room', exact: true });
          console.log('Using role-based selector for Room input');
        }
        
        await roomInput.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
        await roomInput.click({ timeout: 10000 });
        await roomInput.fill('');
        await roomInput.fill(roomNumber);
        console.log(`Room field cleared and set to: ${roomNumber}`);
        roomInputFilled = true;
      } catch (roomError) {
        console.log(`Error filling room on attempt ${fillAttempts}: ${roomError.message}`);
        if (fillAttempts >= maxFillAttempts) throw roomError;
        await this.page.waitForTimeout(2000 * fillAttempts);
      }
    }

    // Fill Arrival From with retry
    fillAttempts = 0;
    let arrivalFromFilled = false;
    
    while (!arrivalFromFilled && fillAttempts < maxFillAttempts) {
      try {
        fillAttempts++;
        console.log(`Filling Arrival From date (attempt ${fillAttempts})...`);
        
        // Try multiple selectors
        const arrivalInputSelectors = [
          'input[name*="arrivalFrom"]',
          'input[placeholder*="Arrival From"]',
          'input[aria-label="Arrival From"]'
        ];
        
        let arrivalFromInput = null;
        for (const selector of arrivalInputSelectors) {
          const input = this.page.locator(selector);
          if (await input.count() > 0 && await input.isVisible({ timeout: 5000 })) {
            arrivalFromInput = input;
            console.log(`Found arrival from input with selector: ${selector}`);
            break;
          }
        }
        
        if (!arrivalFromInput) {
          // Fall back to role-based selector
          arrivalFromInput = this.page.getByRole('textbox', { name: 'Arrival From' });
          console.log('Using role-based selector for Arrival From input');
        }
        
        await arrivalFromInput.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
        await arrivalFromInput.click({ timeout: 10000 });
        await arrivalFromInput.fill('');
        await arrivalFromInput.fill(startDate);
        console.log(`Arrival From field cleared and set to: ${startDate}`);
        arrivalFromFilled = true;
      } catch (arrivalError) {
        console.log(`Error filling Arrival From on attempt ${fillAttempts}: ${arrivalError.message}`);
        if (fillAttempts >= maxFillAttempts) throw arrivalError;
        await this.page.waitForTimeout(2000 * fillAttempts);
      }
    }

    // Fill Arrival To with retry
    fillAttempts = 0;
    let arrivalToFilled = false;
    
    while (!arrivalToFilled && fillAttempts < maxFillAttempts) {
      try {
        fillAttempts++;
        console.log(`Filling Arrival To date (attempt ${fillAttempts})...`);
        
        // Try multiple selectors
        const arrivalToSelectors = [
          'input[name*="arrivalTo"]',
          'input[placeholder*="Arrival To"]',
          'input[aria-label="Arrival To"]'
        ];
        
        let arrivalToInput = null;
        for (const selector of arrivalToSelectors) {
          const input = this.page.locator(selector);
          if (await input.count() > 0 && await input.isVisible({ timeout: 5000 })) {
            arrivalToInput = input;
            console.log(`Found arrival to input with selector: ${selector}`);
            break;
          }
        }
        
        if (!arrivalToInput) {
          // Fall back to role-based selector
          arrivalToInput = this.page.getByRole('textbox', { name: 'Arrival To' });
          console.log('Using role-based selector for Arrival To input');
        }
        
        await arrivalToInput.waitFor({ timeout: this.waitTimes.networkWait, state: 'visible' });
        await arrivalToInput.click({ timeout: 10000 });
        await arrivalToInput.fill('');
        await arrivalToInput.fill(endDate);
        console.log(`Arrival To field cleared and set to: ${endDate}`);
        arrivalToFilled = true;
      } catch (arrivalToError) {
        console.log(`Error filling Arrival To on attempt ${fillAttempts}: ${arrivalToError.message}`);
        if (fillAttempts >= maxFillAttempts) throw arrivalToError;
        await this.page.waitForTimeout(2000 * fillAttempts);
      }
    }

    // Click Search button with retry
    let searchAttempts = 0;
    const maxSearchAttempts = 3;
    let searchSuccessful = false;
    
    while (!searchSuccessful && searchAttempts < maxSearchAttempts) {
      try {
        searchAttempts++;
        console.log(`Clicking Search button (attempt ${searchAttempts})...`);
        
        // Try multiple selectors for search button
        const searchButtonSelectors = [
          '.odec-search-switcher-search-button',
          'button:has-text("Search")',
          'button[type="submit"]',
          '[role="button"]:has-text("Search")'
        ];
        
        let searchButton = null;
        for (const selector of searchButtonSelectors) {
          const button = this.page.locator(selector);
          if (await button.count() > 0 && await button.isVisible({ timeout: 5000 })) {
            searchButton = button;
            console.log(`Found search button with selector: ${selector}`);
            break;
          }
        }
        
        if (!searchButton) {
          // Try JavaScript click as last resort
          console.log('Using JavaScript to find and click search button');
          const clicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
            const searchBtn = buttons.find(b => 
              b.textContent.includes('Search') || 
              b.className.includes('search') ||
              b.getAttribute('title')?.includes('Search')
            );
            
            if (searchBtn) {
              searchBtn.click();
              return true;
            }
            return false;
          });
          
          if (clicked) {
            console.log('Search button clicked via JavaScript');
            searchSuccessful = true;
          } else {
            throw new Error('Could not find search button via JavaScript');
          }
        } else {
          // Click the button we found
          await searchButton.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
          if (!await searchButton.isEnabled({ timeout: 5000 })) {
            console.log('Search button not enabled, waiting...');
            await this.page.waitForTimeout(2000);
            continue;
          }
          
          await searchButton.click({ timeout: 10000 });
          console.log('Search button clicked successfully');
          searchSuccessful = true;
        }
      } catch (searchError) {
        console.log(`Error clicking Search on attempt ${searchAttempts}: ${searchError.message}`);
        if (searchAttempts >= maxSearchAttempts) throw searchError;
        await this.page.waitForTimeout(2000 * searchAttempts);
      }
    }

    // Wait for search results
    await this.page.waitForLoadState('networkidle', { timeout: this.waitTimes.networkWait })
      .catch(e => console.log(`Network didn't reach idle after search: ${e.message}`));
      
    // Take a screenshot of search results
    await this.page.screenshot({ path: path.join(this.downloadPath, `search_results_${roomNumber}_${Date.now()}.png`) })
      .catch(e => console.log(`Screenshot failed: ${e.message}`));

    // Validate search results
    const resultsExist = await this.validateSearchResults();
    if (!resultsExist) {
      throw new Error(`No search results found for room ${roomNumber}`);
    }
  }

  async validateSearchResults() {
    await this.page.waitForTimeout(this.waitTimes.standardWait);
    
    try {
      // Check for "No rows found" message
      const noRowsMessage = await this.page.getByText('No rows found.').isVisible({ timeout: 10000 })
        .catch(() => false);
        
      if (noRowsMessage) {
        console.log('Search completed but no results were found.');
        await this.page.screenshot({ path: path.join(this.downloadPath, `no_results_${Date.now()}.png`) })
          .catch(e => console.log(`Screenshot failed: ${e.message}`));
        return false;
      }

      // Check for results table
      const resultsSelectors = [
        'table',
        '.table',
        '[role="grid"]',
        '[role="table"]',
        '.grid'
      ];
      
      for (const selector of resultsSelectors) {
        const resultsTable = await this.page.locator(selector).isVisible({ timeout: 5000 })
          .catch(() => false);
          
        if (resultsTable) {
          console.log(`Search results found with selector: ${selector}`);
          return true;
        }
      }

      // Look for any table rows as a fallback
      const hasRows = await this.page.locator('tr').count() > 1;
      if (hasRows) {
        console.log('Search results found based on table rows');
        return true;
      }

      console.log('Unable to confirm if search results exist. Proceeding with caution.');
      return true; // Proceed anyway and let next steps handle any issues
    } catch (validationError) {
      console.log(`Error validating search results: ${validationError.message}`);
      // Take a screenshot for debugging
      await this.page.screenshot({ path: path.join(this.downloadPath, `validation_error_${Date.now()}.png`) })
        .catch(e => console.log(`Screenshot failed: ${e.message}`));
      return true; // Continue anyway
    }
  }

  async selectExportOptions(retryCount = 0, maxRetries = 3) {
      try {
        console.log('Selecting export options...');
        
        // Wait for page to be stable
        await this.page.waitForTimeout(this.waitTimes.loadWait);
        
        // Try multiple selectors for View Options button
        const viewOptionsSelectors = [
          'a:has-text("View Options")',
          '[role="link"]:has-text("View Options")',
          'button:has-text("View Options")'
        ];
        
        let viewOptionsButton = null;
        for (const selector of viewOptionsSelectors) {
          const button = this.page.locator(selector);
          if (await button.count() > 0 && await button.isVisible({ timeout: 5000 })) {
            viewOptionsButton = button;
            console.log(`Found View Options with selector: ${selector}`);
            break;
          }
        }
        
        if (!viewOptionsButton) {
          // Fall back to role-based selector
          viewOptionsButton = this.page.getByRole('link', { name: 'View Options' });
          console.log('Using role-based selector for View Options button');
        }
  
        // Click View Options with retry
        let clickAttempts = 0;
        const maxClickAttempts = 3;
        let clickSuccessful = false;
        
        while (!clickSuccessful && clickAttempts < maxClickAttempts) {
          try {
            clickAttempts++;
            await viewOptionsButton.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
            console.log(`Clicking View Options (attempt ${clickAttempts})...`);
            await viewOptionsButton.click({ timeout: 10000 });
            clickSuccessful = true;
            console.log('View Options clicked successfully');
          } catch (clickError) {
            console.log(`Error clicking View Options on attempt ${clickAttempts}: ${clickError.message}`);
            if (clickAttempts >= maxClickAttempts) throw clickError;
            await this.page.waitForTimeout(2000 * clickAttempts);
          }
        }
        
        // Wait for menu to appear
        await this.page.waitForTimeout(this.waitTimes.loadWait * 1.5);
  
        // Take a screenshot for debugging
        await this.page.screenshot({ path: path.join(this.downloadPath, `view_options_menu_${Date.now()}.png`) })
          .catch(e => console.log(`Screenshot failed: ${e.message}`));
  
        // Find and click Export option with retry
        const exportSelectors = [
          'text="Export"',
          'a:has-text("Export")',
          'li:has-text("Export")',
          '[role="menuitem"]:has-text("Export")'
        ];
        
        let exportOption = null;
        for (const selector of exportSelectors) {
          try {
            const option = this.page.locator(selector).first();
            if (await option.count() > 0 && await option.isVisible({ timeout: 5000 })) {
              exportOption = option;
              console.log(`Found Export option with selector: ${selector}`);
              break;
            }
          } catch (selectorError) {
            console.log(`Selector ${selector} failed: ${selectorError.message}`);
          }
        }
        
        if (!exportOption) {
          // Fall back to getByText
          exportOption = this.page.getByText('Export').first();
          console.log('Using getByText selector for Export option');
        }
  
        // Click Export with retry
        clickAttempts = 0;
        clickSuccessful = false;
        
        while (!clickSuccessful && clickAttempts < maxClickAttempts) {
          try {
            clickAttempts++;
            await exportOption.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
            console.log(`Clicking Export (attempt ${clickAttempts})...`);
            await exportOption.click({ timeout: 10000 });
            clickSuccessful = true;
            console.log('Export clicked successfully');
          } catch (clickError) {
            console.log(`Error clicking Export on attempt ${clickAttempts}: ${clickError.message}`);
            if (clickAttempts >= maxClickAttempts) throw clickError;
            await this.page.waitForTimeout(2000 * clickAttempts);
          }
        }
  
        // Wait for submenu to appear
        await this.page.waitForTimeout(this.waitTimes.loadWait);
  
        // Find and click CSV option with retry
        const csvSelectors = [
          'text="CSV"',
          'a:has-text("CSV")',
          'li:has-text("CSV")',
          '[role="menuitem"]:has-text("CSV")'
        ];
        
        let csvOption = null;
        for (const selector of csvSelectors) {
          try {
            const option = this.page.locator(selector).first();
            if (await option.count() > 0 && await option.isVisible({ timeout: 5000 })) {
              csvOption = option;
              console.log(`Found CSV option with selector: ${selector}`);
              break;
            }
          } catch (selectorError) {
            console.log(`Selector ${selector} failed: ${selectorError.message}`);
          }
        }
        
        if (!csvOption) {
          // Fall back to getByText
          csvOption = this.page.getByText('CSV', { exact: true }).first();
          console.log('Using getByText selector for CSV option');
        }
  
        // Click CSV with retry
        clickAttempts = 0;
        clickSuccessful = false;
        
        while (!clickSuccessful && clickAttempts < maxClickAttempts) {
          try {
            clickAttempts++;
            await csvOption.waitFor({ timeout: this.waitTimes.elementWait, state: 'visible' });
            console.log(`Clicking CSV (attempt ${clickAttempts})...`);
            await csvOption.click({ timeout: 10000 });
            clickSuccessful = true;
            console.log('CSV clicked successfully');
          } catch (clickError) {
            console.log(`Error clicking CSV on attempt ${clickAttempts}: ${clickError.message}`);
            if (clickAttempts >= maxClickAttempts) throw clickError;
            await this.page.waitForTimeout(2000 * clickAttempts);
          }
        }
  
        // Wait for dialog to appear
        await this.page.waitForLoadState('networkidle', { timeout: 30000 })
          .catch(e => console.log(`Network didn't reach idle after clicking CSV: ${e.message}`));
        
        // Take a screenshot for debugging
        await this.page.screenshot({ path: path.join(this.downloadPath, `csv_dialog_${Date.now()}.png`) })
          .catch(e => console.log(`Screenshot failed: ${e.message}`));
        
      } catch (error) {
        if (retryCount < maxRetries) {
          console.log(`Error in selectExportOptions: ${error.message}`);
          console.log(`Retrying (attempt ${retryCount + 1}/${maxRetries})...`);
          
          // Take a screenshot for debugging
          await this.page.screenshot({ path: path.join(this.downloadPath, `export_error_${Date.now()}.png`) })
            .catch(e => console.log(`Screenshot failed: ${e.message}`));
          
          await this.page.waitForTimeout(this.waitTimes.standardWait * (retryCount + 1));
          return await this.selectExportOptions(retryCount + 1, maxRetries);
        }
        throw error;
      }
    }
  
    async downloadFile(roomNumber) {
      try {
        console.log(`Downloading file for room ${roomNumber}...`);
        
        // Try multiple selectors for filename input
        const filenameSelectors = [
          'input[name*="filename"]',
          'input[placeholder*="File Name"]',
          'input[aria-label="File Name"]'
        ];
        
        let fileNameInput = null;
        for (const selector of filenameSelectors) {
          const input = this.page.locator(selector);
          if (await input.count() > 0 && await input.isVisible({ timeout: 5000 })) {
            fileNameInput = input;
            console.log(`Found filename input with selector: ${selector}`);
            break;
          }
        }
        
        if (!fileNameInput) {
          // Fall back to role-based selector
          fileNameInput = this.page.getByRole('textbox', { name: 'File Name' });
          console.log('Using role-based selector for File Name input');
        }
  
        await fileNameInput.waitFor({ state: 'visible', timeout: this.waitTimes.elementWait });
        await fileNameInput.click();
        await fileNameInput.fill(roomNumber);
        console.log(`Entered file name as room number: ${roomNumber}`);
        await this.page.waitForTimeout(this.waitTimes.exportActionWait);
  
        // Set up download promise
        const downloadPromise = this.page.waitForEvent('download', { timeout: this.waitTimes.downloadWait });
        
        // Find and click Export button with retry logic
        const exportButtonSelectors = [
          'button:has-text("Export")',
          'input[type="submit"][value="Export"]',
          '[role="button"]:has-text("Export")'
        ];
        
        let exportButton = null;
        for (const selector of exportButtonSelectors) {
          const button = this.page.locator(selector).first();
          if (await button.count() > 0 && await button.isVisible({ timeout: 5000 })) {
            exportButton = button;
            console.log(`Found export button with selector: ${selector}`);
            break;
          }
        }
        
        if (!exportButton) {
          // Fall back to role-based selector
          exportButton = this.page.getByRole('button', { name: 'Export', exact: true }).first();
          console.log('Using role-based selector for Export button');
        }
  
        // Click with retry
        let clickAttempts = 0;
        const maxClickAttempts = 3;
        let clickSuccessful = false;
        
        while (!clickSuccessful && clickAttempts < maxClickAttempts) {
          try {
            clickAttempts++;
            await exportButton.waitFor({ state: 'visible', timeout: this.waitTimes.elementWait });
            console.log(`Clicking Export button (attempt ${clickAttempts})...`);
            await exportButton.click({ timeout: 10000 });
            clickSuccessful = true;
            console.log('Export (download) button clicked successfully');
          } catch (clickError) {
            console.log(`Error clicking Export button on attempt ${clickAttempts}: ${clickError.message}`);
            if (clickAttempts >= maxClickAttempts) throw clickError;
            await this.page.waitForTimeout(2000 * clickAttempts);
          }
        }
  
        // Wait for download to start
        console.log('Waiting for download to start...');
        const download = await downloadPromise;
        console.log('Download started, waiting for completion...');
        
        // Make sure download directory exists
        await fs.mkdir(this.downloadPath, { recursive: true });
        
        // Set up the file path
        const filePath = path.join(this.downloadPath, `${roomNumber}_reservations.csv`);
        
        // Save the download with retry
        await this.saveDownloadWithRetry(download, filePath);
        console.log(`Downloaded CSV for room ${roomNumber} to ${filePath}`);
        
        return filePath;
      } catch (error) {
        console.error(`Error in downloadFile: ${error.message}`);
        
        // Take a screenshot for debugging
        await this.page.screenshot({ path: path.join(this.downloadPath, `download_error_${roomNumber}_${Date.now()}.png`) })
          .catch(e => console.log(`Screenshot failed: ${e.message}`));
        
        throw error;
      }
    }
  
    async handleDownloadError(error, roomNumber, startDate, endDate, attempt) {
      this.failureCount++;
      console.error(`Reservation CSV download failed for room ${roomNumber}: ${error.message}`);
      await this.captureErrorScreenshot(roomNumber);
  
      // Determine which step to resume from
      let nextResumeStep = this.determineResumeStep(error);
      console.log(`Determined resume step: ${nextResumeStep}`);
      
      // Restart browser if too many failures
      if (this.failureCount >= this.maxFailuresBeforeRestart) {
        console.log(`Too many failures (${this.failureCount}), restarting full browser...`);
        try {
          await this.safeRestartBrowser();
          this.failureCount = 0;
          nextResumeStep = 'start'; // Always start from beginning after restart
        } catch (restartError) {
          console.error(`Failed to restart browser: ${restartError.message}`);
          // Continue anyway, but with more delay
          await this.page.waitForTimeout(this.waitTimes.navigationWait * 2);
        }
      }
  
      // Retry if attempts remain
      if (attempt < this.maxAttempts) {
        console.log(`Retrying for room ${roomNumber}, attempt ${attempt + 1} of ${this.maxAttempts} resuming from ${nextResumeStep}...`);
        await this.page.waitForTimeout(this.waitTimes.navigationWait);
        return await this.downloadReservationCSV(roomNumber, startDate, endDate, attempt + 1, nextResumeStep);
      }
      
      throw error;
    }
  
    async captureErrorScreenshot(roomNumber) {
      const errorPath = path.join(this.downloadPath, `error_${roomNumber}_${Date.now()}.png`);
      try {
        if (this.page && !this.page.isClosed()) {
          await this.page.screenshot({ path: errorPath, fullPage: true });
          console.log(`Saved error screenshot to ${errorPath}`);
        }
      } catch (screenshotError) {
        console.error(`Failed to take screenshot: ${screenshotError.message}`);
      }
    }
  
    determineResumeStep(error) {
      let resumeStep = 'start'; // Default to starting over
      
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('file name') || errorMsg.includes('download') || 
          errorMsg.includes('export button') || errorMsg.includes('save')) {
        resumeStep = 'download';
      } else if (errorMsg.includes('view options') || errorMsg.includes('export') || 
                 errorMsg.includes('csv')) {
        resumeStep = 'export';
      } else if (errorMsg.includes('search button') || errorMsg.includes('room') || 
                 errorMsg.includes('arrival from') || errorMsg.includes('arrival to')) {
        resumeStep = 'search';
      } else if (errorMsg.includes('page closed') || errorMsg.includes('browser') || 
                 errorMsg.includes('target closed') || errorMsg.includes('invalid state')) {
        // Browser-level problems always restart from beginning
        resumeStep = 'start';
      }
      
      return resumeStep;
    }
  
    async saveDownloadWithRetry(download, filePath, maxRetries = 3) {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Saving download attempt ${attempt}/${maxRetries}...`);
          await download.saveAs(filePath);
          
          // Verify file exists and has content
          try {
            const stats = await fs.stat(filePath);
            if (stats.size > 0) {
              console.log(`File saved successfully with size ${stats.size} bytes`);
              return true;
            }
            console.warn(`Download saved but file is empty (${stats.size} bytes), retrying...`);
          } catch (statError) {
            console.warn(`Error checking file stats: ${statError.message}`);
          }
        } catch (error) {
          lastError = error;
          console.warn(`Download save attempt ${attempt}/${maxRetries} failed: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, this.waitTimes.standardWait * attempt));
        }
      }
      
      throw new Error(`Failed to save download after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    }
  
    async ensureLoggedIn() {
      console.log('Ensuring logged in status...');
      try {
        // Check if page is valid
        if (!this.page || this.page.isClosed()) {
          console.log('Page is invalid or closed, restarting browser...');
          await this.safeRestartBrowser();
          return;
        }
        
        // Try to get current URL
        let currentUrl;
        try {
          currentUrl = await this.page.url();
          console.log(`Current URL in ensureLoggedIn: ${currentUrl}`);
        } catch (urlError) {
          console.error(`Error getting current URL: ${urlError.message}`);
          await this.safeRestartBrowser();
          return;
        }
        
        // Check if we're on the main interface
        if (!currentUrl.includes('opera-cloud-index')) {
          console.log('Not on the main interface, attempting re-login...');
          await this.safeRestartBrowser();
          
          try {
            // Wait for the dashboard URL
            await this.page.waitForURL(/opera-cloud-index/, { timeout: this.waitTimes.networkWait });
            
            // Wait for Bookings menu to be available
            await this.page.getByRole('link', { name: 'Bookings' }).waitFor({ timeout: this.waitTimes.networkWait });
            console.log('Re-logged in successfully, Bookings menu is available');
          } catch (waitError) {
            console.error(`Error waiting for dashboard elements: ${waitError.message}`);
            throw new Error('Failed to verify login status');
          }
        } else {
          console.log('Already on the main interface');
        }
      } catch (error) {
        console.error(`Failed to ensure login: ${error.message}`);
        throw error;
      }
    }
  
    async keepSessionAlive() {
      console.log('Keeping session alive...');
      try {
        // Check if page is valid
        if (!this.page || this.page.isClosed()) {
          console.log('Page is invalid or closed, restarting browser...');
          await this.safeRestartBrowser();
          return;
        }
        
        // Try to get current URL
        let currentUrl;
        try {
          currentUrl = await this.page.url();
          console.log(`Current URL in keepSessionAlive: ${currentUrl}`);
        } catch (urlError) {
          console.error(`Error getting current URL: ${urlError.message}`);
          await this.safeRestartBrowser();
          return;
        }
        
        // If not on dashboard, restart
        if (!currentUrl.includes('opera-cloud-index')) {
          console.log('Session lost, re-logging in...');
          await this.safeRestartBrowser();
        } else {
          // Just navigate to dashboard to refresh session
          console.log('Refreshing dashboard to keep session alive');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', 
            { waitUntil: 'domcontentloaded', timeout: 60000 });
          
          // Verify Bookings menu is available
          try {
            await this.page.getByRole('link', { name: 'Bookings' }).waitFor({ timeout: this.waitTimes.networkWait });
            console.log('Session kept alive, Bookings menu is available');
          } catch (menuError) {
            console.error(`Error verifying Bookings menu: ${menuError.message}`);
            await this.safeRestartBrowser();
          }
        }
      } catch (error) {
        console.error(`Failed to keep session alive: ${error.message}`);
        throw error;
      }
    }
  
    async safeRestartBrowser() {
      // Set flag to prevent concurrent restarts
      if (this.isRestarting) {
        console.log('Browser restart already in progress, waiting...');
        
        // Wait for restart to complete
        let waitAttempts = 0;
        while (this.isRestarting && waitAttempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          waitAttempts++;
        }
        
        if (this.isRestarting) {
          console.log('Timed out waiting for browser restart to complete');
          this.isRestarting = false; // Reset flag
        } else {
          console.log('Existing browser restart completed');
        }
        
        return;
      }
      
      this.isRestarting = true;
      console.log('Starting browser restart process with enhanced safety...');
      
      try {
        // Close existing resources with error handling
        if (this.page && !this.page.isClosed()) {
          console.log('Closing existing page...');
          await this.page.close().catch(e => console.log(`Error closing page: ${e.message}`));
        }
        
        if (this.context) {
          console.log('Closing existing context...');
          await this.context.close().catch(e => console.log(`Error closing context: ${e.message}`));
        }
        
        if (this.browser) {
          console.log('Closing existing browser...');
          await this.browser.close().catch(e => console.log(`Error closing browser: ${e.message}`));
        }
        
        // Small delay to ensure resources are released
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Previous browser resources closed, starting login process...');
        const loginResult = await this.loginToOperaCloud();
        
        // Check if login returned an error
        if (loginResult.error) {
          console.error(`Login failed during restart: ${loginResult.error.message}`);
          
          // Try one more time after a delay
          console.log('Trying login once more after delay...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          const secondLoginResult = await this.loginToOperaCloud();
          if (secondLoginResult.error) {
            console.error(`Second login attempt failed: ${secondLoginResult.error.message}`);
            throw new Error('Multiple login failures during restart');
          }
          
          // Update browser objects
          this.page = secondLoginResult.page;
          this.browser = secondLoginResult.browser;
          this.context = secondLoginResult.context;
        } else {
          // Update browser objects
          this.page = loginResult.page;
          this.browser = loginResult.browser;
          this.context = loginResult.context;
        }
        
        // Verify we're on the dashboard
        try {
          await this.page.waitForURL(/opera-cloud-index/, { timeout: this.waitTimes.networkWait });
          console.log('Browser successfully restarted and logged in to dashboard');
        } catch (urlError) {
          console.error(`Error waiting for dashboard URL: ${urlError.message}`);
          const currentUrl = await this.page.url().catch(() => 'unknown');
          throw new Error(`Failed to reach dashboard after restart, current URL: ${currentUrl}`);
        }
      } catch (error) {
        console.error(`Failed to restart browser: ${error.message}`);
        throw error;
      } finally {
        this.isRestarting = false; // Reset flag regardless of outcome
      }
    }
  }
  
  module.exports = OperaCloudExtractor;