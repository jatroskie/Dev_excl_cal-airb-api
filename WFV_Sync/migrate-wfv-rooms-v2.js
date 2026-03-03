// migrate-wfv-rooms-v2.js
// Description: This script migrates WFV room documents in Firestore to a new, consistent ID format.
//
// --- HOW TO USE ---
// 1. Dry Run (DEFAULT):
//    - Run: `node migrate-wfv-rooms-v2.js`
//    - This will show you a plan of all changes without modifying the database.
//
// 2. Live Run (EXECUTES CHANGES):
//    - Run: `node migrate-wfv-rooms-v2.js --live`
//    - This will perform the actual migration after a 5-second countdown.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- Configuration ---
// Check for the --live flag in the command-line arguments
const isLiveRun = process.argv.includes('--live');

// --- Firebase Initialization ---
try {
  // UPDATE THIS PATH to your service account key file
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
const roomsRef = db.collection('rooms');

async function migrateWfvRooms() {
  // --- Announce Mode and Safety Checks ---
  if (isLiveRun) {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!!      RUNNING IN LIVE MODE     !!!');
    console.log('!!! THIS WILL MODIFY THE DATABASE !!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('Starting in 5 seconds. Press CTRL+C to cancel.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    console.log('---------------------------------');
    console.log('---   RUNNING IN DRY RUN MODE   ---');
    console.log('--- No changes will be made.  ---');
    console.log('---------------------------------');
  }

  // 1. Get all documents where hotelCode is 'WFV'
  console.log("\n1. Fetching WFV rooms from Firestore...");
  const wfvQuery = roomsRef.where('hotelCode', '==', 'WFV');
  const snapshot = await wfvQuery.get();

  if (snapshot.empty) {
    console.log('No WFV rooms found to migrate. Exiting.');
    return { planned: 0, migrated: 0, deleted: 0 };
  }
  console.log(`Found ${snapshot.size} WFV rooms.`);

  // 2. Plan the migration
  console.log("\n2. Planning the migration changes...");
  const batch = db.batch();
  const migrationPlan = [];

  snapshot.forEach(doc => {
    const oldId = doc.id;
    const roomData = doc.data();
    
    if (!roomData.roomNumber) {
      console.error(`  [SKIP] Document ${oldId} is missing the 'roomNumber' field. Cannot migrate.`);
      return;
    }
    
    // The new, consistent ID format
    const newId = `${roomData.hotelCode}-${roomData.roomNumber}`;

    // Skip if the ID is already correct (prevents re-running errors)
    if (oldId === newId) {
        console.log(`  [SKIP] Document ${oldId} already has the correct ID format.`);
        return;
    }

    // Update the roomId field inside the data to match the new document ID
    const updatedRoomData = { ...roomData, roomId: newId }; 

    // Add the creation of the new document to the batch
    const newDocRef = roomsRef.doc(newId);
    batch.set(newDocRef, updatedRoomData);

    // Store the plan for logging and execution
    migrationPlan.push({ oldId, newId, roomNumber: roomData.roomNumber });
  });

  if (migrationPlan.length === 0) {
      console.log("No rooms require migration. All WFV rooms seem to follow the correct naming convention.");
      return { planned: 0, migrated: 0, deleted: 0 };
  }

  console.log("\n--- Migration Plan ---");
  migrationPlan.forEach(plan => {
      console.log(`  RENAME: "${plan.oldId}"  ===>  "${plan.newId}"`);
  });
  console.log("----------------------");

  let migratedCount = 0;
  let deletedCount = 0;

  // 3. Execute the migration ONLY if in live mode
  if (isLiveRun) {
    // Commit the batch to create all the new documents
    try {
      console.log('\n3. EXECUTING: Creating new documents...');
      await batch.commit();
      migratedCount = migrationPlan.length;
      console.log(`   SUCCESS: Created ${migratedCount} new documents.`);
    } catch (error) {
      console.error('FATAL: Batch commit to create new documents failed. No data was changed.', error);
      console.error("The process will now stop to prevent data loss.");
      return { planned: migrationPlan.length, migrated: 0, deleted: 0 }; // Stop the process
    }

    // If and ONLY IF the creation was successful, delete the old documents
    console.log('\n4. EXECUTING: Deleting old documents...');
    const deleteBatch = db.batch();
    migrationPlan.forEach(plan => {
      const oldDocRef = roomsRef.doc(plan.oldId);
      deleteBatch.delete(oldDocRef);
    });

    try {
      await deleteBatch.commit();
      deletedCount = migrationPlan.length;
      console.log(`   SUCCESS: Deleted ${deletedCount} old documents.`);
    } catch (error) {
      console.error('ERROR: Failed to delete old documents. You may need to do this manually.', error);
      console.error('The new documents have already been created.');
    }
  }

  return { planned: migrationPlan.length, migrated: migratedCount, deleted: deletedCount };
}

// --- Main Execution ---
main().catch(console.error);

async function main() {
    try {
        const result = await migrateWfvRooms();
        console.log('\n--- Final Summary ---');
        if (isLiveRun) {
            console.log(`Migration complete. A total of ${result.planned} rooms were targeted.`);
            console.log(`  - New Documents Created: ${result.migrated}`);
            console.log(`  - Old Documents Deleted: ${result.deleted}`);
        } else {
            console.log(`Dry Run complete. A total of ${result.planned} rooms were planned for migration.`);
            console.log("No changes were made. Run with the --live flag to execute the plan.");
        }
        console.log("---------------------\n");
    } catch (error) {
        console.error('\n--- An Unhandled Error Occurred ---');
        console.error(error);
        console.error('-------------------------------------\n');
    }
}