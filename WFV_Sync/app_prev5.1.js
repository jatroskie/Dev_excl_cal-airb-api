// app.js - Added --[HOTELCODE][ROOM] parameter to resume from a specific point.
const path = require('path');
const fs = require('fs');
const { OperaExtractor, SessionExpiredError } = require('./extractor');
const { parseCSVsToJSON } = require('./parser');
const { uploadToFirebase } = require('./uploader');

function calculateDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(today.getMonth() - 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 365);
  const format = date => `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  return { startDate: format(start), endDate: format(end) };
}

async function runApp() {
  let resumePoint = null;
  const args = process.argv.reduce((acc, arg) => {
    // Special check for the resume flag, e.g., --TBA0501
    const resumeMatch = arg.match(/^--([A-Z]{3})(.+)/i);
    if (resumeMatch) {
      resumePoint = {
        hotel: resumeMatch[1].toLowerCase(),
        room: resumeMatch[2]
      };
      // We don't add it to the 'acc' object as it's handled separately
    } else if (arg.startsWith('--')) {
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
  const step = args.step || 'full';
  const selectedHotels = args.hotels ? args.hotels.toLowerCase().split(',') : ['wfv', 'law', 'tba'];
  const switchMode = !!args.switch;

  const downloadsDir = path.join(__dirname, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });

  if (step === 'full' || step === 'extract') {
    let extractor = new OperaExtractor(headless, debug, switchMode);
    await extractor.initialize();

    const allHotels = [
      { code: 'WFV', name: 'Waterfront Village', roomsFile: 'input/WFV_Rooms.csv' },
      { code: 'LAW', name: 'Lawhill Apartments', roomsFile: 'input/LAW_rooms.csv' },
      { code: 'TBA', name: 'The Barracks', roomsFile: 'input/TBA_rooms.csv' }
    ];

    const hotelsToProcess = allHotels.filter(h => selectedHotels.includes(h.code.toLowerCase()));
    
    // This flag tracks if we have passed the resume point yet.
    // If no resume point is set, it starts as true.
    let resumePointReached = !resumePoint;

    for (const hotel of hotelsToProcess) {
      // --- Hotel-level resume logic ---
      if (!resumePointReached && hotel.code.toLowerCase() !== resumePoint.hotel) {
        console.log(`Skipping hotel ${hotel.code} to resume later...`);
        continue; // Skip this whole hotel
      }

      console.log(`\n--- Starting processing for ${hotel.name} ---`);
      let rooms = fs.readFileSync(hotel.roomsFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
      if (debug || switchMode) {
        rooms = rooms.slice(0, 1);
      }
      
      let i = 0; // The room index
      
      // --- Room-level resume logic ---
      if (!resumePointReached) {
          const startIndex = rooms.findIndex(r => r === resumePoint.room);
          if (startIndex !== -1) {
              console.log(`Resuming from room '${resumePoint.room}'. Skipping ${startIndex} rooms.`);
              i = startIndex;
          } else {
              console.warn(`Resume room '${resumePoint.room}' not found in ${hotel.code}. Starting this hotel from the beginning.`);
          }
          // We have now handled the resume point, so all subsequent processing should be normal.
          resumePointReached = true;
      }

      await extractor.switchHotel(hotel.name, hotel.code);

      let reloginAttempts = 0;
      let roomAttempts = 0;
      let consecutiveFailures = 0;
      const failedRooms = [];

      const MAX_ROOM_ATTEMPTS = 3;
      const MAX_CONSECUTIVE_FAILS = 2;
      const MAX_RELOGINS = 3;

      while (i < rooms.length) {
        const room = rooms[i];
        
        try {
          console.log(`Processing room ${i + 1}/${rooms.length}: ${room} for ${hotel.code}`);
          const downloadedPath = await extractor.downloadReservationCSV(room, useStart, useEnd, hotel.code);
          console.log(`Successfully downloaded: ${path.basename(downloadedPath)}`);

          i++; 
          roomAttempts = 0;
          consecutiveFailures = 0;
          reloginAttempts = 0;

        } catch (error) {
          if (error instanceof SessionExpiredError && reloginAttempts < MAX_RELOGINS) {
            reloginAttempts++;
            console.error(`SESSION DIED: ${error.message}. Attempting re-login ${reloginAttempts}/${MAX_RELOGINS}.`);
            await extractor.cleanup();
            extractor = new OperaExtractor(headless, debug, switchMode);
            await extractor.initialize();
            console.log('Re-login successful. Resuming with the correct hotel...');
            await extractor.switchHotel(hotel.name, hotel.code);
            continue;
          }

          roomAttempts++;
          console.error(`Attempt ${roomAttempts}/${MAX_ROOM_ATTEMPTS} for room ${room} failed: ${error.message}`);

          if (roomAttempts >= MAX_ROOM_ATTEMPTS) {
            console.error(`Skipping room ${room} after reaching max attempts.`);
            failedRooms.push(room);
            consecutiveFailures++;
            
            i++;
            roomAttempts = 0;

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILS) {
              console.error(`\n!!! ABORTING HOTEL: Encountered ${consecutiveFailures} consecutive failed rooms. There might be a systemic issue with ${hotel.name}.\n`);
              break;
            }
          } else {
             await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      if (failedRooms.length > 0) {
        console.warn(`\nCompleted processing for ${hotel.code}.`);
        console.warn(`Skipped rooms due to unrecoverable errors: ${failedRooms.join(', ')}`);
      }
    }
    await extractor.cleanup();
  }

  if (step === 'full' || step === 'parse-upload') {
    console.log('\n--- Starting Parse and Upload step ---');
    // Assume downloadsDir exists if we get here
    jsonPath = await parseCSVsToJSON(downloadsDir);
    await uploadToFirebase(jsonPath);
  }

  console.log('Process completed.');
}

runApp().catch(console.error);