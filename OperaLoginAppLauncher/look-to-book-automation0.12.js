require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

// Helper function to handle the Select button
async function handleSelectButton(page) {
  console.log('Looking for Select button with JavaScript approach...');
  
  // Take screenshot before attempting to click Select
  try {
    await page.screenshot({ 
      path: path.join(__dirname, 'downloads', `before_select_click_${Date.now()}.png`) 
    });
  } catch (screenshotError) {
    console.log('Error taking screenshot:', screenshotError.message);
  }
  
  try {
    // First try to find any element containing "Select" text and click it
    console.log('Trying to find and click any element with "Select" text...');
    
    // This uses JavaScript evaluation to find elements with "Select" text
    const selectClicked = await page.evaluate(() => {
      // Find all elements containing "Select" text
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent && el.textContent.includes('Select'));
      
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
      return true;
    }
    
    console.log('Could not find elements with "Select" text, trying button elements...');
    
    // Try to find and click any button elements
    const buttonClicked = await page.evaluate(() => {
      // Find all button elements
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a.button, [role="button"]'));
      
      // Filter to those that might be Select buttons
      const selectButtons = buttons.filter(btn => 
        (btn.textContent && btn.textContent.toLowerCase().includes('select')) || 
        (btn.value && btn.value.toLowerCase().includes('select'))
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
      return true;
    }
    
    console.log('Could not find button elements for Select, trying parent element approach...');
    
    // Try the parent element approach as suggested
    const parentElementClicked = await page.evaluate(() => {
      // Try to find elements with Select text and click their parent
      const selectElements = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent && el.textContent.trim() === 'Select');
      
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
      return true;
    }
    
    // Fall back to playwright selectors if all JavaScript approaches fail
    console.log('JavaScript approaches failed, falling back to Playwright selectors...');
    
    // Try various selectors to find the Select button
    const selectButton = page.getByRole('button', { name: 'Select' });
    if (await selectButton.isVisible({ timeout: 3000 })) {
      await selectButton.click();
      console.log('Clicked Select button by role');
      return true;
    }
    
    // Try by text
    const selectByText = page.locator('text="Select"').first();
    if (await selectByText.isVisible({ timeout: 3000 })) {
      await selectByText.click();
      console.log('Clicked element with exact Select text');
      return true;
    }
    
    // Last attempt - try any element containing Select
    const anySelect = page.locator(':text("Select")').first();
    if (await anySelect.isVisible({ timeout: 3000 })) {
      await anySelect.click();
      console.log('Clicked element containing Select text');
      return true;
    }
    
    console.log('No Select button found, taking screenshot and trying to continue...');
    try {
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `select_button_not_found_${Date.now()}.png`) 
      });
    } catch (screenshotError) {
      console.log('Error taking screenshot:', screenshotError.message);
    }
    return false;
    
  } catch (selectError) {
    console.log('Error clicking Select button:', selectError.message);
    
    // Take error screenshot
    try {
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `select_error_${Date.now()}.png`) 
      });
    } catch (screenshotError) {
      console.log('Error taking screenshot:', screenshotError.message);
    }
    
    // Try to proceed anyway in case the selection happened despite the error
    console.log('Attempting to continue despite Select button error...');
    return false;
  }
}

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
      
      // First ensure we are logged in
      if (!this.isLoggedIn) {
        console.log('Not logged in. Initializing login...');
        await this.initialize();
      }
      
      // Verify we have a valid page
      if (!this.page || this.page.isClosed()) {
        console.log('Page is null or closed. Restarting browser...');
        await this.restartBrowser();
      }
      
      // Try to verify we're on an Opera Cloud page
      try {
        const currentUrl = await this.page.url();
        console.log(`Current URL before starting booking: ${currentUrl}`);
        
        // Check if we need to navigate to the main app
        if (!currentUrl.includes('operacloud') || !currentUrl.includes('OperaCloud')) {
          console.log('Not on main OperaCloud interface, navigating...');
          await this.page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
        }
      } catch (urlError) {
        console.log('Error checking URL:', urlError.message);
        console.log('URL check failed, attempting to recover...');
        await this.restartBrowser();
      }
      
      // Navigate to Look To Book Sales Screen
      await this.navigateToLookToBookScreen();
      
      // Take screenshot of successful navigation
      const downloadsPath = path.join(__dirname, 'downloads');
      await this.page.screenshot({ 
        path: path.join(downloadsPath, `look_to_book_screen_${Date.now()}.png`) 
      });
      
      // Enter Travel Agent and search
      console.log('Entering travel agent...');
      const travelAgentInput = this.page.getByRole('textbox', { name: 'Travel Agent' });
      await travelAgentInput.waitFor({ state: 'visible', timeout: 10000 });
      await travelAgentInput.click();
      await travelAgentInput.fill('airbnb');
      
      // Click on the search link for Travel Agent (the magnifying glass icon)
      console.log('Clicking travel agent search icon...');
      
      // Try multiple approaches to find and click the search link
      try {
        // First try the specific ID from the screenshot
        console.log('Trying to find search button by ID...');
        const searchById = this.page.locator('a[id*="oc_srclov_dummy_link"]');
        if (await searchById.isVisible({ timeout: 3000 })) {
          console.log('Found search button by ID, clicking...');
          await searchById.click();
        } else {
          // Try by the filter method from original code
          console.log('Trying filter method...');
          const searchLink = this.page.locator("div")
            .filter({ hasText: /^Travel AgentSource$/ })
            .getByRole("link")
            .first();
          
          if (await searchLink.isVisible({ timeout: 3000 })) {
            console.log('Found search link by filter, clicking...');
            await searchLink.click();
          } else {
            // Try a more generic approach
            console.log('Trying generic magnifying glass icon...');
            const genericSearch = this.page.locator('a.x47a, a.xt1, [aria-label*="Search"]').first();
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
      
      await this.page.waitForTimeout(2000);
      
      // Handle the popup dialog that appears after search
      console.log('Looking for search popup dialog...');
      try {
        // Look for the popup containing the search results
        const searchPopup = this.page.locator('div[role="dialog"], .x1qp, .x1py').first();
        if (await searchPopup.isVisible({ timeout: 5000 })) {
          console.log('Search popup detected, looking for Search button within popup...');
          
          // Take a screenshot of the popup
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `search_popup_${Date.now()}.png`) 
          });
          
          // Use the specific selector for search button
          console.log('Using specific selector for search button...');
          const specificSearchButton = this.
          page.locator('span.x44s.x20 > div[role="presentation"][_afrgrp="0"]');
          
          if (await specificSearchButton.isVisible({ timeout: 5000 })) {
            console.log('Found search button using specific selector, clicking...');
            await specificSearchButton.click();
            await this.page.waitForTimeout(2000);
          } else {
            // Fall back to other methods if specific selector isn't visible
            console.log('Specific selector not visible, trying alternative methods...');
            
            // Try to find and click the Search button in the popup
            const popupSearchButton = this.page.getByRole('button', { name: 'Search' }).nth(0);
            if (await popupSearchButton.isVisible({ timeout: 3000 })) {
              console.log('Found Search button in popup, clicking...');
              await popupSearchButton.click();
              await this.page.waitForTimeout(2000);
            } else {
              // Try using JavaScript-based approaches
              await handleSelectButton(this.page);
            }
          }
        } else {
          console.log('No search popup detected, continuing...');
        }
      } catch (popupError) {
        console.log('Error handling search popup:', popupError.message);
      }
      
      await this.page.waitForTimeout(3000);
      
      // Based on the screenshot, we need to handle the Profile Search popup
      console.log('Handling Profile Search popup...');
      
      // Take screenshot to verify current state
      await this.page.screenshot({ 
        path: path.join(__dirname, 'downloads', `profile_search_${Date.now()}.png`) 
      });
      
      // Check if we're in the Profile Search popup
      const profileSearchHeading = this.page.locator('text="Manage Profile"').first();
      const isProfileSearch = await profileSearchHeading.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isProfileSearch) {
        console.log('Found Profile Search popup');
        
        // Check if we have search results with AirBnB
        const airBnBEntry = this.page.locator('text="AirBnB"').first();
        const hasAirBnBResult = await airBnBEntry.isVisible({ timeout: 5000 }).catch(() => false);
        
        // Replace this section in your look-to-book.js file
        
        if (hasAirBnBResult) {
          console.log('AirBnB entry found in search results');
          
          // Take screenshot before selecting
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `airbnb_entry_found_${Date.now()}.png`) 
          });
          
          // Click on the AirBnB row first to select it
          try {
            console.log('Attempting to click on AirBnB row...');
            await airBnBEntry.click();
            console.log('Clicked on AirBnB entry');
            await this.page.waitForTimeout(1000);
            
            // Take screenshot after clicking the AirBnB entry
            await this.page.screenshot({ 
              path: path.join(__dirname, 'downloads', `after_airbnb_click_${Date.now()}.png`) 
            });
          } catch (rowClickError) {
            console.log('Error clicking AirBnB row:', rowClickError.message);
          }
          
          // Use the specialized function to click the Select button
          console.log('Using specialized function to click Select button...');
          const selectResult = await clickAirBnBSelectButton(this.page);
          
          if (selectResult) {
            console.log('Successfully clicked Select button');
          } else {
            console.log('Failed to click Select button with specialized function, trying other methods...');
            
            // Fall back to the original helper function
            await handleSelectButton(this.page);
          }
          
          // Wait longer after Select attempt to ensure page has time to respond
          console.log('Waiting for page to respond after Select click...');
          await this.page.waitForTimeout(5000);
        } else {
          // If no AirBnB result, create a new profile
          console.log('No AirBnB result found, will create a new profile');
          
          // Click New Profile button
          const newProfileLink = this.page.getByRole('link', { name: 'New Profile' });
          if (await newProfileLink.isVisible({ timeout: 3000 })) {
            await newProfileLink.click();
            console.log('Clicked New Profile link');
          } else {
            // Try alternative selector
            const altNewProfile = this.page.locator('a:has-text("New Profile")').first();
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
        
        let contentFrame;
        try {
          const iframeLocator = this.page.frameLocator('iframe[title="Content"]');
          contentFrame = iframeLocator;
          console.log('Found Content iframe');
          
          // Try to click on the search result action button
          console.log('Clicking on search result...');
          
          const actionButtonSelector = '[id="pt1\\:oc_srch_lov_tmpl\\:r1\\:0\\:pt1\\:oc_srch_tmpl_esmin1\\:ode_bscrn_tmpl\\:lkuprgn\\:0\\:pt1\\:oc_srch_rslts_tbl_tmpl\\:ab1\\:odec_axn_br_axns_pstv_i\\:0\\:odec_axn_br_axn_pstv"]';
          
          // First try with the iframe
          try {
            const actionButton = contentFrame.locator(actionButtonSelector);
            await actionButton.waitFor({ state: 'visible', timeout: 5000 });
            await actionButton.click();
            console.log('Clicked action button via iframe');
          } catch (iframeError) {
            console.log('Could not find action button in iframe:', iframeError.message);
            
            // Try to find New Profile link directly
            console.log('Trying to find New Profile link directly...');
            const newProfileLink = this.page.getByRole('link', { name: 'New Profile' });
            if (await newProfileLink.isVisible({ timeout: 3000 })) {
              await newProfileLink.click();
              console.log('Clicked New Profile link directly');
            } else {
              throw new Error('Could not find New Profile button or link');
            }
          }
        } catch (frameError) {
          console.log('Error handling iframe:', frameError.message);
          
          // Last resort - try to find a generic New Profile link
          const genericNewProfile = this.page.locator('a, button', { hasText: /New Profile/i }).first();
          if (await genericNewProfile.isVisible({ timeout: 3000 })) {
            await genericNewProfile.click();
            console.log('Clicked generic New Profile element');
          } else {
            throw new Error('All attempts to find New Profile link failed');
          }
        }
      }
      
      // Wait a moment for any redirects/reloads after selecting AirBnB
      console.log('Waiting for page to stabilize after AirBnB selection...');
      await this.page.waitForTimeout(5000);
      
      // Take screenshot at this point
      await this.page.screenshot({ 
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
          this.page.getByRole('textbox', { name: 'Arrival From' }),
          this.page.locator('[id*="arrivalFrom"]'),
          this.page.locator('input[placeholder*="Arrival"]').first(),
          this.page.locator('label:has-text("Arrival From")').first()
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
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `page_not_ready_${Date.now()}.png`) 
          });
        }
        
        // Locate the Arrival From field using multiple approaches
        console.log('Locating Arrival From field...');
        
        // Try multiple selectors to find the date input fields
        const arrivalSelectors = [
          { type: 'role', selector: this.page.getByRole('textbox', { name: 'Arrival From' }) },
          { type: 'id', selector: this.page.locator('[id*="arrivalFrom"]').first() },
          { type: 'placeholder', selector: this.page.locator('input[placeholder*="Arrival"]').first() },
          { type: 'near', selector: this.page.locator('input').near(this.page.locator('label:has-text("Arrival From")').first()) },
          { type: 'css', selector: this.page.locator('input.x25').first() } // Common Opera Cloud input class
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
          await this.page.screenshot({ 
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
          { type: 'role', selector: this.page.getByRole('textbox', { name: 'Arrival To' }) },
          { type: 'id', selector: this.page.locator('[id*="arrivalTo"]').first() },
          { type: 'near', selector: this.page.locator('input').near(this.page.locator('label:has-text("Arrival To")').first()) },
          { type: 'css', selector: this.page.locator('input.x25').nth(1) } // Often the second input with same class
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
          { type: 'role', selector: this.page.getByRole('textbox', { name: 'Adults' }) },
          { type: 'id', selector: this.page.locator('[id*="adults"], [id*="Adults"]').first() },
          { type: 'near', selector: this.page.locator('input').near(this.page.locator('label:has-text("Adults")').first()) }
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
          { type: 'role', selector: this.page.getByRole('textbox', { name: 'Room' }).nth(0) },
          { type: 'id', selector: this.page.locator('[id*="room"], [id*="Room"]').first() },
          { type: 'near', selector: this.page.locator('input').near(this.page.locator('label:has-text("Room")').first()) }
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
        await this.page.screenshot({ 
          path: path.join(__dirname, 'downloads', `before_search_${Date.now()}.png`) 
        });
        
        // Click Search button with multiple approaches
        console.log('Clicking Search button...');
        
        const searchSelectors = [
          { type: 'role', selector: this.page.getByRole('button', { name: 'Search', exact: true }).nth(0) },
          { type: 'text', selector: this.page.locator('button:has-text("Search")').first() },
          { type: 'class', selector: this.page.locator('.p_AFTextOnly:has-text("Search")').first() }
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
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `search_button_not_found_${Date.now()}.png`) 
          });
          throw new Error('Could not find Search button');
        }
        
        await this.page.waitForTimeout(5000);
        
        // Click Search in Room Details
        console.log('Looking for Room Details Search button...');
        const roomDetailsSearch = this.page.getByLabel('Room Details').getByRole('button', { name: 'Search', exact: true });
        if (await roomDetailsSearch.isVisible({ timeout: 10000 })) {
          console.log('Found Room Details Search button, clicking...');
          await roomDetailsSearch.click();
          await this.page.waitForTimeout(3000);
        } else {
          console.log('Room Details Search button not found, trying alternative selectors...');
          
          // Try alternative selectors
          const altRoomDetailSearch = this.page.locator('button:has-text("Search")').nth(1);
          if (await altRoomDetailSearch.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Room Details Search button, clicking...');
            await altRoomDetailSearch.click();
            await this.page.waitForTimeout(3000);
          } else {
            console.log('No Room Details Search button found, continuing...');
          }
        }
        
        // Check if we need to Modify Search Criteria
        const modifySearchLink = this.page.getByRole('link', { name: 'Modify Search Criteria' });
        if (await modifySearchLink.isVisible({ timeout: 5000 })) {
          console.log('Found Modify Search Criteria link, clicking...');
          await modifySearchLink.click();
          
          // Fill in room number in the Room Details dialog
          const roomDetailsDialog = this.page.getByRole('dialog', { name: 'Room Details' });
          const roomDetailInput = roomDetailsDialog.getByLabel('Room', { exact: true });
          
          if (await roomDetailInput.isVisible({ timeout: 5000 })) {
            console.log('Found Room field in dialog, filling with room number...');
            await roomDetailInput.fill(roomNumber);
            
            // Click Search in Room Details again
            const roomDetailSearchBtn = this.page.getByLabel('Room Details').getByRole('button', { name: 'Search', exact: true });
            if (await roomDetailSearchBtn.isVisible({ timeout: 5000 })) {
              console.log('Clicking Search button in Room Details dialog...');
              await roomDetailSearchBtn.click();
              await this.page.waitForTimeout(3000);
            } else {
              console.log('Search button in Room Details dialog not found, trying alternatives...');
              
              // Try alternative selectors
              const altDetailSearch = roomDetailsDialog.locator('button:has-text("Search")').first();
              if (await altDetailSearch.isVisible({ timeout: 3000 })) {
                console.log('Found alternative Search button in dialog, clicking...');
                await altDetailSearch.click();
                await this.page.waitForTimeout(3000);
              }
            }
          } else {
            console.log('Room field not found in Room Details dialog, continuing...');
          }
        }
        
        // Select Room
        console.log('Looking for Select Room link...');
        const selectRoomLink = this.page.getByRole('link', { name: 'Select Room' });
        
        if (await selectRoomLink.isVisible({ timeout: 10000 })) {
          console.log('Found Select Room link, clicking...');
          await selectRoomLink.click();
          await this.page.waitForTimeout(2000);
        } else {
          console.log('Select Room link not found, taking screenshot and trying alternatives...');
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `select_room_not_found_${Date.now()}.png`) 
          });
          
          // Try alternative selectors
          const altSelectRoom = this.page.locator('a:has-text("Select Room")').first();
          if (await altSelectRoom.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Select Room link, clicking...');
            await altSelectRoom.click();
            await this.page.waitForTimeout(2000);
          } else {
            console.log('No Select Room link found via alternatives, continuing...');
          }
        }
        
        // Click Search for rates
        console.log('Clicking Search for rates...');
        const searchRatesButton = this.page.getByRole('button', { name: 'Search', exact: true });
        
        if (await searchRatesButton.isVisible({ timeout: 5000 })) {
          await searchRatesButton.click();
          console.log('Clicked Search button for rates');
          await this.page.waitForTimeout(3000);
        } else {
          console.log('Search button for rates not found, trying alternatives...');
          
          // Try alternative selectors
          const altSearchRates = this.page.locator('button:has-text("Search")').first();
          if (await altSearchRates.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Search button for rates, clicking...');
            await altSearchRates.click();
            await this.page.waitForTimeout(3000);
          }
        }
        
        // Select a rate
        console.log('Selecting rate...');
        try {
          // Take screenshot to see available rates
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `available_rates_${Date.now()}.png`) 
          });
          
          // First try the specific selector from the original code
          const rateSelector = this.page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]');
          
          if (await rateSelector.isVisible({ timeout: 5000 })) {
            console.log('Found specific rate selector, clicking...');
            await rateSelector.click();
            await this.page.waitForTimeout(1000);
          } else {
            console.log('Specific rate selector not found, trying to select any available rate...');
            
            // Try to find any rate row
            const anyRateOption = this.page.locator('tr[_afrrk]').first();
            if (await anyRateOption.isVisible({ timeout: 3000 })) {
              console.log('Found a rate row, clicking...');
              await anyRateOption.click();
              await this.page.waitForTimeout(1000);
            } else {
              // Try to find any clickable element in the rates area
              console.log('No rate rows found, looking for any clickable element in rates area...');
              const ratesArea = this.page.locator('div:has-text("Rate Code")').first();
              
              if (await ratesArea.isVisible({ timeout: 3000 })) {
                // Try to click a nearby element that might be a rate
                const nearbyElement = this.page.locator('tr').near(ratesArea).first();
                if (await nearbyElement.isVisible({ timeout: 2000 })) {
                  console.log('Found an element near rates area, clicking...');
                  await nearbyElement.click();
                  await this.page.waitForTimeout(1000);
                }
              }
            }
          }
        } catch (rateError) {
          console.log('Error selecting rate:', rateError.message);
        }
        
        // Click Select button to select the rate
        console.log('Clicking Select button for rate...');
        const selectButton = this.page.getByRole('button', { name: 'Select', exact: true });
        
        if (await selectButton.isVisible({ timeout: 5000 })) {
          await selectButton.click();
          console.log('Clicked Select button for rate');
          await this.page.waitForTimeout(2000);
        } else {
          console.log('Select button not found, trying JavaScript approach...');
          await handleSelectButton(this.page);
          await this.page.waitForTimeout(2000);
        }
        
        // Fill Discount Amount
        console.log('Entering discount information...');
        const discountAmountInput = this.page.getByRole('textbox', { name: 'Discount Amount' });
        
        if (await discountAmountInput.isVisible({ timeout: 10000 })) {
          await discountAmountInput.click();
          await discountAmountInput.fill(discountAmount);
          console.log(`Set Discount Amount to ${discountAmount}`);
        } else {
          console.log('Discount Amount field not found, trying alternatives...');
          
          // Try alternative selectors
          const altDiscountInput = this.page.locator('[id*="discount"], [id*="Discount"]').first();
          if (await altDiscountInput.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Discount Amount field, filling...');
            await altDiscountInput.click();
            await altDiscountInput.fill(discountAmount);
          } else {
            console.log('No Discount Amount field found, continuing...');
          }
        }
        
        // Fill Discount Code
        const discountCodeInput = this.page.getByRole('textbox', { name: 'Discount Code' });
        
        if (await discountCodeInput.isVisible({ timeout: 5000 })) {
          await discountCodeInput.click();
          await discountCodeInput.fill(discountCode);
          console.log(`Set Discount Code to ${discountCode}`);
        } else {
          console.log('Discount Code field not found, trying alternatives...');
          
          // Try to find by proximity to the Discount Amount field
          const nearDiscountCode = this.page.locator('input').near(discountAmountInput).nth(1);
          if (await nearDiscountCode.isVisible({ timeout: 2000 })) {
            console.log('Found potential Discount Code field by proximity, filling...');
            await nearDiscountCode.click();
            await nearDiscountCode.fill(discountCode);
          }
        }
        
        // Select Payment Method
        console.log('Setting payment method...');
        const methodSelect = this.page.getByLabel('Method');
        
        if (await methodSelect.isVisible({ timeout: 5000 })) {
          await methodSelect.selectOption('FCA');
          console.log('Selected FCA payment method');
        } else {
          console.log('Method dropdown not found, trying alternatives...');
          
          // Try by ID pattern
          const altMethodSelect = this.page.locator('select[id*="method"], select[id*="Method"]').first();
          if (await altMethodSelect.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Method dropdown, selecting...');
            await altMethodSelect.selectOption('FCA');
          }
        }
        
        // Book Now
        console.log('Completing booking...');
        const bookNowButton = this.page.getByRole('button', { name: 'Book Now' });
        
        if (await bookNowButton.isVisible({ timeout: 5000 })) {
          await bookNowButton.click();
          console.log('Clicked Book Now button');
          await this.page.waitForTimeout(5000);
        } else {
          console.log('Book Now button not found, trying alternatives...');
          
          // Try other selectors
          const altBookNow = this.page.locator('button:has-text("Book Now")').first();
          if (await altBookNow.isVisible({ timeout: 3000 })) {
            console.log('Found alternative Book Now button, clicking...');
            await altBookNow.click();
            await this.page.waitForTimeout(5000);
          } else {
            throw new Error('Could not find Book Now button');
          }
        }
        
        // Add Notes
        console.log('Adding booking note...');
        const notesLink = this.page.getByRole('link', { name: 'Notes (1)' });
        
        if (await notesLink.isVisible({ timeout: 10000 })) {
          await notesLink.click();
          console.log('Clicked Notes link');
          
          // Click New Note
          const newNoteLink = this.page.getByRole('link', { name: 'New' });
          if (await newNoteLink.isVisible({ timeout: 5000 })) {
            await newNoteLink.click();
            console.log('Clicked New Note link');
            
            // Fill Type
            const typeInput = this.page.getByRole('textbox', { name: 'Type' });
            if (await typeInput.isVisible({ timeout: 5000 })) {
              await typeInput.click();
              await typeInput.fill('PAY');
              console.log('Set Note Type to PAY');
              
              // Fill Comment
              const commentInput = this.page.getByRole('textbox', { name: 'Comment' });
              if (await commentInput.isVisible({ timeout: 5000 })) {
                await commentInput.click();
                await commentInput.fill(`${firstName} ${clientName} - AirBnB`);
                console.log('Added comment to note');
                
                // Save Note
                const saveNoteButton = this.page.locator('div').filter({ hasText: /^Save$/ }).first();
                if (await saveNoteButton.isVisible({ timeout: 5000 })) {
                  await saveNoteButton.click();
                  console.log('Saved note');
                  await this.page.waitForTimeout(2000);
                }
              }
            }
            
            // Close Notes
            const closeLink = this.page.getByRole('link', { name: 'Close' });
            if (await closeLink.isVisible({ timeout: 5000 })) {
              await closeLink.click();
              console.log('Closed Notes dialog');
            }
          }
        } else {
          console.log('Notes link not found, skipping note creation...');
        }
        
        // Exit Booking
        console.log('Exiting booking...');
        const exitBookingButton = this.page.getByRole('button', { name: 'Exit Booking' });
        
        if (await exitBookingButton.isVisible({ timeout: 10000 })) {
          await exitBookingButton.click();
          console.log('Clicked Exit Booking button');
        } else {
          console.log('Exit Booking button not found, taking screenshot...');
          await this.page.screenshot({ 
            path: path.join(__dirname, 'downloads', `exit_booking_not_found_${Date.now()}.png`) 
          });
        }
        
        console.log(`Booking completed successfully for ${firstName} ${clientName}, room ${roomNumber}`);
        return {
          success: true,
          message: `Booking created for ${firstName} ${clientName} in room ${roomNumber}`
        };
      } catch (formError) {
        console.log('Error filling reservation details form:', formError.message);
        
        // Take error screenshot
        await this.page.screenshot({ 
          path: path.join(__dirname, 'downloads', `form_error_${Date.now()}.png`) 
        }).catch(e => console.log('Could not take error screenshot:', e.message));
        
        throw formError;
      }
    } catch (error) {
      console.error(`Error creating booking: ${error.message}`);
      
      // Take screenshot of the error
      try {
        const downloadsPath = path.join(__dirname, 'downloads');
        if (!fs.existsPath(downloadsPath)) {
            fs.mkdirSync(downloadsPath, { recursive: true });
          }
          
          if (this.page && !this.page.isClosed()) {
            await this.page.screenshot({ 
              path: path.join(downloadsPath, `booking_error_${Date.now()}.png`) 
            });
            console.log('Error screenshot saved');
          }
        } catch (screenshotError) {
          console.log('Could not take error screenshot:', screenshotError.message);
        }
        
        return {
          success: false,
          error: error.message,
          details: `Failed to book room ${roomNumber} for ${firstName} ${clientName}`
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
  

// Add this specific function to your look-to-book.js file to handle the AirBnB Select button
async function clickAirBnBSelectButton(page) {
    console.log('Attempting to click the AirBnB Select button...');
    
    try {
      // Take screenshot before attempting
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `before_airbnb_select_${Date.now()}.png`) 
      });
      
      // First try: The specific teal/aqua colored "Select" button in the bottom right corner
      console.log('Looking for teal-colored Select button in the bottom right...');
      const bottomRightSelect = page.locator('button.p_AFTextOnly:has-text("Select")').last();
      
      if (await bottomRightSelect.isVisible({ timeout: 5000 })) {
        console.log('Found bottom right Select button, clicking...');
        await bottomRightSelect.click();
        console.log('Clicked bottom right Select button');
        await page.waitForTimeout(2000);
        return true;
      }
      
      // Second try: Try to find the button specifically in the footer/action area
      console.log('Looking for Select button in dialog footer area...');
      
      // These are common class names for footer/action areas in Oracle Cloud
      const footerSelect = page.locator('.footer-area button:has-text("Select"), .action-buttons button:has-text("Select"), .dialog-footer button:has-text("Select")').first();
      
      if (await footerSelect.isVisible({ timeout: 3000 })) {
        console.log('Found Select button in footer area, clicking...');
        await footerSelect.click();
        console.log('Clicked footer Select button');
        await page.waitForTimeout(2000);
        return true;
      }
      
      // Third try: Direct pixel targeting based on the button's position
      console.log('Using direct JavaScript to click the bottom right button...');
      
      // Using JavaScript to find the bottom-right button
      const buttonClicked = await page.evaluate(() => {
        // Look for buttons in the bottom portion of the screen
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Sort buttons by their vertical position (focus on bottom ones)
        const bottomButtons = buttons
          .filter(btn => {
            const rect = btn.getBoundingClientRect();
            // Filter for buttons in the bottom 25% of the viewport
            return rect.bottom > window.innerHeight * 0.75;
          })
          .filter(btn => {
            // Look for buttons that might be our target
            return btn.textContent.includes('Select') || 
                   btn.innerText.includes('Select') ||
                   btn.className.includes('Select');
          });
        
        // Look for the most likely candidate - bottom right
        if (bottomButtons.length > 0) {
          // Sort by position (rightmost, bottommost first)
          bottomButtons.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            // First compare bottom position, then right position
            if (Math.abs(rectB.bottom - rectA.bottom) < 20) {
              return rectB.right - rectA.right;
            }
            return rectB.bottom - rectA.bottom;
          });
          
          // Click the best candidate
          const bestButton = bottomButtons[0];
          console.log(`Found button: ${bestButton.textContent}, position: ${JSON.stringify(bestButton.getBoundingClientRect())}`);
          bestButton.click();
          return true;
        }
        
        // If we can't find a suitable button, try a more aggressive approach
        // Looking for ANY element with Select text that's clickable
        const allElements = Array.from(document.querySelectorAll('*'));
        const selectElements = allElements.filter(el => 
          el.textContent && 
          el.textContent.includes('Select') && 
          (el.tagName === 'BUTTON' || el.tagName === 'A' || 
           el.role === 'button' || el.className.includes('button'))
        );
        
        if (selectElements.length > 0) {
          console.log(`Found ${selectElements.length} potential select elements`);
          // Try to click each one until we find one that works
          for (const el of selectElements) {
            try {
              el.click();
              return true;
            } catch (e) {
              console.log(`Failed to click element: ${e.message}`);
            }
          }
        }
        
        // Ultimate fallback: Look for the teal-colored element in the screenshot
        // This is more of a visual approach rather than DOM-based
        const tealElements = allElements.filter(el => {
          const style = window.getComputedStyle(el);
          // Look for elements with a teal/aqua background color (#008080 or similar)
          return style.backgroundColor.includes('rgb(0, 128, 128)') || 
                 style.backgroundColor.includes('rgb(0, 139, 139)') ||
                 style.backgroundColor.includes('rgb(32, 178, 170)') ||
                 // Include Opera Cloud's specific teal color if you know it
                 style.backgroundColor === '#00838F';
        });
        
        if (tealElements.length > 0) {
          console.log(`Found ${tealElements.length} teal-colored elements`);
          for (const el of tealElements) {
            try {
              el.click();
              return true;
            } catch (e) {
              console.log(`Failed to click teal element: ${e.message}`);
            }
          }
        }
        
        return false;
      });
      
      if (buttonClicked) {
        console.log('Successfully clicked Select button using JavaScript');
        await page.waitForTimeout(2000);
        return true;
      }
      
      // Fourth try: Try clicking on the specific coordinates where the button is located
      // Based on your screenshot, the Select button appears to be in the bottom right
      console.log('Trying to click at specific coordinates where Select button should be...');
      
      // Get page dimensions
      const dimensions = await page.evaluate(() => {
        return {
          width: window.innerWidth,
          height: window.innerHeight
        };
      });
      
      // Calculate position (bottom right, about 90% across and 90% down)
      const x = Math.floor(dimensions.width * 0.9);
      const y = Math.floor(dimensions.height * 0.9);
      
      console.log(`Clicking at coordinates: x=${x}, y=${y}`);
      await page.mouse.click(x, y);
      
      console.log('Clicked at estimated Select button position');
      await page.waitForTimeout(2000);
      
      // Take a screenshot after the click attempts
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `after_select_attempts_${Date.now()}.png`) 
      });
      
      // Return false if we couldn't find the button with any method
      return false;
    } catch (error) {
      console.log('Error trying to click AirBnB Select button:', error.message);
      
      // Take error screenshot
      await page.screenshot({ 
        path: path.join(__dirname, 'downloads', `select_button_error_${Date.now()}.png`) 
      }).catch(e => console.log('Error taking screenshot:', e.message));
      
      return false;
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