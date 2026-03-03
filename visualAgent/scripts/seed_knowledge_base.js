const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedKnowledgeBase() {
    const hotelId = 'CBL'; // Target Hotel
    console.log(`Seeding Knowledge Base for Hotel: ${hotelId}...`);

    const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');

    const topicMap = {
        "house_rules": {
            content: "Quiet hours are from 10 PM to 8 AM. No parties allowed. No smoking inside the apartment. Pets are not allowed.",
            category: "policy",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "amenities_pool": {
            content: "The communal pool is located on the ground floor. Open from 8:00 AM to 8:00 PM efficiently. No glass bottles allowed near the pool.",
            category: "amenity",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "check_in_instructions": {
            content: "Check-in is at 3 PM. Use the lockbox code 1234 to retrieve the key.",
            category: "logistics",
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "parking": {
            content: "Use Bay 12 in the underground garage. It is a tight squeeze, suitable for compact cars.",
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

seedKnowledgeBase();
