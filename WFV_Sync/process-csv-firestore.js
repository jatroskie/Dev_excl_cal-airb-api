// process-csv-firestore.js
// Description: This script processes reservation CSVs and merges them into calendar-data.json.
// It uses the Firestore 'rooms' collection as the single source of truth for all room configurations.

// --- Required Modules ---
const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- Firebase Initialization ---
try {
  // IMPORTANT: Update this path to point to your service account key file
  const serviceAccount = require('./new-service-account-key.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error("FATAL: Could not initialize Firebase. Is your service account key path correct?");
  console.error(error.message);
  process.exit(1);
}

const db = getFirestore();
// --- End Firebase Initialization ---


// --- Function Definitions ---

// NEW: Fetches all room configurations from your live Firestore database
async function loadMasterRoomDataFromFirestore() {
  console.log('Fetching master room configurations from Firestore...');
  const roomsCollection = db.collection('rooms');
  const snapshot = await roomsCollection.get();

  if (snapshot.empty) {
    throw new Error('FATAL: Firestore "rooms" collection is empty or could not be read.');
  }

  const roomDataMap = new Map();
  snapshot.forEach(doc => {
    // The key is the document ID (e.g., "WFV-B801", "TBA-0302")
    // The value is the entire data object for that room
    roomDataMap.set(doc.id, doc.data());
  });

  console.log(`Successfully loaded ${roomDataMap.size} room configurations from Firestore.`);
  return roomDataMap;
}

// MODIFIED: Processes CSV data using the live Firestore data for lookups
function processCSVData(data, fileName, roomDataMap) {
  const resources = [];
  const events = [];
  const roomsInThisFile = new Map();

  data.forEach((row, index) => {
    const propertyFromCsv = row.Property;
    const roomNumberFromCsv = row.Room;

    if (!propertyFromCsv || !roomNumberFromCsv) {
      console.warn(`  [SKIP] Row ${index+1} in ${fileName}: Missing 'Property' or 'Room' column.`);
      return;
    }

    // Clean data from CSV (trim whitespace) and create the lookup ID
    const firestoreDocId = `${propertyFromCsv.trim()}-${roomNumberFromCsv.trim()}`;
    const roomData = roomDataMap.get(firestoreDocId);

    // If we can't find a matching room in Firestore, we can't process the reservation
    if (!roomData) {
      console.error(`  [FAIL] Reservation for room "${firestoreDocId}" in ${fileName} could not be linked. No matching room found in Firestore. Skipping.`);
      return;
    }

    // --- Create Resource (if not already added for this file) ---
    if (!roomsInThisFile.has(firestoreDocId)) {
      const resourceObj = {
        id: firestoreDocId,
        title: `${roomData.roomNumber}-${roomData.roomType}`,
        extendedProps: { 
          roomNumber: roomData.roomNumber,
          roomType: roomData.roomType,
          property: roomData.hotelCode, // Use the official hotelCode from Firestore
          url: roomData.url || null,
          iCal: roomData.iCal || null
        }
      };
      roomsInThisFile.set(firestoreDocId, resourceObj);
    }
    
    // --- Create Event ---
    try {
      const startDate = formatDate(row.Arrival);
      const endDate = formatDate(row.Departure);

      if (startDate && endDate) {
        const uniqueEventId = `${row['Confirmation Number']}_${firestoreDocId}_${startDate}_${endDate}`;
        
        const eventObj = {
          id: uniqueEventId,
          resourceId: firestoreDocId,
          title: row.Name || 'Unnamed Reservation',
          start: startDate,
          end: endDate,
          classNames: getReservationClasses(row['Reservation Type'] || ''),
          extendedProps: {
            fileName: fileName,
            confirmationNumber: row['Confirmation Number'],
            roomNumber: roomData.roomNumber,
            roomType: roomData.roomType,
            status: row['Reservation Type'] || 'Unknown',
            nights: row.Nights,
            adults: row.Adults,
            children: row.Children,
            rate: row.Rate,
            source: row.Source,
            travelAgent: row['Travel Agent'] || '',
            property: roomData.hotelCode,
            url: roomData.url || null,
            iCal: roomData.iCal || null,
            lastUpdated: new Date().toISOString()
          }
        };
        events.push(eventObj);
      }
    } catch (error) {
      console.error(`Error processing event row ${index} in ${fileName}:`, error);
    }
  });

  return { resources: Array.from(roomsInThisFile.values()), events };
}

function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Use a regular expression to find a delimiter (dot or slash)
  const parts = dateStr.split(/[./-]/); // Splits on a dot, slash, or hyphen

  if (parts.length === 3) {
    const [day, month, year] = parts;
    // Basic validation to ensure parts are numeric and reasonable
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year.length === 4) {
      // Pad day and month with a leading zero if they are single-digit
      const paddedMonth = month.padStart(2, '0');
      const paddedDay = day.padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
  }

  // If the format is wrong, log it and return null
  console.warn(`[Date Warning] Could not parse date: "${dateStr}". Expected DD.MM.YYYY or DD/MM/YYYY.`);
  return null;
}

function getReservationClasses(status) {
    if (!status) return [];
    const s = status.toLowerCase();
    if (s.includes('cancel')) return ['reservation-cancelled'];
    if (s.includes('non - guarantee')) return ['reservation-nonguarantee'];
    if (s.includes('guaranteed')) return ['reservation-guaranteed'];
    if (s.includes('in house')) return ['reservation-inhouse'];
    return [];
}


// --- Main Execution Logic ---

async function processAndMergeCSVs() {
  try {
    const outputDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary';
    const downloadsDirectory = path.join(outputDirectory, 'downloads');
    const jsonFilePath = path.join(outputDirectory, 'calendar-data.json');
    
    // Step 1: Load the MASTER room data from Firestore
    const roomDataMap = await loadMasterRoomDataFromFirestore();
    
    // Step 2: Process new CSV files from downloads folder
    const csvFiles = (await fs.readdir(downloadsDirectory))
      .filter(file => file.endsWith('.csv')); // Process all CSVs
  
    console.log(`\nFound ${csvFiles.length} CSV files to process...`);
  
    let allNewResources = [];
    let allNewEvents = [];
    
    for (const file of csvFiles) {
      const filePath = path.join(downloadsDirectory, file);
      console.log(`- Processing: ${file}`);
      
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.includes('No reservations found')) {
        console.log(`  [SKIP] ${file} - No reservations found.`);
        continue;
      }
      
      const parseResult = Papa.parse(content, { header: true, skipEmptyLines: true });
      const { resources, events } = processCSVData(parseResult.data, file, roomDataMap);
      
      allNewResources = [...allNewResources, ...resources];
      allNewEvents = [...allNewEvents, ...events];
    }
    
    // Step 3: Create the final JSON object. 
    // We are no longer merging with an old file, we generate fresh every time.
    const resourceMap = new Map();
    allNewResources.forEach(res => resourceMap.set(res.id, res));

    const finalData = {
      resources: Array.from(resourceMap.values()),
      events: allNewEvents
    };
    
    // Step 4: Save the fresh data to the JSON file
    await fs.writeFile(jsonFilePath, JSON.stringify(finalData, null, 2), 'utf-8');
    
    console.log(`
    ---- Processing Summary ----
    CSV files processed: ${csvFiles.length}
    Total unique resources generated: ${finalData.resources.length}
    Total events generated: ${finalData.events.length}
    Calendar data saved to: ${jsonFilePath}
    --------------------------
    `);
    
  } catch (error) {
    console.error('\n--- FATAL ERROR in processAndMergeCSVs ---', error);
  }
}

// Run the main process
processAndMergeCSVs();