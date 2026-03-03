const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  await browser.close();
})();