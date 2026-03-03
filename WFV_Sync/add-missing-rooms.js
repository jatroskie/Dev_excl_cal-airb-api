// add-missing-rooms.js
// Description: Reads a CSV file of missing rooms and adds them to the Firestore 'rooms' collection.

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

async function addRoomsFromCsv() {
  console.log('--- Starting Room Uploader Script ---');

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
    const docId = room.documentId;

    // --- SAFETY CHECKS ---
    if (!docId) {
      console.warn(`[SKIP] Skipping a row because its 'documentId' is empty.`);
      continue;
    }
    // This is the key assumption based on your question.
    if (docId.toLowerCase() === 'sample') {
      console.log(`[INFO] Ignoring the "Sample" row as per instructions.`);
      continue;
    }
    // --- END SAFETY CHECKS ---

    const newDocRef = roomsRef.doc(docId);
    
    // Convert CSV data (all strings) into a structured object with correct data types
    const roomData = {
      actType: room.actType || null,
      address: room.address || null,
      // Convert to number, defaulting to null if empty or not a number
      bathrooms: room.bathrooms ? parseInt(room.bathrooms, 10) : null,
      bedrooms: room.bedrooms ? parseInt(room.bedrooms, 10) : null,
      description50: room.description50 || null,
      description500: room.description500 || null,
      destinationName: room.destinationName || null,
      gpsCoordinates: room.gpsCoordinates || null,
      hotelCode: room.hotelCode || null,
      hotelRef: room.hotelRef || null,
      propRate: room.propRate || null,
      roomId: room.roomId || docId, // Use roomId field or default to the docId
      roomNumber: room.roomNumber || null,
      roomType: room.roomType || null,
      title: room.title || null,
      url: room.url || null,
      // Add other fields with default null values if they might be missing
      iCal: room.iCal || null,
      lastUpdated: new Date() // Add a timestamp for when it was added
    };

    // Clean up any NaN values from failed parseInt calls
    if (isNaN(roomData.bathrooms)) roomData.bathrooms = null;
    if (isNaN(roomData.bedrooms)) roomData.bedrooms = null;

    console.log(`  [PLAN] Adding document with ID: "${docId}"`);
    batch.set(newDocRef, roomData);
    roomsProcessed++;
  }

  if (roomsProcessed === 0) {
    console.log("No valid rooms were found to add. Exiting.");
    return;
  }

  // 3. Commit the batch write to Firestore
  try {
    console.log(`\nCommitting batch to add ${roomsProcessed} rooms to Firestore...`);
    await batch.commit();
    console.log('✅ SUCCESS: All missing rooms have been added to the database!');
  } catch (error) {
    console.error('❌ ERROR: The batch write failed. No rooms were added.', error);
  }
}

// Run the main function
addRoomsFromCsv();