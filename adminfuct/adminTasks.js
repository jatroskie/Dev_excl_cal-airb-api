// adminTasks.js

// Import the firebase-admin library
const admin = require('firebase-admin');

// --- Configuration ---
// Path to your downloaded service account key JSON file
const SERVICE_ACCOUNT_PATH = './service-account-key.json'; // Adjust if you named it differently or placed it elsewhere relative to this script
// -------------------

try {
    // Initialize the Firebase Admin SDK
    const serviceAccount = require(SERVICE_ACCOUNT_PATH); // Load the key file

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
        // Optional: Add databaseURL if needed, usually inferred
        // databaseURL: "https://your-project-id.firebaseio.com"
    });

    console.log('Firebase Admin SDK Initialized Successfully.');

    // Get Firestore instance
    const db = admin.firestore();
    // Get Storage instance (if you need to interact with storage directly)
    // const storage = admin.storage();
    // const bucket = storage.bucket("your-bucket-name.appspot.com"); // Get default bucket if needed

    // --- Your Admin Functions Go Here ---

    // Example: Function to list all hotels (similar to an admin/destinations endpoint)
    async function listHotelsAndDestinations() {
        console.log('\n--- Listing Hotels & Destinations ---');
        try {
            const hotelsSnapshot = await db.collection('hotels').get();
            const destinations = new Set();
            console.log(`Found ${hotelsSnapshot.size} hotel documents:`);
            hotelsSnapshot.forEach(doc => {
                const data = doc.data();
                const hotelCode = data.hotelCode || doc.id;
                const destName = data.destinationName || 'N/A';
                console.log(` - ID: ${doc.id}, Code: ${hotelCode}, Destination: ${destName}`);
                if(data.destinationName) destinations.add(data.destinationName);
            });
             console.log('\nUnique Destinations Found:', Array.from(destinations).sort());
        } catch (error) {
            console.error("Error listing hotels:", error);
        }
         console.log('------------------------------------');
    }


    // Example: Placeholder for a function to trigger thumbnail generation for rooms missing it
    // (This would likely CALL your existing cloud function rather than redo the sharp logic here)
    async function triggerMissingThumbnails(destinationFilter = null) {
         console.log(`\n--- Checking for rooms missing thumbnails ${destinationFilter ? `in ${destinationFilter}` : ''} ---`);
         // 1. Query rooms (optionally filtered by destination) where thumbnailImageUrl is null or doesn't exist
         // 2. For each room found, extract roomId and the selected cover image URL
         // 3. Make an HTTP POST request (using axios or fetch) to your deployed
         //    setCoverImageAndGenerateThumbnail Cloud Function URL, passing the roomId and URL.
         // 4. Log success or failure for each room.
         console.log("Placeholder: Logic to find rooms and call the Cloud Function would go here.");
          console.log('------------------------------------');
    }


    // --- Call the desired admin function(s) ---
    async function runAdminTasks() {
        await listHotelsAndDestinations();
        // await triggerMissingThumbnails("City Centre"); // Example call
        console.log("\nAdmin tasks finished.");
    }

    runAdminTasks();


} catch (error) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! Error initializing Admin SDK or running tasks:");
    console.error("!!! Check path to serviceAccountKey.json       ");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error(error)
}
