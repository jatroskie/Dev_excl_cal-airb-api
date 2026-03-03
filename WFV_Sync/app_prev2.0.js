const path = require('path');
const fs = require('fs');
const OperaExtractor = require('./extractor');
const { parseCSVsToJSON } = require('./parser');
const { uploadToFirebase } = require('./uploader');

function calculateDateRange() {
  const today = new Date(2025, 6, 10); // July 10, 2025 (0-index month)
  const start = new Date(today);
  start.setDate(today.getDate() - 30);
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

  await extractor.processRooms('./input/WFV_Rooms.csv', useStart, useEnd);

  const jsonPath = await parseCSVsToJSON('./input/WFV_Rooms.csv', downloadsDir);
  await uploadToFirebase(jsonPath);

  await extractor.cleanup();
  console.log('Process completed.');
}

runApp().catch(console.error)