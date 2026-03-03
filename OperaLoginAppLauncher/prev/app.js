const { chromium } = require('playwright');
const { loginToOperaCloud } = require('./login');
const OperaCloudExtractor = require('./extractor');
const fs = require('fs').promises;
const path = require('path');

async function launchBrowser() {
  return await chromium.launch({
    headless: false,
    args: ['--disable-dev-shm-usage'],
  });
}

async function runApp() {
  console.log('Loading app.js - Version with room table loop');
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    const flag = key.replace('--', '');
    acc[flag] = value !== undefined ? value === 'true' : true; // Default to true if no value
    return acc;
  }, { extractGuests: false, extractReservations: false, downloadCsv: false });
  console.log('Parsing command-line arguments...');
  console.log('Args parsed:', args);

  let browser, context, page;
  try {
    console.log('Starting login process...');
    const { page: loggedInPage, browser: browserInstance, context: browserContext } = await loginToOperaCloud();
    browser = browserInstance;
    context = browserContext;
    page = loggedInPage;
    console.log('Login process completed.');

    const extractor = new OperaCloudExtractor(page, context, browser, launchBrowser);

    if (args.downloadCsv || args.csv) { // Check both downloadCsv and csv flags
      const roomTypes = {
        'STU-BALC': ['0302', '0303', '0400', '0401', '0402', '0501', '0502', '0503', '0514'],
        'STU-URB': ['0304', '0305', '0306', '0307', '0308', '0309', '0311', '0312', '0313', '0314', '0318', '0319', '0320', '0321', '0323', '0403', '0404', '0405', '0406', '0407', '0408', '0409', '0411', '0412', '0416', '0417', '0418', '0419', '0420'],
        '1-BR': ['0315', '0317', '0413', '0415'],
        'STU-LUX': ['0504', '0506', '0507', '0508', '0509', '0511', '0516', '0517', '0518', '0519', '0520'],
        '2-BR': ['0513', '0515']
      };

      const downloadDir = path.join(__dirname, 'downloads');
      await fs.mkdir(downloadDir, { recursive: true });

      for (const [type, rooms] of Object.entries(roomTypes)) {
        for (const room of rooms) {
          console.log(`Processing room ${room} (Type: ${type})...`);
          try {
            const downloadPath = await extractor.downloadReservationCSV(room, '01.01.2025', '31.07.2025');
            console.log(`Successfully downloaded ${downloadPath}`);
          } catch (error) {
            console.error(`Failed to download CSV for room ${room}: ${error.message}`);
          }
        }
      }
      console.log('All room CSVs downloaded.');
    } else {
      console.log('No CSV download requested. Use --csv or --downloadCsv to enable.');
    }
  } catch (error) {
    console.error('App execution failed:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close(); // No isClosed check, just close if exists
    if (browser && !browser.isConnected()) await browser.close();
    console.log('App execution completed.');
  }
}

runApp().catch(console.error);