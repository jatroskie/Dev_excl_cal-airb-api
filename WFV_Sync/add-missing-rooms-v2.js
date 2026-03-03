// add-missing-rooms-v2.js
// Description: Reads a CSV file of missing rooms, cleans up extra quotes,
// and adds them to the Firestore 'rooms' collection.

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- Firebase Initialization ---
try {
  // IMPORTANT: Update this path if your key file is named differently or elsewhere
  const serviceAccount = require('./new-service-account-key.json'); 
  initializeApp({ credential: cert(serviceAccount) });
} catch (error) {
  console.error("FATAL: Could not initialize Firebase. Is your service account key path correct?");
  process.exit(1);
}
const db = getFirestore();
// --- End Firebase Initialization ---


// --- NEW HELPER FUNCTION ---
// This function cleans up the extra quotes from the CSV data.
function sanitizeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  // Trim whitespace from the start and end
  let cleaned = value.trim();

  // Repeatedly remove leading and trailing quotes
  // This handles cases like `"""value"""` or `"value"`
  while (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned;
}
// --- END HELPER FUNCTION ---


async function addRoomsFromCsv() {
  console.log('--- Starting Room Uploader Script (v2 with Sanitizer) ---');

  // 1. Read and parse the CSV file
  const csvFilePath = path.join(__dirname, 'missingRooms.csv');
  let roomsToAdd = [];
  try {
    const csvFileContent = fs.readFileSync(csvFilePath, 'utf8');
    const parsed = Papa.parse(csvFileContent, { header: true, skipEmptyLines: true });
    roomsToAdd = parsed.data;
  } catch (error) {
    console.error(`FATAL: Could not read or parse ${csvFilePath}.`, error);
    return;
  }
  
  const roomsRef = db.collection('rooms');
  const batch = db.batch();
  let roomsProcessed = 0;

  console.log(`Found ${roomsToAdd.length} rows in the CSV. Planning additions...`);

  // 2. Iterate over each row and prepare the batch write
  for (const room of roomsToAdd) {
    // Sanitize the documentId first to perform checks
    const docId = sanitizeValue(room.documentId);

    // --- SAFETY CHECKS ---
    if (!docId) {
      console.warn(`[SKIP] Skipping a row because its 'documentId' is empty.`);
      continue;
    }
    if (docId.toLowerCase() === 'sample') {
      console.log(`[INFO] Ignoring the "Sample" row as per instructions.`);
      continue;
    }
    // --- END SAFETY CHECKS ---

    const newDocRef = roomsRef.doc(docId);
    
    // Convert CSV data, SANITIZING each value before use
    const roomData = {
      actType: sanitizeValue(room.actType) || null,
      address: sanitizeValue(room.address) || null,
      bathrooms: sanitizeValue(room.bathrooms) ? parseInt(sanitizeValue(room.bathrooms), 10) : null,
      bedrooms: sanitizeValue(room.bedrooms) ? parseInt(sanitizeValue(room.bedrooms), 10) : null,
      description50: sanitizeValue(room.description50) || null,
      description500: sanitizeValue(room.description500) || null,
      destinationName: sanitizeValue(room.destinationName) || null,
      gpsCoordinates: sanitizeValue(room.gpsCoordinates) || null,
      hotelCode: sanitizeValue(room.hotelCode) || null,
      hotelRef: sanitizeValue(room.hotelRef) || null,
      propRate: sanitizeValue(room.propRate) || null,
      roomId: sanitizeValue(room.roomId) || docId,
      roomNumber: sanitizeValue(room.roomNumber) || null,
      roomType: sanitizeValue(room.roomType) || null,
      title: sanitizeValue(room.title) || null,
      url: sanitizeValue(room.url) || null,
      iCal: sanitizeValue(room.iCal) || null,
      lastUpdated: new Date()
    };

    // Clean up any NaN values from failed parseInt calls
    if (isNaN(roomData.bathrooms)) roomData.bathrooms = null;
    if (isNaN(roomData.bedrooms)) roomData.bedrooms = null;

    console.log(`  [PLAN] Adding document with clean ID: "${docId}"`);
    batch.set(newDocRef, roomData);
    roomsProcessed++;
  }

  if (roomsProcessed === 0) {
    console.log("No valid rooms were found to add. Exiting.");
    return;
  }

  // 3. Commit the batch write to Firestore
  try {
    console.log(`\nCommitting batch to add ${roomsProcessed} clean rooms to Firestore...`);
    await batch.commit();
    console.log('✅ SUCCESS: All missing rooms have been added to the database with clean data!');
  } catch (error) {
    console.error('❌ ERROR: The batch write failed. No rooms were added.', error);
  }
}

// Run the main function
addRoomsFromCsv();