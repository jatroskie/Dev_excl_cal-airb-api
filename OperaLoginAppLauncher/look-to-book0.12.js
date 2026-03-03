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
            path: path.join(__dirname, 'downloads', `search_popup_${Date.