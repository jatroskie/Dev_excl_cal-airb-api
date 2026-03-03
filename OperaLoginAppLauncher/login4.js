// login4.js
// Description: Login script for Opera Cloud using Playwright
// require('dotenv').config();
// now an async function
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Logs into the Opera Cloud system
 * @param {Object} options Configuration options
 * @param {Object} options.viewport Viewport dimensions
 * @param {boolean} options.headless Whether to run in headless mode
 * @returns {Promise<Object>} Browser, context, and page objects
 */
async function loginToOperaCloud(options = {}) {
  const defaultOptions = {
    viewport: { width: 1600, height: 1200 },
    headless: false
  };

  const config = { ...defaultOptions, ...options };
  
  let browser = null;
  let context = null;
  let page = null;

  // Setup downloads path if needed
  const downloadsPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ 
      headless: config.headless,
      args: ['--disable-web-security', '--disable-features=IsolateOrigins'],
      downloadsPath: downloadsPath
    });

    context = await browser.newContext({ 
      viewport: config.viewport,
      acceptDownloads: true
    });

    page = await context.newPage();
    console.log('Starting login process...');

    // Step 1: Navigate to login page
    console.log('Navigating to login page...');
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Login page loaded. URL:', page.url());
    
    // Check for credentials
    if (!process.env.OPERA_USERNAME || !process.env.OPERA_PASSWORD) {
      throw new Error('OPERA_USERNAME or OPERA_PASSWORD not set in .env file');
    }

    // Step 2: Fill in credentials
    console.log('Filling credentials...');
    const usernameInput = await page.getByRole('textbox', { name: 'User Name' });
    await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
    await usernameInput.click();
    await usernameInput.fill(process.env.OPERA_USERNAME);
    
    const passwordInput = await page.getByRole('textbox', { name: 'Password' });
    await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
    await passwordInput.click();
    await passwordInput.fill(process.env.OPERA_PASSWORD);
    console.log('Credentials filled.');

    // Step 3: Click Sign In
    console.log('Clicking Sign In...');
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await signInButton.waitFor({ state: 'visible', timeout: 30000 });
    await signInButton.click();
    console.log('Sign In clicked.');
    
    // Step 4: Wait for the redirect page with the "Click to go to OPERA Cloud" button
    console.log('Waiting for redirect page to load...');
    await page.waitForURL(/mtce4\.oracleindustry\.com\/OPERA9\/opera\/operacloud/, { timeout: 60000 });
    console.log('Redirect page loaded. URL:', page.url());
    
    // Take a screenshot to verify the page state
    await page.screenshot({ path: path.join(downloadsPath, 'redirect_page.png') });
    
    // Step 5: Wait for the "Click to go to OPERA Cloud" button and click it
    console.log('Looking for the "Click to go to OPERA Cloud" button...');
    
    // Wait a moment for the page to fully render
    await page.waitForTimeout(3000);
    
    // Finding the button with exact text "Click to go to OPERA Cloud"
    console.log('Targeting button with exact text...');
    let operaCloudButton = page.locator('button, a.button, .btn, a', { 
      hasText: 'Click to go to OPERA Cloud' 
    });
    
    // Alternative selectors if the above doesn't work
    const alternativeSelectors = [
      'a:has-text("Click to go to OPERA Cloud")',
      'button:has-text("Click to go to OPERA Cloud")',
      '.button:has-text("Click to go to OPERA Cloud")',
      'a.button:has-text("Click to go to OPERA Cloud")',
      'text="Click to go to OPERA Cloud"',
      '[role="button"]:has-text("Click to go to OPERA Cloud")'
    ];
    
    // Try the main selector first
    let buttonFound = await operaCloudButton.count() > 0;
    if (buttonFound) {
      console.log('Button found with primary selector');
    } else {
      // Try alternative selectors
      for (const selector of alternativeSelectors) {
        console.log(`Trying alternative selector: ${selector}`);
        const altButton = page.locator(selector);
        if (await altButton.count() > 0) {
          console.log(`Button found with selector: ${selector}`);
          operaCloudButton = altButton;
          buttonFound = true;
          break;
        }
      }
    }
    
    // If button still not found, try a more generic approach
    if (!buttonFound) {
      console.log('Button not found with specific selectors. Trying generic approach...');
      
      // Dump the HTML content for debugging
      const htmlContent = await page.content();
      fs.writeFileSync(path.join(downloadsPath, 'page_content.html'), htmlContent);
      
      // Look for any button or link that might be related to OPERA Cloud
      const genericButton = page.locator('button, a', { hasText: /OPERA Cloud/i }).first();
      if (await genericButton.count() > 0) {
        console.log('Found generic button with OPERA Cloud text');
        operaCloudButton = genericButton;
        buttonFound = true;
      } else {
        // Last resort: Try to find it using JavaScript in the page context
        console.log('Trying JavaScript approach to find the button...');
        buttonFound = await page.evaluate(() => {
          // Look for elements containing the text
          const elements = Array.from(document.querySelectorAll('*')).filter(
            el => el.textContent.includes('Click to go to OPERA Cloud')
          );
          
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with the target text`);
            // Click the first matching element
            elements[0].click();
            return true;
          }
          
          // Try more generic approach if specific text not found
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
      }
    }
    
    // Click the button if found through standard selectors
    if (buttonFound && operaCloudButton) {
      console.log('Clicking the OPERA Cloud button...');
      await operaCloudButton.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(downloadsPath, 'before_button_click.png') });
      
      // For debugging, get button properties
      const buttonText = await operaCloudButton.textContent();
      const buttonVisible = await operaCloudButton.isVisible();
      console.log(`Button text: "${buttonText}", Visible: ${buttonVisible}`);
      
      // Click with force option and longer timeout
      await operaCloudButton.click({ force: true, timeout: 30000 });
      console.log('Button clicked!');
    } else if (!buttonFound) {
      console.log('Button not found through any method. Taking screenshot for debugging...');
      await page.screenshot({ path: path.join(downloadsPath, 'button_not_found.png') });
      
      // Try direct navigation as fallback
      const targetUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/';
      console.log(`Falling back to direct navigation to: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    
    // Step 6: Wait for navigation after clicking the button
    console.log('Waiting for navigation after clicking the button...');
    
    // Wait for navigation to complete or timeout after 60 seconds
    try {
      await page.waitForNavigation({ timeout: 60000 });
    } catch (navError) {
      console.log(`Navigation timeout or already completed: ${navError.message}`);
    }
    
    // Set up a listener for new pages before we check for them
    const pagePromise = context.waitForEvent('page', { timeout: 10000 }).catch(err => {
      console.log('No new page opened within timeout period');
      return null;
    });
    
    // Wait for any new page that might open
    console.log('Checking for any new pages...');
    const newPage = await pagePromise;
    let dashboardPage = page;
    
    if (newPage) {
      console.log('New page opened:', newPage.url());
      dashboardPage = newPage;
      
      // Add a delay to allow for any additional redirects 
      console.log('Adding a 5-second delay for stabilization...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('No new page opened, continuing with current page');
    }
    
    // Add a delay before saying login is complete
    console.log('Adding a 7-second delay before completing...');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    // Safely try to get the final URL 
    try {
      if (!dashboardPage.isClosed()) {
        console.log('Final page URL:', dashboardPage.url());
        await dashboardPage.screenshot({ path: path.join(downloadsPath, 'final_page.png') }).catch(e => {
          console.log('Could not take final screenshot:', e.message);
        });
      } else {
        console.log('Dashboard page is closed, cannot get URL or take screenshot');
      }
    } catch (err) {
      console.log('Error getting page info:', err.message);
    }
    
    console.log('Login process completed!');
    return { page: dashboardPage, browser, context };
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Capture screenshots of all open pages for debugging
    try {
      const pages = context.pages();
      for (let i = 0; i < pages.length; i++) {
        if (!pages[i].isClosed()) {
          await pages[i].screenshot({ path: path.join(downloadsPath, `error_page_${i}.png`) });
        }
      }
    } catch (screenshotError) {
      console.error('Error taking screenshots:', screenshotError.message);
    }
    
    // Return the error along with browser objects
    return { error, browser, context, page };
  }
}

// For direct execution
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

// Export the function properly
module.exports = loginToOperaCloud;