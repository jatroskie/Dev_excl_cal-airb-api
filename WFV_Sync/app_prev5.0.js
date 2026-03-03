// app.js - Updated calculateDateRange to use the real current date and go back 1 month.
const path = require('path');
const fs = require('fs');
const OperaExtractor = require('./extractor');
const { parseCSVsToJSON } = require('./parser');
const { uploadToFirebase } = require('./uploader');

function calculateDateRange() {
  const today = new Date(); // Use the actual current date
  const start = new Date(today);
  start.setMonth(today.getMonth() - 1); // Set start date to 1 month ago
  const end = new Date(today);
  end.setDate(today.getDate() + 365);
  const format = date => `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  return { startDate: format(start), endDate: format(end) };
}

async function runApp() {
  const args = process.argv.reduce((acc, arg) => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      acc[key] = val || true;
    }
    return acc;
  }, {});

  const { startDate, endDate } = calculateDateRange();
  const useStart = args.startDate || startDate;
  const useEnd = args.endDate || endDate;
  const headless = args.debug ? false : true;
  const debug = !!args.debug;
  const step = args.step || 'full'; // extract, parse-upload, full
  const selectedHotels = args.hotels ? args.hotels.toLowerCase().split(',') : ['wfv', 'law', 'tba']; // Default all
  const switchMode = !!args.switch; // For switch test

  const downloadsDir = path.join(__dirname, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });

  let jsonPath;

  if (step === 'full' || step === 'extract') {
    const extractor = new OperaExtractor(headless, debug, switchMode);
    await extractor.initialize();

    const hotels = [
      { code: 'WFV', name: 'Waterfront Village', roomsFile: 'input/WFV_Rooms.csv' },
      { code: 'LAW', name: 'Lawhill Apartments', roomsFile: 'input/LAW_rooms.csv' },
      { code: 'TBA', name: 'The Barracks', roomsFile: 'input/TBA_rooms.csv' }
    ];

    for (const hotel of hotels) {
      if (selectedHotels.includes(hotel.code.toLowerCase())) {
        await extractor.switchHotel(hotel.name, hotel.code);
        try {
          await extractor.processRooms(hotel.roomsFile, useStart, useEnd, 5, hotel.code);
        } catch (e) {
          console.error(`Error processing ${hotel.code} rooms: ${e.message}`);
        }
      }
    }

    await extractor.cleanup();
  }

  if (step === 'full' || step === 'parse-upload') {
    jsonPath = await parseCSVsToJSON(downloadsDir);
    await uploadToFirebase(jsonPath);
  }

  console.log('Process completed.');
}

runApp().catch(console.error);