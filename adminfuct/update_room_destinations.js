// update_room_destinations.js
const admin = require('firebase-admin');

// --- Configuration ---
// !!! IMPORTANT: Replace with the actual path to your service account key file !!!
const SERVICE_ACCOUNT_PATH = '../service-account-key.json';
const BATCH_SIZE = 200; // Number of writes per Firestore batch (max 500)
const DRY_RUN = false; // Set to true to log planned updates without writing to Firestore
// -------------------

console.log(`Initializing Firebase Admin SDK...`);
try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK Initialized Successfully.");
} catch (error) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! FAILED TO INITIALIZE FIREBASE ADMIN SDK              !!!");
    console.error("!!! Please ensure 'serviceAccountKey.json' exists        !!!");
    console.error("!!! and contains the correct service account credentials.!!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("Error details:", error);
    process.exit(1); // Exit if SDK can't initialize
}

const db = admin.firestore();

async function updateRoomDestinations() {
    console.log("\n--- Starting Destination Update Process ---");
    if (DRY_RUN) {
        console.log("!!! --- DRY RUN MODE ENABLED --- !!!");
        console.log("!!! No actual writes will be performed. !!!");
    }

    let totalHotels = 0;
    let totalRoomsProcessed = 0;
    let roomsNeedingUpdate = 0;
    let roomsUpdated = 0;
    let roomsMissingHotelCode = 0;
    let roomsHotelNotFound = 0;

    try {
        // --- 1. Fetch Hotels and create a map ---
        console.log("\nFetching hotels data...");
        const hotelsSnapshot = await db.collection('hotels').get();
        const hotelDestMap = new Map();

        hotelsSnapshot.forEach(doc => {
            totalHotels++;
            const hotelData = doc.data();
            const hotelCode = hotelData.hotelCode || doc.id; // Prefer hotelCode field, fallback to doc ID
            const destName = hotelData.destinationName;

            if (hotelCode && destName) {
                hotelDestMap.set(hotelCode, destName);
            } else {
                console.warn(`- Hotel document ${doc.id} is missing 'hotelCode' field and/or 'destinationName' field. Skipping.`);
            }
        });
        console.log(`-> Fetched ${totalHotels} hotels. Mapped ${hotelDestMap.size} hotel codes to destinations.`);
        if (hotelDestMap.size === 0) {
             console.error("!!! No valid hotel data found with destination names. Cannot proceed.");
             return;
        }

        // --- 2. Process Rooms using stream and batched writes ---
        console.log("\nProcessing rooms collection (this may take time)...");
        const roomsRef = db.collection('rooms');
        let batch = db.batch();
        let writeCounter = 0;

        // Use stream for potentially large collections to avoid memory issues
        const roomsStream = roomsRef.stream();

        await new Promise((resolve, reject) => {
            roomsStream.on('data', (doc) => {
                totalRoomsProcessed++;
                const roomId = doc.id;
                const roomData = doc.data();
                const roomHotelCode = roomData.hotelCode; // Assumes rooms HAVE a hotelCode field

                if (!roomHotelCode) {
                    console.warn(`- Room ${roomId}: Missing 'hotelCode'. Cannot determine destination.`);
                    roomsMissingHotelCode++;
                    return; // Skip this room
                }

                const destination = hotelDestMap.get(roomHotelCode);

                if (!destination) {
                    console.warn(`- Room ${roomId}: Hotel code '${roomHotelCode}' not found in hotel map. Cannot set destination.`);
                    roomsHotelNotFound++;
                    return; // Skip this room
                }

                // Check if update is needed (field doesn't exist or value is different)
                if (!roomData.destinationName || roomData.destinationName !== destination) {
                    roomsNeedingUpdate++;
                    console.log(`  - Planning update for Room ${roomId} (Hotel: ${roomHotelCode}): Set destinationName = "${destination}"`);

                    const roomDocRef = roomsRef.doc(roomId);
                    batch.update(roomDocRef, { destinationName: destination });
                    writeCounter++;

                    if (writeCounter >= BATCH_SIZE) {
                        console.log(`  -> Committing batch of ${writeCounter} updates...`);
                        if (!DRY_RUN) {
                            batch.commit().then(() => {
                                roomsUpdated += writeCounter;
                                console.log(`  -> Batch committed successfully.`);
                            }).catch(err => {
                                console.error(`  !!! Error committing batch:`, err);
                                // Consider how to handle batch errors - maybe stop or retry?
                                reject(err); // Stop processing on batch error for safety
                            });
                        } else {
                            console.log(`  -> (DRY RUN) Would commit ${writeCounter} updates.`);
                            roomsUpdated += writeCounter; // Simulate update count for summary
                        }
                        // Start a new batch
                        batch = db.batch();
                        writeCounter = 0;
                    }
                } else {
                   // console.log(`  - Room ${roomId}: Destination already up-to-date ("${roomData.destinationName}"). Skipping.`);
                }

                 // Log progress periodically
                 if (totalRoomsProcessed % 500 === 0) {
                    console.log(`  ... Processed ${totalRoomsProcessed} rooms...`);
                 }

            });

            roomsStream.on('end', async () => {
                console.log(`\nFinished reading rooms stream.`);
                // Commit any remaining writes in the last batch
                if (writeCounter > 0) {
                    console.log(`  -> Committing final batch of ${writeCounter} updates...`);
                     if (!DRY_RUN) {
                        try {
                            await batch.commit();
                            roomsUpdated += writeCounter;
                            console.log(`  -> Final batch committed successfully.`);
                        } catch(err) {
                             console.error(`  !!! Error committing final batch:`, err);
                             reject(err); // Propagate error
                             return;
                        }
                     } else {
                         console.log(`  -> (DRY RUN) Would commit final ${writeCounter} updates.`);
                         roomsUpdated += writeCounter; // Simulate update count
                     }
                }
                resolve(); // Signal completion
            });

            roomsStream.on('error', (error) => {
                console.error(`!!! Error reading rooms stream:`, error);
                reject(error); // Signal error
            });
        });

        // --- 3. Log Summary ---
        console.log("\n--- Update Process Summary ---");
        console.log(`- Total Hotels Checked: ${totalHotels}`);
        console.log(`- Mapped Hotel Codes: ${hotelDestMap.size}`);
        console.log(`- Total Rooms Processed: ${totalRoomsProcessed}`);
        console.log(`- Rooms Missing Hotel Code: ${roomsMissingHotelCode}`);
        console.log(`- Rooms Where Hotel Code Not Found: ${roomsHotelNotFound}`);
        console.log(`- Rooms Needing Update: ${roomsNeedingUpdate}`);
        console.log(`- Rooms Updated ${DRY_RUN ? '(Simulated)' : ''}: ${roomsUpdated}`);
        console.log("------------------------------");
        if (DRY_RUN) {
            console.log("!!! This was a DRY RUN. No data was actually changed. !!!");
            console.log("!!! Set DRY_RUN = false at the top of the script to perform writes. !!!");
        } else {
            console.log("Update complete.");
        }


    } catch (error) {
        console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! AN ERROR OCCURRED DURING UPDATE: !!!", error);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    }
}

// --- IMPORTANT: Backup Firestore before running for real! ---
console.warn("\n*** WARNING: This script will modify data in your Firestore 'rooms' collection. ***");
console.warn("*** It is STRONGLY recommended to BACKUP your Firestore data before running this script without DRY_RUN enabled. ***\n");

// --- Execute the function ---
updateRoomDestinations().then(() => {
    console.log("\nScript finished.");
    // Optionally process.exit() if needed, but often not required for simple scripts
}).catch(err => {
    console.error("\nScript finished with errors.", err);
});