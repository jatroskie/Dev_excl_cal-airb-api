const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedSecondHotel() {
    const hotelId = 'WFV'; // Waterfront Village
    console.log(`Seeding Second Hotel: ${hotelId}...`);

    // Create Hotel Doc if not exists
    await db.collection('hotels').doc(hotelId).set({
        name: "Waterfront Village",
        location: "V&A Waterfront",
        checkInTime: "14:00",
        checkOutTime: "10:00"
    }, { merge: true });

    const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');

    const topicMap = {
        "house_rules": {
            content: "Strictly no noise after 9 PM. This is a residential canal estate. Guests must register at security.",
            category: "policy",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "amenities_gym": {
            content: "The gym is located at the Quarterdeck. Access card required. Open 24/7.",
            category: "amenity",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "parking": {
            content: "Underground parking bay 204. Park only in your designated bay or you will be clamped.",
            category: "logistics",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }
    };

    for (const [docId, data] of Object.entries(topicMap)) {
        await kbRef.doc(docId).set(data);
        console.log(` - Wrote: ${docId}`);
    }

    console.log("Seed Complete.");
}

seedSecondHotel();
