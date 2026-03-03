const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkContentStats() {
    const snapshot = await db.collection('rooms')
        .where('hotelCode', '==', 'TQA')
        .get();

    let total = 0;
    let missingDesc = 0;
    let missingAmenities = 0;

    snapshot.forEach(doc => {
        total++;
        const data = doc.data();
        if (!data.description && !data.description50) missingDesc++;
        if (!data.amenities || data.amenities.length === 0) missingAmenities++;
    });

    console.log(`Total TQA Rooms: ${total}`);
    console.log(`Missing Description: ${missingDesc}`);
    console.log(`Missing Amenities: ${missingAmenities}`);
}

checkContentStats();
