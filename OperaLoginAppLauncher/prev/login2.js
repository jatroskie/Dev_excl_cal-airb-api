require('dotenv').config();
const { chromium } = require('playwright');

async function loginToOperaCloud() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200 // Add a small delay between actions
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });
  
  const page = await context.newPage();
  console.log('Starting login process...');

  try {
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
    // The button appears to be on the same page after a redirect, not on a new page
    await page.waitForURL(/mtce4\.oracleindustry\.com\/OPERA9\/opera\/operacloud/, { timeout: 60000 });
    console.log('Redirect page loaded. URL:', page.url());
    
    // Take a screenshot to verify the page state
    await page.screenshot({ path: 'redirect_page.png' });
    
    // Step 5: Wait for the "Click to go to OPERA Cloud" button and click it
    console.log('Looking for the "Click to go to OPERA Cloud" button...');
    
    // Wait a moment for the page to fully render
    await page.waitForTimeout(3000);
    
    // Finding the button with exact text "Click to go to OPERA Cloud"
    console.log('Targeting button with exact text...');
    const operaCloudButton = page.locator('button, a.button, .btn, a', { 
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
      require('fs').writeFileSync('page_content.html', htmlContent);
      
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
      await page.screenshot({ path: 'before_button_click.png' });
      
      // For debugging, get button properties
      const buttonText = await operaCloudButton.textContent();
      const buttonVisible = await operaCloudButton.isVisible();
      console.log(`Button text: "${buttonText}", Visible: ${buttonVisible}`);
      
      // Click with force option and longer timeout
      await operaCloudButton.click({ force: true, timeout: 30000 });
      console.log('Button clicked!');
    } else if (!buttonFound) {
      console.log('Button not found through any method. Taking screenshot for debugging...');
      await page.screenshot({ path: 'button_not_found.png' });
      
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
    
    // Wait for any new page that might open
    let dashboardPage = page;
    try {
      console.log('Checking for any new pages...');
      const newPagePromise = context.waitForEvent('page', { timeout: 10000 });
      const newPage = await newPagePromise;
      console.log('New page opened:', newPage.url());
      dashboardPage = newPage;
    } catch (pageError) {
      console.log('No new page opened, continuing with current page');
    }
    
    // Wait for the dashboard page to load
    console.log('Waiting for dashboard to load...');
    await dashboardPage.waitForLoadState('networkidle', { timeout: 90000 });
    console.log('Final page URL:', dashboardPage.url());
    
    // Take a final screenshot
    await dashboardPage.screenshot({ path: 'final_page.png' });
    
    console.log('Login process completed!');
    return { page: dashboardPage, browser, context };
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Capture screenshots of all open pages for debugging
    const pages = context.pages();
    for (let i = 0; i < pages.length; i++) {
      if (!pages[i].isClosed()) {
        await pages[i].screenshot({ path: `error_page_${i}.png` });
      }
    }
    
    throw error;
  }
}

async function main() {
  let browser, context;
  try {
    const result = await loginToOperaCloud();
    browser = result.browser;
    context = result.context;
    
    console.log('LOGIN SUCCESSFUL!');
    console.log('Browser will remain open for 2 minutes for verification. Press Ctrl+C to exit.');
    
    // Keep browser open for verification
    await new Promise(resolve => setTimeout(resolve, 120000));
  } catch (error) {
    console.error('Main execution failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { loginToOperaCloud };