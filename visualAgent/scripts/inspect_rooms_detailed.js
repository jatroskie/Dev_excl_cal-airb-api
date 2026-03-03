const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectRooms() {
    console.log("--- Inspecting ROOMS for WFV ---");
    // Fetch WFV rooms
    const rooms = await db.collection('rooms')
        .where('listing_id', '>=', 'WFV')
        .where('listing_id', '<=', 'WFV~')
        .limit(5)
        .get();

    if (rooms.empty) {
        console.log("No WFV rooms found via listing_id query. Checking first 10 rooms generally:");
        const all = await db.collection('rooms').limit(10).get();
        all.forEach(d => console.log(d.id, Object.keys(d.data())));
        return;
    }

    rooms.forEach(doc => {
        const d = doc.data();
        console.log(`\nROOM ID: ${doc.id}`);

        if (d.description) console.log("FOUND description:", d.description.substring(0, 50) + "...");
        else console.log("NO description");

        if (d.amenities) console.log("FOUND amenities:", Array.isArray(d.amenities) ? `Array(${d.amenities.length})` : "string");
        else console.log("NO amenities");

        if (d.house_rules) console.log("FOUND house_rules");

        console.log("Keys:", Object.keys(d).join(", "));
    });
}

inspectRooms();
