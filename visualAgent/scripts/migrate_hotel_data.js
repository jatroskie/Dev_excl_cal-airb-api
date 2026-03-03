const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateData() {
    console.log("Starting Migration...");
    const hotelsSnapshot = await db.collection('hotels').get();

    for (const doc of hotelsSnapshot.docs) {
        const hotelId = doc.id;
        const data = doc.data();
        console.log(`Processing Hotel: ${hotelId}`);

        const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');
        const batch = db.batch();
        let count = 0;

        // 1. House Rules
        if (data.houseRules) {
            let content = "";
            if (Array.isArray(data.houseRules)) {
                content = data.houseRules.join("\n");
            } else {
                content = String(data.houseRules);
            }
            if (content.trim()) {
                batch.set(kbRef.doc('house_rules'), {
                    category: 'policy',
                    content: content,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            }
        }

        // 2. Amenities
        if (data.amenities) {
            let content = "";
            if (Array.isArray(data.amenities)) {
                content = data.amenities.join(", ");
            } else {
                content = String(data.amenities);
            }
            if (content.trim()) {
                batch.set(kbRef.doc('amenities_general'), {
                    category: 'amenity',
                    content: content,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            }
        }

        // 3. Directions
        if (data.directions) {
            let content = "";
            if (Array.isArray(data.directions)) {
                // specific handling if it's just image URLs or text
                content = data.directions.map(d => JSON.stringify(d)).join("\n");
            } else {
                content = String(data.directions);
            }
            if (content.trim()) {
                batch.set(kbRef.doc('directions'), {
                    category: 'logistics',
                    content: content,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            }
        }

        // 4. Wifi (if exists separate)
        if (data.wifi) {
            batch.set(kbRef.doc('wifi'), {
                category: 'amenity',
                content: typeof data.wifi === 'object' ? JSON.stringify(data.wifi) : String(data.wifi),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        }

        if (count > 0) {
            await batch.commit();
            console.log(` - Migrated ${count} docs to Knowledge Base.`);
        } else {
            console.log(` - No legacy data found to migrate.`);
        }
    }
    console.log("Migration Complete.");
}

migrateData();
