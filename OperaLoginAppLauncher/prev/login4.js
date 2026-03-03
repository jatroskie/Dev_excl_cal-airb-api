require('dotenv').config();
const { chromium } = require('playwright');

async function loginToOperaCloud() {
  console.log('Starting login process with improved stability...');
  let browser, context, page;
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 200, // Add a small delay between actions
      args: ['--disable-dev-shm-usage'] // Add this to reduce crashes in containerized environments
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptDownloads: true,
    });
    
    page = await context.newPage();
    console.log('Browser and page initialized successfully');

    // Step 1: Navigate to login page with improved timeout and error handling
    console.log('Navigating to login page...');
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    
    // Add retry logic for initial navigation
    let navigationAttempts = 0;
    const maxNavigationAttempts = 3;
    let navigationSuccessful = false;
    
    while (!navigationSuccessful && navigationAttempts < maxNavigationAttempts) {
      try {
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        navigationSuccessful = true;
        console.log('Login page loaded successfully. URL:', page.url());
      } catch (navError) {
        navigationAttempts++;
        console.log(`Navigation attempt ${navigationAttempts} failed: ${navError.message}`);
        if (navigationAttempts >= maxNavigationAttempts) throw navError;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Check for credentials
    if (!process.env.OPERA_USERNAME || !process.env.OPERA_PASSWORD) {
      throw new Error('OPERA_USERNAME or OPERA_PASSWORD not set in .env file');
    }

    // Step 2: Fill in credentials with improved error handling
    console.log('Filling credentials...');
    
    // Wait for the page to stabilize before interacting with form elements
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => 
      console.log('Network didn\'t reach idle state, continuing anyway:', e.message));
    
    const usernameInputSelectors = [
      'input[name="username"]',
      'input[placeholder="User Name"]',
      'input#username',
      'input[aria-label="User Name"]'
    ];
    
    let usernameInput = null;
    for (const selector of usernameInputSelectors) {
      const input = page.locator(selector);
      if (await input.count() > 0) {
        usernameInput = input;
        break;
      }
    }
    
    if (!usernameInput) {
      // Fallback to role-based selector
      usernameInput = page.getByRole('textbox', { name: 'User Name' });
    }
    
    await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
    await usernameInput.click();
    await usernameInput.fill(process.env.OPERA_USERNAME);
    
    const passwordInputSelectors = [
      'input[name="password"]',
      'input[placeholder="Password"]',
      'input#password',
      'input[type="password"]',
      'input[aria-label="Password"]'
    ];
    
    let passwordInput = null;
    for (const selector of passwordInputSelectors) {
      const input = page.locator(selector);
      if (await input.count() > 0) {
        passwordInput = input;
        break;
      }
    }
    
    if (!passwordInput) {
      // Fallback to role-based selector
      passwordInput = page.getByRole('textbox', { name: 'Password' });
    }
    
    await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
    await passwordInput.click();
    await passwordInput.fill(process.env.OPERA_PASSWORD);
    console.log('Credentials filled successfully');

    // Step 3: Click Sign In with more robust selector strategies
    console.log('Clicking Sign In...');
    const signInSelectors = [
      'button:has-text("Sign In")',
      'input[type="submit"][value="Sign In"]',
      'a:has-text("Sign In")',
      '[role="button"]:has-text("Sign In")'
    ];
    
    let signInButton = null;
    for (const selector of signInSelectors) {
      const button = page.locator(selector);
      if (await button.count() > 0 && await button.isVisible()) {
        signInButton = button;
        break;
      }
    }
    
    if (!signInButton) {
      // Fallback to role-based selector
      signInButton = page.getByRole('button', { name: 'Sign In' });
    }
    
    await signInButton.waitFor({ state: 'visible', timeout: 30000 });
    await signInButton.click();
    console.log('Sign In clicked successfully');
    
    // Step 4: Wait for the redirect page with improved error handling
    console.log('Waiting for redirect page to load...');
    try {
      // Wait for URL to match the expected pattern with a longer timeout
      await page.waitForURL(/mtce4\.oracleindustry\.com\/OPERA9\/opera\/operacloud/, { timeout: 90000 });
      console.log('Redirect page loaded. URL:', page.url());
    } catch (urlError) {
      console.log(`URL waiting failed: ${urlError.message}`);
      // Continue anyway and check the current URL
      const currentUrl = page.url();
      console.log(`Current URL after sign-in: ${currentUrl}`);
      
      if (!currentUrl.includes('mtce4.oracleindustry.com/OPERA9/opera/operacloud')) {
        throw new Error(`Unexpected URL after sign-in: ${currentUrl}`);
      }
    }
    
    // Take a screenshot to verify the page state
    await page.screenshot({ path: 'redirect_page.png' }).catch(e => 
      console.log('Could not take screenshot:', e.message));
    
    // Step 5: Find and click the "Click to go to OPERA Cloud" button with improved detection
    console.log('Looking for the "Click to go to OPERA Cloud" button...');
    
    // Wait for page to stabilize
    await page.waitForTimeout(5000).catch(e => 
      console.log('Timeout waiting failed, continuing anyway:', e.message));
    
    // First, check if we're already logged in and redirected to the main page
    const currentUrl = page.url();
    if (currentUrl.includes('opera-cloud-index')) {
      console.log('Already on the main dashboard, no need to click OPERA Cloud button');
      return { page, browser, context };
    }
    
    // Otherwise, look for the button using multiple strategies
    console.log('Searching for OPERA Cloud button with multiple strategies...');
    const buttonFinders = [
      // Strategy 1: Try direct text content search
      async () => {
        const button = page.locator('button, a.button, .btn, a', { hasText: 'Click to go to OPERA Cloud' });
        if (await button.count() > 0 && await button.isVisible()) {
          console.log('Found button with text content strategy');
          return button;
        }
        return null;
      },
      
      // Strategy 2: Try various CSS selectors
      async () => {
        const selectors = [
          'a:has-text("Click to go to OPERA Cloud")',
          'button:has-text("Click to go to OPERA Cloud")',
          '.button:has-text("Click to go to OPERA Cloud")',
          'a.button:has-text("Click to go to OPERA Cloud")',
          '[role="button"]:has-text("Click to go to OPERA Cloud")'
        ];
        
        for (const selector of selectors) {
          const button = page.locator(selector);
          if (await button.count() > 0 && await button.isVisible()) {
            console.log(`Found button with selector: ${selector}`);
            return button;
          }
        }
        return null;
      },
      
      // Strategy 3: Look for any element containing OPERA Cloud text
      async () => {
        const button = page.locator('button, a, .button, [role="button"]', { hasText: /OPERA Cloud/i }).first();
        if (await button.count() > 0 && await button.isVisible()) {
          console.log('Found generic button with OPERA Cloud text');
          return button;
        }
        return null;
      },
      
      // Strategy 4: JavaScript in-page search as last resort
      async () => {
        try {
          const found = await page.evaluate(() => {
            // Look for elements containing the text
            const elements = Array.from(document.querySelectorAll('*')).filter(
              el => el.textContent.includes('Click to go to OPERA Cloud')
            );
            
            if (elements.length > 0) {
              console.log(`Found ${elements.length} elements with the target text`);
              elements[0].click();
              return true;
            }
            
            // Try more generic approach
            const operaElements = Array.from(document.querySelectorAll('button, a, .button, [role="button"]')).filter(
              el => el.textContent.includes('OPERA Cloud')
            );
            
            if (operaElements.length > 0) {
              console.log(`Found ${operaElements.length} elements with OPERA Cloud text`);
              operaElements[0].click();
              return true;
            }
            
            return false;
          });
          
          if (found) {
            console.log('Button found and clicked via in-page JavaScript');
            // Return null since we already clicked it
            return { alreadyClicked: true };
          }
          return null;
        } catch (evalError) {
          console.log(`JavaScript evaluation failed: ${evalError.message}`);
          return null;
        }
      }
    ];
    
    // Try each button finding strategy
    let operaCloudButton = null;
    for (const finder of buttonFinders) {
      const result = await finder();
      if (result) {
        if (result.alreadyClicked) {
          operaCloudButton = { alreadyClicked: true };
          break;
        }
        operaCloudButton = result;
        break;
      }
    }
    
    // If button found and not already clicked, click it
    if (operaCloudButton && !operaCloudButton.alreadyClicked) {
      console.log('Clicking the OPERA Cloud button...');
      
      try {
        await operaCloudButton.scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'before_button_click.png' }).catch(e => 
          console.log('Could not take pre-click screenshot:', e.message));
        
        // Get button properties for logging
        const buttonText = await operaCloudButton.textContent().catch(() => 'Unknown');
        const buttonVisible = await operaCloudButton.isVisible().catch(() => false);
        console.log(`Button text: "${buttonText}", Visible: ${buttonVisible}`);
        
        // Click with force option and longer timeout
        await operaCloudButton.click({ force: true, timeout: 60000 });
        console.log('Button clicked successfully!');
      } catch (clickError) {
        console.log(`Button click failed: ${clickError.message}`);
        
        // Try JavaScript click as fallback
        try {
          const clicked = await page.evaluate((buttonText) => {
            const elements = Array.from(document.querySelectorAll('*')).filter(
              el => el.textContent.includes(buttonText)
            );
            if (elements.length > 0) {
              elements[0].click();
              return true;
            }
            return false;
          }, 'Click to go to OPERA Cloud');
          
          if (clicked) {
            console.log('Button clicked via JavaScript fallback');
          } else {
            console.log('Button not found via JavaScript fallback');
          }
        } catch (jsError) {
          console.log(`JavaScript click fallback failed: ${jsError.message}`);
        }
      }
    } else if (!operaCloudButton) {
      console.log('Button not found through any method. Taking screenshot for debugging...');
      await page.screenshot({ path: 'button_not_found.png' }).catch(e => 
        console.log('Could not take screenshot:', e.message));
      
      // Try direct navigation as fallback
      const targetUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/';
      console.log(`Falling back to direct navigation to: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    
    // Step 6: Wait for navigation with improved error handling
    console.log('Waiting for navigation after OPERA Cloud button...');
    
    // Set up event listeners for potential new pages
    const pagePromise = context.waitForEvent('page', { timeout: 30000 }).catch(err => {
      console.log('No new page opened within timeout period');
      return null;
    });
    
    // Wait for navigation or timeout
    try {
      await page.waitForNavigation({ timeout: 60000 });
      console.log('Navigation completed on current page');
    } catch (navError) {
      console.log(`Navigation event not detected: ${navError.message}`);
    }
    
    // Check for any new pages
    console.log('Checking for new pages...');
    const newPage = await pagePromise;
    let dashboardPage = page;
    
    if (newPage) {
      console.log('New page opened:', newPage.url());
      dashboardPage = newPage;
      
      // Add delay for stabilization
      console.log('Adding a 5-second delay for stabilization...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('No new page opened, continuing with current page');
    }
    
    // Wait for the dashboard page to be stable
    try {
      await dashboardPage.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await dashboardPage.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => 
        console.log('Network didn\'t reach idle state on dashboard, continuing anyway:', e.message));
    } catch (loadError) {
      console.log(`Load state waiting failed: ${loadError.message}`);
    }
    
    // Check if we reached the dashboard page
    const finalUrl = dashboardPage.url();
    console.log('Final page URL:', finalUrl);
    
    // Verify the final page is indeed the dashboard
    const isOnDashboard = finalUrl.includes('opera-cloud-index');
    if (!isOnDashboard) {
      console.log('Not yet on dashboard, waiting for additional redirects...');
      try {
        await dashboardPage.waitForURL(/opera-cloud-index/, { timeout: 60000 });
        console.log('Successfully reached the dashboard page');
      } catch (urlError) {
        console.log(`Failed to reach dashboard URL: ${urlError.message}`);
        // Continue anyway, the next wait should catch any issues
      }
    }
    
    // Final stabilization wait
    console.log('Adding a 10-second delay before completing login process...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Take a final screenshot
    await dashboardPage.screenshot({ path: 'final_page.png' }).catch(e => 
      console.log('Could not take final screenshot:', e.message));
    
    console.log('Login process completed successfully!');
    return { page: dashboardPage, browser, context };
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Capture screenshots of all open pages for debugging
    try {
      if (context) {
        const pages = context.pages();
        for (let i = 0; i < pages.length; i++) {
          if (!pages[i].isClosed()) {
            await pages[i].screenshot({ path: `error_page_${i}.png` }).catch(e => 
              console.log(`Failed to take screenshot for page ${i}:`, e.message));
          }
        }
      }
    } catch (screenshotError) {
      console.error('Error taking screenshots:', screenshotError.message);
    }
    
    // Return the error along with browser objects
    return { error, browser, context, page };
  }
}

async function main() {
  let browser, context;
  try {
    const result = await loginToOperaCloud();
    
    // Check if login returned an error
    if (result.error) {
      console.error('Login failed in main function:', result.error.message);
      browser = result.browser;
      context = result.context;
    } else {
      browser = result.browser;
      context = result.context;
      console.log('LOGIN SUCCESSFUL!');
      console.log('Browser will remain open for 2 minutes for verification. Press Ctrl+C to exit.');
    
      // Keep browser open for verification
      await new Promise(resolve => setTimeout(resolve, 120000));
    }
  } catch (error) {
    console.error('Main execution failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Only run main() if this file is being executed directly
if (require.main === module) {
  console.log("Running login3.js directly");
  main();
} else {
  console.log("login3.js imported as a module by another file");
}

module.exports = { loginToOperaCloud };