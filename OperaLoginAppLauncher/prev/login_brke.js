require('dotenv').config();
const { chromium } = require('playwright');

async function loginToOperaCloud() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    const loginUrl = 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/';
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Changed to domcontentloaded for faster initial load
    console.log('Login page loaded. URL:', page.url());

    console.log('Filling credentials...');
    const usernameInput = await page.getByRole('textbox', { name: 'User Name' });
    await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
    await usernameInput.click();
    await usernameInput.fill(process.env.OPERA_USERNAME || '');
    const passwordInput = await page.getByRole('textbox', { name: 'Password' });
    await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
    await passwordInput.click();
    await passwordInput.fill(process.env.OPERA_PASSWORD || '');
    if (!process.env.OPERA_USERNAME || !process.env.OPERA_PASSWORD) {
      throw new Error('OPERA_USERNAME or OPERA_PASSWORD not set in .env file');
    }
    console.log('Credentials filled.');

    console.log('Clicking Sign In...');
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await signInButton.waitFor({ state: 'visible', timeout: 30000 });
    await signInButton.click();
    console.log('Sign In clicked.');

    // Wait for navigation after sign-in (handle redirects)
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });

    console.log('Waiting for popup and clicking OPERA Cloud link...');
    const page1Promise = page.waitForEvent('popup', { timeout: 90000 }); // Increased timeout
    const operaCloudLink = page.getByRole('link', { name: 'Click to go to OPERA Cloud' });
    await operaCloudLink.waitFor({ state: 'visible', timeout: 30000 });
    await operaCloudLink.click();
    const page1 = await page1Promise;
    console.log('Popup captured. URL:', page1.url());

    console.log('Waiting for popup to load...');
    await page1.waitForLoadState('networkidle', { timeout: 90000 }); // Increased timeout and changed to networkidle
    console.log('Popup loaded. Current URL:', page1.url());

    console.log('Checking all pages for dashboard...');
    await page1.waitForTimeout(5000); // Allow extra time for stabilization
    const pages = context.pages();
    console.log('Open pages:', pages.map(p => p.url()));

    const dashboardUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
    const dashboardPage = pages.find(p => p.url().includes('opera-cloud-index/OperaCloud')) || page1;
    if (!dashboardPage) {
      throw new Error('Dashboard page not found among open pages');
    }

    console.log('Dashboard page found. URL:', dashboardPage.url());
    await dashboardPage.waitForLoadState('networkidle', { timeout: 90000 });
    console.log('Dashboard loaded.');

    console.log('Verifying login...');
    const loginIndicator = dashboardPage.getByTitle('OPERA Cloud');
    await loginIndicator.waitFor({ state: 'visible', timeout: 30000 });
    if (!await loginIndicator.isVisible()) {
      throw new Error('Login failed: Dashboard not detected');
    }

    console.log('Login successful!');
    await dashboardPage.screenshot({ path: 'dashboard.png' });
    return { page: dashboardPage, browser, context };
  } catch (error) {
    console.error('Login error:', error.message);