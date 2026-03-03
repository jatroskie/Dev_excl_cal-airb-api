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
      
      // Reset state
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      
      // Wait before restarting (prevents system overload)
      console.log('Waiting 5 seconds before restarting...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Login again to get a fresh session using login3.js
      const result = await loginToOperaCloud();
      
      if (result.error) {
        console.error('Login failed during browser restart:', result.error.message);
        throw result.error;
      }
      
      this.browser = result.browser;
      this.context = result.context;
      this.page = result.page;
      this.isLoggedIn = true;
      
      // Verify successful login and navigate to main application
      try {
        const currentUrl = await this.page.url();
        console.log(`Browser restart complete. Current URL: ${currentUrl}`);
        
        // Handle PopupChecker page or other non-application URLs
        if (currentUrl.includes('PopupChecker') || !currentUrl.includes('OperaCloud')) {
          console.log('Need to navigate to main application after restart...');
          
          // Create a new page in the same context
          console.log('Creating new page for main application...');
          this.page = await this.context.newPage();
          
          // Navigate to the main application URL
          const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
          console.log(`Navigating to main application URL: ${appUrl}`);
          
          await this.page.goto(appUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          // Wait for the page to be fully loaded
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
          
          // Take a screenshot to verify
          const downloadsPath = path.join(__dirname, 'downloads');
          await this.page.screenshot({ 
            path: path.join(downloadsPath, `restart_app_loaded_${Date.now()}.png`) 
          });
        }
      } catch (urlError) {
        console.log('Error checking URL after restart:', urlError.message);
        // Handle page closed errors by creating a new page
        if (urlError.message.includes('closed') || urlError.message.includes('Target closed')) {
          try {
            console.log('Creating a new page after restart...');
            this.page = await this.context.newPage();
            
            const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
            await this.page.goto(appUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 60000 
            });
          } catch (navError) {
            console.error('Failed to create new page after restart:', navError.message);
            throw navError;
          }
        } else {
          throw urlError;
        }
      }
      
      console.log('Browser successfully restarted with proper login flow');
      return true;
      
    } catch (error) {
      console.error('Error restarting browser:', error.message);
      throw error;
    }
  }require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

