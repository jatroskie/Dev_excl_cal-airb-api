// pre-flight-check.js
// Description: Connects to Firestore, scans all reservation CSVs, and reports
// which rooms are missing from the Firestore database.

const fs = require('fs').promises;
const path =require('path');
const Papa = require('papaparse');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- Firebase Initialization ---
try {
  const serviceAccount = require('./new-service-account-key.json'); 
  initializeApp({ credential: cert(serviceAccount) });
} catch (error) {
  console.error("FATAL: Could not initialize Firebase. Is your service account key path correct?");
  process.exit(1);
}
const db = getFirestore();
// --- End Firebase Initialization ---

async function runPreFlightCheck() {
  console.log('--- Starting Pre-Flight System Check ---');

  // 1. Fetch ALL rooms from Firestore and create a set of valid IDs
  console.log('\nStep 1: Fetching all room IDs from Firestore...');
  const roomsSnapshot = await db.collection('rooms').get();
  const firestoreRoomIds = new Set();
  roomsSnapshot.forEach(doc => firestoreRoomIds.add(doc.id));
  console.log(` -> Found ${firestoreRoomIds.size} unique room documents in Firestore.`);
  if (firestoreRoomIds.size === 0) {
      console.error("FATAL: Firestore 'rooms' collection is empty. Cannot perform check.");
      return;
  }

  // 2. Scan all CSV files and find which rooms they require
  console.log('\nStep 2: Scanning all reservation CSVs in the "downloads" folder...');
  const downloadsDirectory = path.join(__dirname, 'downloads');
  const csvFiles = (await fs.readdir(downloadsDirectory)).filter(f => f.toLowerCase().endsWith('.csv'));
  
  const requiredRooms = new Map(); // Key: Room ID, Value: list of files that need it

  for (const file of csvFiles) {
    const filePath = path.join(downloadsDirectory, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });

    for (const row of result.data) {
      if (row.Property && row.Room) {
        const requiredId = `${row.Property.trim()}-${row.Room.trim()}`;
        if (!requiredRooms.has(requiredId)) {
            requiredRooms.set(requiredId, []);
        }
        // Add the current file to the list of files that reference this room
        if (!requiredRooms.get(requiredId).includes(file)) {
            requiredRooms.get(requiredId).push(file);
        }
      }
    }
  }
  console.log(` -> Found ${requiredRooms.size} unique room IDs referenced across ${csvFiles.length} CSV files.`);

  // 3. Compare the required rooms with what exists in Firestore
  console.log('\nStep 3: Comparing required rooms against Firestore data...');
  const missingRooms = [];
  const foundRooms = [];

  for (const requiredId of requiredRooms.keys()) {
    if (firestoreRoomIds.has(requiredId)) {
      foundRooms.push(requiredId);
    } else {
      missingRooms.push({
          id: requiredId,
          referencedIn: requiredRooms.get(requiredId)
      });
    }
  }

  // 4. Report the results
  console.log('\n--- Pre-Flight Check Report ---');
  if (missingRooms.length > 0) {
    console.error(`\n🔴 ACTION REQUIRED: ${missingRooms.length} rooms are MISSING from Firestore!`);
    console.error("   You must add these rooms to your Firestore 'rooms' collection before running the main script.");
    console.log("--------------------------------------------------------------------------");
    missingRooms.forEach(room => {
        console.log(`  - Missing ID: "${room.id}" (Referenced in: ${room.referencedIn.join(', ')})`);
    });
    console.log("--------------------------------------------------------------------------");
  } else {
    console.log('\n✅ SUCCESS: All rooms referenced in your CSV files exist in Firestore!');
  }

  console.log(`\nFound and verified ${foundRooms.length} rooms.`);
  console.log('---------------------------------');
}

runPreFlightCheck();