const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectData() {
    console.log("--- Inspecting HOTELS ---");
    const hotels = await db.collection('hotels').limit(3).get();
    hotels.forEach(doc => {
        console.log(`\nHOTEL ID: ${doc.id}`);
        // Log all top-level keys
        console.log("Fields:", Object.keys(doc.data()));
        // Dump specific fields if they look promising
        const d = doc.data();
        if (d.houseRules) console.log(" - houseRules:", JSON.stringify(d.houseRules).substring(0, 100) + "...");
        if (d.amenities) console.log(" - amenities:", JSON.stringify(d.amenities).substring(0, 100) + "...");
        if (d.directions) console.log(" - directions:", JSON.stringify(d.directions).substring(0, 100) + "...");
        if (d.checkInInstructions) console.log(" - checkInInstructions:", JSON.stringify(d.checkInInstructions).substring(0, 100) + "...");
    });

    console.log("\n--- Inspecting ROOMS (for WFV reference) ---");
    // Try to find a room related to WFV
    const rooms = await db.collection('rooms').limit(5).get();
    rooms.forEach(doc => {
        const d = doc.data();
        if (d.listing_id && d.listing_id.includes('WFV')) {
            console.log(`\nROOM ID: ${doc.id}`);
            console.log("Fields:", Object.keys(d));
            if (d.description) console.log(" - description:", d.description.substring(0, 100) + "...");
        }
    });
}

inspectData();