class LookToBookAutomation {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
    this.loginAttempts = 0;
    this.maxLoginAttempts = 3;
  }

  async initialize() {
    try {
      console.log('Initializing Look to Book automation...');
      
      // Configure download directory
      const downloadsPath = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }
      
      // Call the login function from login3.js
      this.loginAttempts++;
      console.log(`Login attempt ${this.loginAttempts} of ${this.maxLoginAttempts}...`);
      
      // Create custom options with larger viewport for login
      const loginOptions = {
        viewport: { width: 1600, height: 1200 },  // Increased dimensions
        headless: false
      };
      
      const result = await loginToOperaCloud(loginOptions);
      
      
      if (result.error) {
        console.error('Login failed in initialization:', result.error.message);
        
        // Take a screenshot of the error state if possible
        try {
          if (result.page && !result.page.isClosed()) {
            await result.page.screenshot({ 
              path: path.join(downloadsPath, `login_error_${Date.now()}.png`) 
            });
          }
        } catch (screenshotError) {
          console.log('Could not take login error screenshot:', screenshotError.message);
        }
        
        // Retry login if we haven't exceeded max attempts
        if (this.loginAttempts < this.maxLoginAttempts) {
          console.log(`Retrying login (attempt ${this.loginAttempts + 1} of ${this.maxLoginAttempts})...`);
          
          // Clean up current resources before retrying
          if (result.browser) await result.browser.close().catch(e => console.log('Error closing browser:', e.message));
          
          // Wait a moment before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Recursive retry
          return await this.initialize();
        }
        
        throw result.error;
      }
      
      // Login successful
      this.browser = result.browser;
      this.context = result.context;
      this.page = result.page;
      this.isLoggedIn = true;
      
      // Verify we're on a proper page
      try {
        const currentUrl = await this.page.url();
        console.log(`Login successful. Current URL: ${currentUrl}`);
        
        // Handle PopupChecker page - we need to navigate to the main application URL
        if (currentUrl.includes('PopupChecker')) {
          console.log('Detected PopupChecker page, navigating to main application...');
          
          // Create a new page in the same context
          console.log('Creating new page for main application...');
          this.page = await this.context.newPage();
          
          // Navigate to the main application URL
          const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
          console.log(`Navigating to main application URL: ${appUrl}`);
          
          await this.page.goto(appUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          // Wait for the page to be fully loaded
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
          
          // Take a screenshot to verify
          await this.page.screenshot({ 
            path: path.join(downloadsPath, `main_app_loaded_${Date.now()}.png`) 
          });
          
          console.log('Successfully navigated to main application');
        } else if (!currentUrl.includes('operacloud')) {
          // If we're not on an Opera Cloud page at all, navigate to the main app
          console.log('Not on an Opera Cloud page, navigating to main application...');
          
          const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
          await this.page.goto(appUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
        }
      } catch (urlError) {
        console.log('Error checking URL:', urlError.message);
        console.log('Creating a new page to navigate to main application...');
        
        try {
          this.page = await this.context.newPage();
          
          const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
          await this.page.goto(appUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
        } catch (navError) {
          console.error('Failed to create new page and navigate:', navError.message);
          throw navError;
        }
      }
      
      // Configure download behavior
      console.log('Configuring download behavior...');
      await this.context.route('**/*.csv', route => route.continue());
      
      console.log('Login process completed successfully.');
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
      
      // Check if we have browser and context objects
      if (!this.browser || !this.context) {
        console.log('No browser or context, need to initialize completely');
        return await this.initialize();
      }
      
      // Check if page is available
      if (!this.page || this.page.isClosed()) {
        console.log('Page is closed or null, creating a new page');
        try {
          this.page = await this.context.newPage();
        } catch (pageError) {
          console.log('Error creating new page, context may be invalid:', pageError.message);
          return await this.initialize();
        }
      }
      
      try {
        // Check current URL to determine if we're on the main interface
        const currentUrl = await this.page.url();
        console.log('Current URL in ensureLoggedIn:', currentUrl);
        
        // Check if we're on a login page or session expired
        if (currentUrl.includes('login') || currentUrl.includes('SignOn')) {
          console.log('On login page, session likely expired. Re-initializing...');
          await this.cleanup();
          return await this.initialize();
        }
        
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
          
          // Check for login elements to detect session timeout
          const loginButton = this.page.getByRole('button', { name: 'Sign In' });
          const isLoginPage = await loginButton.isVisible({ timeout: 5000 }).catch(() => false);
          
          if (isLoginPage) {
            console.log('Login page detected after navigation, session expired. Re-initializing...');
            await this.cleanup();
            return await this.initialize();
          }
          
          console.log('Redirected to main interface successfully.');
        } else {
          console.log('Already on the main interface.');
        }
      } catch (error) {
        if (error.message.includes('closed') || error.message.includes('detached')) {
          console.log('Page closed unexpectedly during URL check, creating new page');
          try {
            this.page = await this.context.newPage();
            await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { 
              waitUntil: 'domcontentloaded',
              timeout: 60000 
            });
            
            await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
              console.log('Network idle timeout during recovery, continuing anyway');
            });
          } catch (recoveryError) {
            console.log('Recovery failed, need to re-initialize:', recoveryError.message);
            await this.cleanup();
            return await this.initialize();
          }
        } else if (error.message.includes('Target closed') || error.message.includes('context')) {
          console.log('Browser context issue detected, re-initializing...');
          await this.cleanup();
          return await this.initialize();
        } else {
          throw error;
        }
      }
      
      // Take a screenshot to verify state
      try {
        const downloadsPath = path.join(__dirname, 'downloads');
        await this.page.screenshot({ 
          path: path.join(downloadsPath, `ensure_logged_in_${Date.now()}.png`) 
        });
      } catch (screenshotError) {
        console.log('Could not take verification screenshot:', screenshotError.message);
      }
      
      this.isLoggedIn = true;
      return true;
    } catch (error) {
      console.error('Error ensuring logged in:', error.message);
      // For serious errors, try to restart completely
      try {
        await this.cleanup();
        return await this.initialize();
      } catch (initError) {
        console.error('Failed to recover from login error:', initError.message);
        throw error;
      }
    }
  }

  async navigateToLookToBookScreen() {
    try {
      console.log('Navigating to Look To Book Sales Screen...');
      const page = this.page;
      
      // First ensure we are on the main interface
      await this.ensureLoggedIn();
      
      // Look for Bookings menu item (similar to your extractor code)
      console.log('Looking for Bookings menu item...');
      
      // Target the Bookings menu item using the class and role attributes
      const bookingsMenuItem = page.locator('div.x2c8[role="menuitem"][aria-label="Bookings"]');
      
      // Wait for it to be visible
      await bookingsMenuItem.waitFor({ state: 'visible', timeout: 30000 });
      console.log('Bookings menu item found and visible.');
      
      // Click on the Bookings menu
      console.log('Clicking Bookings menu...');
      await bookingsMenuItem.click();
      console.log('Bookings menu clicked successfully.');
      await page.waitForTimeout(2000);
      
      // Look for Reservations submenu - use the exact table structure from the HTML
      console.log('Clicking Reservations submenu...');
      const reservationsMenuItem = page.locator('tr[role="menuitem"] td:has-text("Reservations")').first();
      await reservationsMenuItem.waitFor({ state: 'visible', timeout: 10000 });
      await reservationsMenuItem.click();
      console.log('Reservations submenu clicked successfully.');
      await page.waitForTimeout(2000);
      
      // Look for Look To Book Sales Screen option
      console.log('Clicking Look To Book Sales Screen...');
      const lookToBookItem = page.locator('tr[role="menuitem"] td:has-text("Look To Book Sales Screen")').first();
      await lookToBookItem.waitFor({ state: 'visible', timeout: 10000 });
      await lookToBookItem.click();
      console.log('Look To Book Sales Screen clicked successfully.');
      
      // Wait for the page to load
      await page.waitForTimeout(3000);
      
      return true;
    } catch (error) {
      console.error('Error navigating to Look To Book Sales Screen:', error.message);
      console.log('Taking screenshot to debug navigation failure...');
      
      try {
        const downloadsPath = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadsPath)) {
          fs.mkdirSync(downloadsPath, { recursive: true });
        }
        await this.page.screenshot({ path: path.join(downloadsPath, 'look_to_book_navigation_failure.png') });
        
        // Try alternative navigation approaches
        console.log('Trying alternative navigation approach...');
        
        // First alternative: Try clicking on parent elements
        try {
          console.log('First alternative: Using parent element clicks');
          
          // Try to find any element containing "Reservations" text
          const reservationsText = this.page.locator('text="Reservations"').first();
          if (await reservationsText.isVisible({ timeout: 3000 })) {
            console.log('Found Reservations text, clicking...');
            await reservationsText.click();
            await this.page.waitForTimeout(2000);
            
            // Try to find any element containing "Look To Book Sales Screen" text
            const lookToBookText = this.page.locator('text="Look To Book Sales Screen"').first();
            if (await lookToBookText.isVisible({ timeout: 3000 })) {
              console.log('Found Look To Book Sales Screen text, clicking...');
              await lookToBookText.click();
              await this.page.waitForTimeout(3000);
              return true; // Successfully navigated
            }
          }
        } catch (textError) {
          console.log('Text element approach failed:', textError.message);
        }
        
        // Second alternative: Try direct URL navigation if known
        try {
          console.log('Second alternative: Attempting direct URL navigation');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/pages/lookToBook', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          
          await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });
          
          console.log('Direct URL navigation completed');
          return true;
        } catch (navError) {
          console.log('Direct URL navigation failed:', navError.message);
        }
      } catch (fallbackError) {
        console.error('Alternative navigation also failed:', fallbackError.message);
      }
      
      // If we get here, all attempts have failed
      throw new Error('Failed to navigate to Look To Book Sales Screen');
    }
  }

  async createBooking(clientName, firstName, telephoneNumber, roomNumber, 
                      startDate, endDate, discountAmount, discountCode = 'OTH') {
    try {
      console.log(`Starting booking process for ${firstName} ${clientName}, room ${roomNumber}...`);
      const page = this.page;
      
      // First ensure we are logged in
      if (!this.isLoggedIn) {
        console.log('Not logged in. Initializing login...');
        await this.initialize();
      }
      
      // Verify we have a valid page
      if (!page || page.isClosed()) {
        console.log('Page is null or closed. Restarting browser...');
        await this.restartBrowser();
      }
      
      // Navigate to Look To Book Sales Screen
      await this.navigateToLookToBookScreen();
      
      // Take screenshot of successful navigation
      const downloadsPath = path.join(__dirname, 'downloads');
      await page.screenshot({ 
        path: path.join(downloadsPath, `look_to_book_screen_${Date.now()}.png`) 
      });
      
      // Enter Travel Agent and search
      console.log('Entering travel agent...');
      const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' });
      await travelAgentInput.waitFor({ state: 'visible', timeout: 10000 });
      await travelAgentInput.click();
      await travelAgentInput.fill('airbnb');
      
      // Click on the search link for Travel Agent (the magnifying glass icon)
      console.log('Clicking travel agent search icon...');
      
      // Try multiple approaches to find and click the search link
      try {
        // First try the specific ID from the screenshot
        console.log('Trying to find search button by ID...');
        const searchById = page.locator('a[id*="oc_srclov_dummy_link"]');
        if (await searchById.isVisible({ timeout: 3000 })) {
          console.log('Found search button by ID, clicking...');
          await searchById.click();
        } else {
          // Try by the filter method from original code
          console.log('Trying filter method...');
          const searchLink = page.locator("div")
            .filter({ hasText: /^Travel AgentSource$/ })
            .getByRole("link")
            .first();
          
          if (await searchLink.isVisible({ timeout: 3000 })) {
            console.log('Found search link by filter, clicking...');
            await searchLink.click();
          } else {
            // Try a more generic approach
            console.log('Trying generic magnifying glass icon...');
            const genericSearch = page.locator('a.x47a, a.xt1, [aria-label*="Search"]').first();
            if (await genericSearch.isVisible({ timeout: 3000 })) {
              console.log('Found generic search button, clicking...');
              await genericSearch.click();
            } else {
              console.log('No search button found, trying to press Enter key...');
              await travelAgentInput.press('Enter');
            }
          }
        }
      } catch (searchError) {
        console.log('Error finding search button:', searchError.message);
        console.log('Falling back to pressing Enter key on input field...');
        await travelAgentInput.press('Enter');
      }
      
      await page.waitForTimeout(2000);
      
      // Handle the popup dialog that appears after search
      console.log('Looking for search popup dialog...');
      try {
        // Look for the popup containing the search results
        const searchPopup = page.locator('div[role="dialog"], .x1qp, .x1py').first();
        if (await searchPopup.isVisible({ timeout: 5000 })) {
          console.log('Search popup detected, looking for Search button within popup...');
          
          // Take a screenshot of the popup
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `search_popup_${Date.now()}.png`) 
          });
          
          // Use the specific selector provided for the search button
          console.log('Using specific selector for search button...');
          const specificSearchButton = page.locator('span.x44s.x20 > div[role="presentation"][_afrgrp="0"]');
          
          if (await specificSearchButton.isVisible({ timeout: 5000 })) {
            console.log('Found search button using specific selector, clicking...');
            await specificSearchButton.click();
            await page.waitForTimeout(2000);
          } else {
            console.log('Specific selector not found, trying alternative methods...');
            
            // Try to find and click the Search button in the popup
            const popupSearchButton = page.getByRole('button', { name: 'Search' }).nth(0);
            if (await popupSearchButton.isVisible({ timeout: 3000 })) {
              console.log('Found Search button in popup, clicking...');
              await popupSearchButton.click();
              await page.waitForTimeout(2000);
            } else {
              // Try alternative selectors for the Search button
              console.log('Trying alternative Search button selectors...');
              
              // Try by text content
              const searchByText = page.locator('button:has-text("Search")').first();
              if (await searchByText.isVisible({ timeout: 2000 })) {
                console.log('Found Search button by text, clicking...');
                await searchByText.click();
                await page.waitForTimeout(2000);
              } else {
                console.log('No Search button found in popup, continuing...');
              }
            }
          }
        } else {
          console.log('No search popup detected, continuing...');
        }
      } catch (popupError) {
        console.log('Error handling search popup:', popupError.message);
      }
      
      await page.waitForTimeout(3000);
      
      // Based on the screenshot, we need to handle the Profile Search popup
      console.log('Handling Profile Search popup...');
      
      // Take screenshot to verify current state
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `profile_search_${Date.now()}.png`) 
      });
      
      // Check if we're in the Profile Search popup
      const profileSearchHeading = page.locator('text="Manage Profile"').first();
      const isProfileSearch = await profileSearchHeading.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isProfileSearch) {
        console.log('Found Profile Search popup');
        
        // Check if we have search results with AirBnB
        const airBnBEntry = page.locator('text="AirBnB"').first();
        const hasAirBnBResult = await airBnBEntry.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (hasAirBnBResult) {
          console.log('AirBnB entry found in search results');
          
          // Take screenshot before selecting
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `airbnb_entry_found_${Date.now()}.png`) 
          });
          
          // Click on the AirBnB row first to select it
          try {
            // First try to click directly on the AirBnB row
            console.log('Attempting to click on AirBnB row...');
            await airBnBEntry.click();
            console.log('Clicked on AirBnB entry');
            await page.waitForTimeout(1000);
            
            // Take screenshot after clicking the row
            await page.screenshot({ 
              path: path.join(__dirname, 'downloads', `after_airbnb_click_${Date.now()}.png`) 
            });
          } catch (rowClickError) {
            console.log('Error clicking AirBnB row:', rowClickError.message);
          }
          
          // Find and click Select button using JavaScript evaluation
          console.log('Looking for Select button with JavaScript approach...');
          
          // Take screenshot before attempting to click Select
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `before_select_click_${Date.now()}.png`) 
          });
          
          try {
            // First try to find any element containing "Select" text and click it
            console.log('Trying to find and click any element with "Select" text...');
            
            // This uses JavaScript evaluation to find elements with "Select" text
            const selectClicked = await page.evaluate(() => {
              // Find all elements containing "Select" text
              const elements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent.includes('Select'));
              
              // Click the first one found (if any)
              if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with "Select" text`);
                elements[0].focus();
                elements[0].click();
                return true;
              }
              return false;
            });
            
            if (selectClicked) {
              console.log('Successfully clicked an element with "Select" text via JavaScript');
            } else {
              console.log('Could not find elements with "Select" text, trying button elements...');
              
              // Try to find and click any button elements
              const buttonClicked = await page.evaluate(() => {
                // Find all button elements
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a.button, [role="button"]'));
                
                // Filter to those that might be Select buttons
                const selectButtons = buttons.filter(btn => 
                  btn.textContent.toLowerCase().includes('select') || 
                  btn.value?.toLowerCase().includes('select')
                );
                
                // Click the first one found (if any)
                if (selectButtons.length > 0) {
                  console.log(`Found ${selectButtons.length} button elements that might be Select`);
                  selectButtons[0].focus();
                  selectButtons[0].click();
                  return true;
                }
                return false;
              });
              
              if (buttonClicked) {
                console.log('Successfully clicked a button-like element via JavaScript');
              } else {
                console.log('Could not find button elements for Select, trying parent element approach...');
                
                // Try the parent element approach as suggested
                const parentElementClicked = await page.evaluate(() => {
                  // Try to find elements with Select text and click their parent
                  const selectElements = Array.from(document.querySelectorAll('*'))
                    .filter(el => el.textContent.trim() === 'Select');
                  
                  if (selectElements.length > 0) {
                    const link = selectElements[0].parentElement;
                    if (link) {
                      link.focus();
                      link.click();
                      return true;
                    }
                  }
                  return false;
                });
                
                if (parentElementClicked) {
                  console.log('Successfully clicked parent element of Select text via JavaScript');
                } else {
                  // Fall back to playwright selectors if all JavaScript approaches fail
                  console.log('JavaScript approaches failed, falling back to Playwright selectors...');
                  
                  // Try various selectors to find the Select button
                  const selectButton = page.getByRole('button', { name: 'Select' });
                  if (await selectButton.isVisible({ timeout: 3000 })) {
                    await selectButton.click();
                    console.log('Clicked Select button by role');
                  } else {
                    // Try by text
                    const selectByText = page.locator('text="Select"').first();
                    if (await selectByText.isVisible({ timeout: 3000 })) {
                      await selectByText.click();
                      console.log('Clicked element with exact Select text');
                    } else {
                      // Last attempt - try any element containing Select
                      const anySelect = page.locator(':text("Select")').first();
                      if (await anySelect.isVisible({ timeout: 3000 })) {
                        await anySelect.click();
                        console.log('Clicked element containing Select text');
                      } else {
                        console.log('No Select button found, taking screenshot and trying to continue...');
                        await page.screenshot({ 
                          path: path.join(__dirname, 'downloads', `select_button_not_found_${Date.now()}.png`) 
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (selectError) {
            console.log('Error clicking Select button:', selectError.message);
            
            // Take error screenshot
            await page.screenshot({ 
              path: path.join(__dirname, 'downloads', `select_error_${Date.now()}.png`) 
            });
            
            // Try to proceed anyway in case the selection happened despite the error
            console.log('Attempting to continue despite Select button error...');
          }
              
              // Try using the Select button in the bottom bar (common in Opera Cloud)
              const bottomSelect = page.locator('div.x1pu button:has-text("Select")').first();
              if (await bottomSelect.isVisible({ timeout: 3000 })) {
                console.log('Found Select button in bottom bar, clicking...');
                await bottomSelect.click();
                console.log('Clicked Select button in bottom bar');
              } else {
                // Try the generic role-based selector
                const roleSelect = page.getByRole('button', { name: 'Select' });
                if (await roleSelect.isVisible({ timeout: 3000 })) {
                  console.log('Found Select button by role, clicking...');
                  await roleSelect.click();
                  console.log('Clicked Select button by role');
                } else {
                  // Last resort - try any button with "Select" text
                  const anySelect = page.locator('button:has-text("Select")').first();
                  if (await anySelect.isVisible({ timeout: 3000 })) {
                    console.log('Found generic Select button, clicking...');
                    await anySelect.click();
                    console.log('Clicked generic Select button');
                  } else {
                    console.log('No Select button found, taking screenshot and trying to continue...');
                    await page.screenshot({ 
                      path: path.join(__dirname, 'downloads', `select_button_not_found_${Date.now()}.png`) 
                    });
                  }
                }
              }
            }
          } catch (selectError) {
            console.log('Error clicking Select button:', selectError.message);
            
            // Take error screenshot
            await page.screenshot({ 
              path: path.join(__dirname, 'downloads', `select_error_${Date.now()}.png`) 
            });
            
            // Try to proceed anyway in case the selection happened despite the error
            console.log('Attempting to continue despite Select button error...');
          }
        } else {
          // If no AirBnB result, create a new profile
          console.log('No AirBnB result found, will create a new profile');
          
          // Click New Profile button
          const newProfileLink = page.getByRole('link', { name: 'New Profile' });
          if (await newProfileLink.isVisible({ timeout: 3000 })) {
            await newProfileLink.click();
            console.log('Clicked New Profile link');
          } else {
            // Try alternative selector
            const altNewProfile = page.locator('a:has-text("New Profile")').first();
            if (await altNewProfile.isVisible({ timeout: 2000 })) {
              await altNewProfile.click();
              console.log('Clicked alternative New Profile link');
            } else {
              throw new Error('Could not find New Profile link');
            }
          }
        }
      } else {
        // If we're not in the Profile Search popup, try the iframe approach as fallback
        console.log('Profile Search popup not found, trying iframe approach...');
        
        // ... rest of the iframe logic remains the same
      }
      
      // Fill out the guest profile details
      console.log('Filling out guest profile...');
      await page.waitForTimeout(2000);
      
      // Wait for the Guest Profile dialog
      const guestProfileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
      await guestProfileDialog.waitFor({ state: 'visible', timeout: 10000 });
      
      // Fill Last Name
      const nameInput = guestProfileDialog.getByLabel('Name', { exact: true });
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill(clientName);
      
      // Fill First Name
      const firstNameInput = page.getByRole('textbox', { name: 'First Name' });
      await firstNameInput.waitFor({ state: 'visible', timeout: 5000 });
      await firstNameInput.fill(firstName);
      
      // Fill Mobile number
      const mobileRow = page.getByRole('row', { name: 'MOBILE Communication Type' });
      const commValueInput = mobileRow.getByLabel('Communication Value');
      await commValueInput.waitFor({ state: 'visible', timeout: 5000 });
      await commValueInput.click();
      
      // Handle the communication value input which might be in a gridcell
      try {
        const gridCellInput = page.getByRole('gridcell', { name: 'Communication Value Communication Value' })
                               .getByLabel('Communication Value');
        await gridCellInput.waitFor({ state: 'visible', timeout: 5000 });
        await gridCellInput.fill(telephoneNumber);
      } catch (error) {
        console.log('Could not find gridcell input, trying direct input:', error.message);
        await commValueInput.fill(telephoneNumber);
      }
      
      // Save and Select Profile
      console.log('Saving profile...');
      const saveButton = page.getByRole('button', { name: 'Save and Select Profile' });
      await saveButton.waitFor({ state: 'visible', timeout: 5000 });
      await saveButton.click();
      await page.waitForTimeout(2000);
      
      // Wait a moment for any redirects/reloads after selecting AirBnB
      console.log('Waiting for page to stabilize after AirBnB selection...');
      await page.waitForTimeout(5000);
      
      // Take screenshot at this point
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `after_airbnb_selection_${Date.now()}.png`) 
      });
      
      // Enter reservation details
      console.log('Entering reservation details...');
      
      // Try to locate the form fields with multiple approaches
      try {
        // First, check if we need to wait for a specific element to confirm page is ready
        console.log('Checking if page is fully loaded...');
        
        // Wait for any of these elements to confirm the page is loaded
        const pageReadyIndicators = [
          page.getByRole('textbox', { name: 'Arrival From' }),
          page.locator('[id*="arrivalFrom"]'),
          page.locator('input[placeholder*="Arrival"]').first(),
          page.locator('label:has-text("Arrival From")').first()
        ];
        
        let pageReady = false;
        for (const indicator of pageReadyIndicators) {
          if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
            pageReady = true;
            console.log('Page is ready, found a valid indicator');
            break;
          }
        }
        
        if (!pageReady) {
          console.log('Page ready indicators not found, taking screenshot and continuing...');
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `page_not_ready_${Date.now()}.png`) 
          });
        }
        
        // Locate the Arrival From field using multiple approaches
        console.log('Locating Arrival From field...');
        
        // Try multiple selectors to find the date input fields
        const arrivalSelectors = [
          { type: 'role', selector: page.getByRole('textbox', { name: 'Arrival From' }) },
          { type: 'id', selector: page.locator('[id*="arrivalFrom"]').first() },
          { type: 'placeholder', selector: page.locator('input[placeholder*="Arrival"]').first() },
          { type: 'near', selector: page.locator('input').near(page.locator('label:has-text("Arrival From")').first()) },
          { type: 'css', selector: page.locator('input.x25').first() } // Common Opera Cloud input class
        ];
        
        // Try each selector until one works
        let arrivalFromInput = null;
        for (const { type, selector } of arrivalSelectors) {
          console.log(`Trying to find Arrival From with ${type} selector...`);
          if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
            arrivalFromInput = selector;
            console.log(`Found Arrival From field using ${type} selector`);
            break;
          }
        }
        
        if (!arrivalFromInput) {
          console.log('Could not find Arrival From field, taking screenshot...');
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `arrival_field_not_found_${Date.now()}.png`) 
          });
          throw new Error('Could not locate Arrival From field');
        }
        
        // Fill Arrival From date
        console.log("Clicking Arrival From input to activate...");
        await arrivalFromInput.click();
        console.log("Filling Arrival From with:", startDate);
        await arrivalFromInput.fill(startDate);
        
        // Find and fill Arrival To field with similar approach
        console.log('Locating Arrival To field...');
        
        const toSelectors = [
          { type: 'role', selector: page.getByRole('textbox', { name: 'Arrival To' }) },
          { type: 'id', selector: page.locator('[id*="arrivalTo"]').first() },
          { type: 'near', selector: page.locator('input').near(page.locator('label:has-text("Arrival To")').first()) },
          { type: 'css', selector: page.locator('input.x25').nth(1) } // Often the second input with same class
        ];
        
        let arrivalToInput = null;
        for (const { type, selector } of toSelectors) {
          console.log(`Trying to find Arrival To with ${type} selector...`);
          if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
            arrivalToInput = selector;
            console.log(`Found Arrival To field using ${type} selector`);
            break;
          }
        }
        
        if (arrivalToInput) {
          console.log("Clicking Arrival To input to activate...");
          await arrivalToInput.click();
          console.log("Filling Arrival To with:", endDate);
          await arrivalToInput.fill(endDate);
        } else {
          console.log('Could not find Arrival To field, will try to continue...');
        }
        
        // Set Adults count with multiple approaches
        console.log('Setting Adults count...');
        
        const adultsSelectors = [
          { type: 'role', selector: page.getByRole('textbox', { name: 'Adults' }) },
          { type: 'id', selector: page.locator('[id*="adults"], [id*="Adults"]').first() },
          { type: 'near', selector: page.locator('input').near(page.locator('label:has-text("Adults")').first()) }
        ];
        
        let adultsInput = null;
        for (const { type, selector } of adultsSelectors) {
          console.log(`Trying to find Adults field with ${type} selector...`);
          if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
            adultsInput = selector;
            console.log(`Found Adults field using ${type} selector`);
            break;
          }
        }
        
        if (adultsInput) {
          await adultsInput.click();
          await adultsInput.fill('2');
          console.log('Set Adults count to 2');
        } else {
          console.log('Could not find Adults field, will try to continue...');
        }
        
        // Enter Room number with multiple approaches
        console.log('Entering Room number...');
        
        const roomSelectors = [
          { type: 'role', selector: page.getByRole('textbox', { name: 'Room' }).nth(0) },
          { type: 'id', selector: page.locator('[id*="room"], [id*="Room"]').first() },
          { type: 'near', selector: page.locator('input').near(page.locator('label:has-text("Room")').first()) }
        ];
        
        let roomInput = null;
        for (const { type, selector } of roomSelectors) {
          console.log(`Trying to find Room field with ${type} selector...`);
          if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
            roomInput = selector;
            console.log(`Found Room field using ${type} selector`);
            break;
          }
        }
        
        if (roomInput) {
          await roomInput.click();
          await roomInput.fill(roomNumber);
          console.log(`Set Room number to ${roomNumber}`);
        } else {
          console.log('Could not find Room field, will try to continue...');
        }
        
        // Take screenshot before clicking Search
        await page.screenshot({ 
          path: path.join(__dirname, 'downloads', `before_search_${Date.now()}.png`) 
        });
        
        // Click Search button with multiple approaches
        console.log('Clicking Search button...');
        
        const searchSelectors = [
          { type: 'role', selector: page.getByRole('button', { name: 'Search', exact: true }).nth(0) },
          { type: 'text', selector: page.locator('button:has-text("Search")').first() },
          { type: 'class', selector: page.locator('.p_AFTextOnly:has-text("Search")').first() }
        ];
        
        let searchButtonFound = false;
        for (const { type, selector } of searchSelectors) {
          console.log(`Trying to find Search button with ${type} selector...`);
          if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selector.click();
            console.log(`Clicked Search button using ${type} selector`);
            searchButtonFound = true;
            break;
          }
        }
        
        if (!searchButtonFound) {
          console.log('Could not find Search button, taking screenshot...');
          await page.screenshot({ 
            path: path.join(__dirname, 'downloads', `search_button_not_found_${Date.now()}.png`) 
          });
          throw new Error('Could not find Search button');
        }
        
        await page.waitForTimeout(5000);
      } catch (formError) {
        console.log('Error filling reservation details form:', formError.message);
        
        // Take error screenshot
        await page.screenshot({ 
          path: path.join(__dirname, 'downloads', `form_error_${Date.now()}.png`) 
        }).catch(e => console.log('Could not take error screenshot:', e.message));
        
        throw formError;
      }
      
      // Click Search in Room Details
      const roomDetailsSearch = page.getByLabel('Room Details').getByRole('button', { name: 'Search', exact: true });
      await roomDetailsSearch.waitFor({ state: 'visible', timeout: 10000 });
      await roomDetailsSearch.click();
      await page.waitForTimeout(3000);
      
      // Click Modify Search Criteria if needed
      const modifySearchLink = page.getByRole('link', { name: 'Modify Search Criteria' });
      if (await modifySearchLink.isVisible({ timeout: 3000 })) {
        await modifySearchLink.click();
        
        // Fill in room number in the Room Details dialog
        const roomDetailsDialog = page.getByRole('dialog', { name: 'Room Details' });
        const roomDetailInput = roomDetailsDialog.getByLabel('Room', { exact: true });
        await roomDetailInput.waitFor({ state: 'visible', timeout: 5000 });
        await roomDetailInput.fill(roomNumber);
        
        // Click Search in Room Details again
        const roomDetailSearchBtn = page.getByLabel('Room Details').getByRole('button', { name: 'Search', exact: true });
        await roomDetailSearchBtn.waitFor({ state: 'visible', timeout: 5000 });
        await roomDetailSearchBtn.click();
        await page.waitForTimeout(3000);
      }
      
      // Select Room
      console.log('Selecting room...');
      const selectRoomLink = page.getByRole('link', { name: 'Select Room' });
      await selectRoomLink.waitFor({ state: 'visible', timeout: 10000 });
      await selectRoomLink.click();
      await page.waitForTimeout(2000);
      
      // Click Search again (for rates)
      const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true });
      await searchRatesButton.waitFor({ state: 'visible', timeout: 5000 });
      await searchRatesButton.click();
      await page.waitForTimeout(3000);
      
      // Select a rate (this selector might need adjustment based on actual UI)
      console.log('Selecting rate...');
      try {
        // This selector from your original code may need verification
        const rateSelector = page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]');
        await rateSelector.waitFor({ state: 'visible', timeout: 10000 });
        await rateSelector.click();
      } catch (rateError) {
        console.log('Could not find specific rate selector:', rateError.message);
        
        // Try to find any rate option
        console.log('Trying to select any available rate...');
        const anyRateOption = page.locator('tr[_afrrk]').first();
        await anyRateOption.waitFor({ state: 'visible', timeout: 5000 });
        await anyRateOption.click();
      }
      
      // Click Select button
      const selectButton = page.getByRole('button', { name: 'Select', exact: true });
      await selectButton.waitFor({ state: 'visible', timeout: 5000 });
      await selectButton.click();
      await page.waitForTimeout(2000);
      
      // Fill Discount Amount
      console.log('Entering discount information...');
      const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' });
      await discountAmountInput.waitFor({ state: 'visible', timeout: 10000 });
      await discountAmountInput.click();
      await discountAmountInput.fill(discountAmount);
      
      // Fill Discount Code
      const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' });
      await discountCodeInput.waitFor({ state: 'visible', timeout: 5000 });
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      
      // Select Payment Method
      const methodSelect = page.getByLabel('Method');
      await methodSelect.waitFor({ state: 'visible', timeout: 5000 });
      await methodSelect.selectOption('FCA');
      
      // Book Now
      console.log('Completing booking...');
      const bookNowButton = page.getByRole('button', { name: 'Book Now' });
      await bookNowButton.waitFor({ state: 'visible', timeout: 5000 });
      await bookNowButton.click();
      await page.waitForTimeout(5000);
      
      // Add Notes
      console.log('Adding booking note...');
      const notesLink = page.getByRole('link', { name: 'Notes (1)' });
      await notesLink.waitFor({ state: 'visible', timeout: 10000 });
      await notesLink.click();
      
      // Click New Note
      const newNoteLink = page.getByRole('link', { name: 'New' });
      await newNoteLink.waitFor({ state: 'visible', timeout: 5000 });
      await newNoteLink.click();
      
      // Fill Type
      const typeInput = page.getByRole('textbox', { name: 'Type' });
      await typeInput.waitFor({ state: 'visible', timeout: 5000 });
      await typeInput.click();
      await typeInput.fill('PAY');
      
      // Fill Comment
      const commentInput = page.getByRole('textbox', { name: 'Comment' });
      await commentInput.waitFor({ state: 'visible', timeout: 5000 });
      await commentInput.click();
      await commentInput.fill(`${firstName} ${clientName} - AirBnB`);
      
      // Save Note
      const saveNoteButton = page.locator('div').filter({ hasText: /^Save$/ }).first();
      await saveNoteButton.waitFor({ state: 'visible', timeout: 5000 });
      await saveNoteButton.click();
      await page.waitForTimeout(2000);
      
      // Close Notes
      const closeLink = page.getByRole('link', { name: 'Close' });
      await closeLink.waitFor({ state: 'visible', timeout: 5000 });
      await closeLink.click();
      
      // Exit Booking
      console.log('Exiting booking...');
      const exitBookingButton = page.getByRole('button', { name: 'Exit Booking' });
      await exitBookingButton.waitFor({ state: 'visible', timeout: 10000 });
      await exitBookingButton.click();
      
      console.log(`Booking completed successfully for ${firstName} ${clientName}, room ${roomNumber}`);
      return {
        success: true,
        message: `Booking created for ${firstName} ${clientName} in room ${roomNumber}`
      };
      
    } catch (error) {
      console.error(`Error creating booking: ${error.message}`);
      
      // Take screenshot of the error
      try {
        const downloadsPath = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadsPath)) {
          fs.mkdirSync(downloadsPath, { recursive: true });
        }
        
        await this.page.screenshot({ 
          path: path.join(downloadsPath, `booking_error_${Date.now()}.png`) 
        });
        console.log('Error screenshot saved');
      } catch (screenshotError) {
        console.log('Could not save error screenshot:', screenshotError.message);
      }
      
      return {
        success: false,
        error: error.message
      };
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

/**
 * Makes a booking in the Opera Cloud system
 * @param {string} clientName - Last name of the client
 * @param {string} firstName - First name of the client
 * @param {string} telephoneNumber - Mobile phone number
 * @param {string} roomNumber - Room number to book
 * @param {string} startDate - Check-in date in format DD.MM.YYYY
 * @param {string} endDate - Check-out date in format DD.MM.YYYY
 * @param {string} discountAmount - Discount amount to apply
 * @param {string} discountCode - Discount code, defaults to 'OTH'
 * @returns {Object} Result object with success flag and message or error
 */
async function makeBooking(clientName, firstName, telephoneNumber, roomNumber, 
                         startDate, endDate, discountAmount, discountCode = 'OTH') {
  const bookingAutomation = new LookToBookAutomation();
  
  try {
    console.log(`Starting booking process for ${firstName} ${clientName}, room ${roomNumber}...`);
    console.log(`Check-in: ${startDate}, Check-out: ${endDate}`);
    
    // Initialize the automation (including login)
    const initialized = await bookingAutomation.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize the booking automation');
    }
    
    // Create the booking
    const result = await bookingAutomation.createBooking(
      clientName, 
      firstName, 
      telephoneNumber, 
      roomNumber, 
      startDate, 
      endDate, 
      discountAmount, 
      discountCode
    );
    
    console.log('Booking result:', result);
    return result;
  } catch (error) {
    console.error('Error in booking process:', error.message);
    
    // Take final error screenshot if possible
    try {
      const downloadsPath = path.join(__dirname, 'downloads');
      if (bookingAutomation.page && !bookingAutomation.page.isClosed()) {
        await bookingAutomation.page.screenshot({ 
          path: path.join(downloadsPath, `final_error_${Date.now()}.png`) 
        });
      }
    } catch (screenshotError) {
      console.log('Could not take final error screenshot:', screenshotError.message);
    }
    
    return { 
      success: false, 
      error: error.message,
      details: `Failed to book room ${roomNumber} for ${firstName} ${clientName}`
    };
  } finally {
    // Always clean up resources
    await bookingAutomation.cleanup();
  }
}

/**
 * Main execution function for CLI use
 */
async function main() {
  if (require.main !== module) return;
  
  try {
    // Check for environment variables
    if (!process.env.OPERA_USERNAME || !process.env.OPERA_PASSWORD) {
      console.error('Error: OPERA_USERNAME and OPERA_PASSWORD must be set in .env file');
      process.exit(1);
    }
    
    // Get command line arguments or use defaults
    const clientName = process.argv[2] || 'TestClient';
    const firstName = process.argv[3] || 'Test';
    const telephoneNumber = process.argv[4] || '1234567890';
    const roomNumber = process.argv[5] || '0420';
    const startDate = process.argv[6] || '01.05.2024';
    const endDate = process.argv[7] || '05.05.2024';
    const discountAmount = process.argv[8] || '368';
    const discountCode = process.argv[9] || 'OTH';
    
    console.log('Running booking with parameters:');
    console.log(`Client: ${firstName} ${clientName}`);
    console.log(`Phone: ${telephoneNumber}`);
    console.log(`Room: ${roomNumber}`);
    console.log(`Dates: ${startDate} to ${endDate}`);
    console.log(`Discount: ${discountAmount} (${discountCode})`);
    
    // Make the booking
    const result = await makeBooking(
      clientName,
      firstName,
      telephoneNumber,
      roomNumber,
      startDate,
      endDate,
      discountAmount,
      discountCode
    );
    
    // Output result
    if (result.success) {
      console.log('✅ Booking completed successfully!');
      console.log(result.message);
      process.exit(0);
    } else {
      console.error('❌ Booking failed:');
      console.error(result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Critical error in main execution:', error.message);
    process.exit(1);
  }
}

// Run main if executed directly
main().catch(error => {
  console.error('Unhandled error in main execution:', error);
  process.exit(1);
});

module.exports = {
  LookToBookAutomation,
  makeBooking
};
