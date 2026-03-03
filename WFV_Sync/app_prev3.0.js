// app.js - Updated to process WFV (switch if needed), then switch to LAW, process LAW rooms; parser handles both
const path = require('path');
const fs = require('fs');
const OperaExtractor = require('./extractor');
const { parseCSVsToJSON } = require('./parser');
const { uploadToFirebase } = require('./uploader');

function calculateDateRange() {
  const today = new Date(2025, 6, 11); // July 11, 2025 (0-index month)
  const start = new Date(today);
  start.setDate(today.getDate() - 7);
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

  const extractor = new OperaExtractor(headless, debug);
  await extractor.initialize();

  const downloadsDir = path.join(__dirname, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });

  // Process WFV
  await extractor.switchHotel('Waterfront Village', 'WFV');
  await extractor.processRooms('./input/WFV_Rooms.csv', useStart, useEnd, 5, 'WFV');

  // Switch to LAW and process
  await extractor.switchHotel('Lawhill Apartments', 'LAW');
  await extractor.processRooms('./input/LAW_rooms.csv', useStart, useEnd, 5, 'LAW');

  const jsonPath = await parseCSVsToJSON(downloadsDir);
  await uploadToFirebase(jsonPath);

  await extractor.cleanup();
  console.log('Process completed.');
}

runApp().catch(console.error);