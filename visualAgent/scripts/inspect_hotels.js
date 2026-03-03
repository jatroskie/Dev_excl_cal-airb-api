const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkHotels() {
    console.log("Inspecting 'hotels' collection...");
    const snapshot = await db.collection('hotels').limit(2).get();
    if (snapshot.empty) {
        console.log("No hotel documents found.");
        return;
    }
    snapshot.forEach(doc => {
        console.log(`\n=== Hotel ID: ${doc.id} ===`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}

checkHotels();
