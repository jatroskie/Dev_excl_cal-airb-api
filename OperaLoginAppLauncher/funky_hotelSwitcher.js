const path = require('path');

async function hotelSwitcher(page, hotelCode, downloadsPath) {
  console.log('Navigating to Look To Book Sales Screen...');

  if (!downloadsPath) {
    throw new Error('downloadsPath parameter is required for saving screenshots');
  }

  try {
    // Take a screenshot of the main interface for debugging
    await page.screenshot({ path: path.join(downloadsPath, 'main_interface.png') });

    // Step 1: Click "clickypoop" link
    