async function loginToOperaCloud(options = { viewport: { width: 1600, height: 1200 }, headless: false }) {
  const browser = await chromium.launch(options);
  const context = await browser.newContext({ viewport: options.viewport });
  const page = await context.newPage();
  await page.goto('https://login.example.com'); // Replace with actual login URL
  await page.fill('#username', 'your-username'); // Replace with actual credentials
  await page.fill('#password', 'your-password');
  await page.click('#login-button');
  await page.waitForNavigation();
  return { browser, context, page };
}