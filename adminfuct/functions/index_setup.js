// adminfuct/functions/index.js
const admin = require('firebase-admin');
const functions = require('firebase-functions');

// --- Use the Service Account Key from the MAIN project ---
try {
    // Adjust path if key file is not in the 'functions' directory itself
    const serviceAccount = require('../service-account-key.json'); // Assumes key is in 'adminfuct/'

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
        // NO databaseURL or other config needed here normally,
        // as the key itself points to the correct project (cal-airb-api)
        // for accessing its resources like Firestore.
    });
     console.log("Admin SDK initialized to access PRIMARY project data.");
} catch (e) {
     console.error("FATAL ERROR: Could not initialize Firebase Admin SDK. Check serviceAccountKey path/validity.", e);
     // Prevent functions from deploying if SDK fails
     throw new Error("Admin SDK Initialization Failed.");
}


const db = admin.firestore(); // This 'db' now points to cal-airb-api's Firestore
// const storage = admin.storage(); // This points to cal-airb-api's Storage

// --- Define your Admin Cloud Functions ---

exports.setCoverImageAndGenerateThumbnail = functions.https.onRequest(async (req, res) => {
    // Your function logic using 'db' and 'storage' will
    // automatically interact with the cal-airb-api project's resources.
    // ...
});

// Add other admin functions here...