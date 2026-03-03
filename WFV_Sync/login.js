require('dotenv').config();
const { chromium } = require('playwright');
const readlineSync = require('readline-sync');

async function loginToOperaCloud(headless = true) {
  let username = process.env.OPERA_USERNAME;
  let password = process.env.OPERA_PASSWORD;
  if (!username) username = readlineSync.question('Enter OPERA_USERNAME: ', { hideEchoBack: true });
  if (!password) password = readlineSync.question('Enter OPERA_PASSWORD: ', { hideEchoBack: true });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.goto('https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'User Name' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Handle redirect and "Click to go to OPERA Cloud" button with robust locator
  await page.waitForURL(/operacloud/, { timeout: 60000 });
  const buttonLocator = page.locator('button, a, [role="button"]', { hasText: /Click to go to OPERA Cloud/i });
  if (await buttonLocator.count() > 0) {
    await buttonLocator.first().click({ force: true, timeout: 30000 });
  }

  // Wait for dashboard
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => console.log('Network idle timeout, continuing.'));
  console.log('Login successful. Current URL:', page.url());

  return { browser, context, page };
}

module.exports = { loginToOperaCloud };