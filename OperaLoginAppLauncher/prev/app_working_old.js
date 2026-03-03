const { loginToOperaCloud } = require('./login');
const OperaCloudExtractor = require('./extractor');

async function runApp(extractGuests = false, extractReservations = false, downloadCsv = false) {
  let browser;
  try {
    console.log('Starting login process...');
    const { page, browser: browserInstance } = await loginToOperaCloud();
    browser = browserInstance;
    console.log('Login completed, page URL:', page.url());

    if (extractGuests || extractReservations || downloadCsv) {
      console.log('Initializing extractor...');
      const extractor = new OperaCloudExtractor(page);
      console.log('Extractor initialized.');

      if (extractGuests) {
        console.log('Calling extractGuestData...');
        const guestData = await extractor.extractGuestData();
        console.log('Guest Data:', guestData);
      }

      if (extractReservations) {
        console.log('Calling extractReservationData...');
        const reservationData = await extractor.extractReservationData();
        console.log('Reservation Data:', reservationData);
      }

      if (downloadCsv) {
        console.log('Calling downloadReservationCSV for room 0308...');
        const csvPath = await extractor.downloadReservationCSV('0308');
        console.log('CSV Path:', csvPath);
      }
    }

    console.log('App execution completed.');
  } catch (error) {
    console.error('App execution failed:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

console.log('Parsing command-line arguments...');
const args = process.argv.slice(2);
const extractGuests = args.includes('--guests');
const extractReservations = args.includes('--reservations');
const downloadCsv = args.includes('--csv');
console.log('Args parsed: extractGuests=', extractGuests, 'extractReservations=', extractReservations, 'downloadCsv=', downloadCsv);

runApp(extractGuests, extractReservations, downloadCsv);