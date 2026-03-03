const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateRoomInfo() {
    console.log("Starting Room Info Migration...");
    const roomsSnapshot = await db.collection('rooms').get();

    const hotelData = {}; // Map: HotelID -> { descriptions: Set(), amenities: Set() }

    roomsSnapshot.forEach(doc => {
        const data = doc.data();

        // 1. Identify Hotel
        let hotelId = null;
        if (data.unitType) {
            hotelId = data.unitType.split('-')[0]; // e.g. WFV from WFV-1-BR
        } else if (doc.id.includes('-')) {
            hotelId = doc.id.split('-')[0];
        }

        if (!hotelId || hotelId.length < 3) return; // Skip if unclear

        if (!hotelData[hotelId]) {
            hotelData[hotelId] = { descriptions: new Set(), amenities: new Set() };
        }

        // 2. Extract Description
        const desc = data.description || data.description500 || data.descriptionLong;
        if (desc && typeof desc === 'string' && desc.length > 20) {
            hotelData[hotelId].descriptions.add(desc);
        }

        // 3. Extract Amenities (if present on room level)
        if (data.amenities && Array.isArray(data.amenities)) {
            data.amenities.forEach(a => hotelData[hotelId].amenities.add(a));
        }
    });

    // 4. Write to Firestore Knowledge Base
    for (const [hotelId, content] of Object.entries(hotelData)) {
        console.log(`Processing ${hotelId} with ${content.descriptions.size} descriptions...`);
        const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');
        const batch = db.batch();
        let hasUpdates = false;

        // Descriptions
        if (content.descriptions.size > 0) {
            const distinctDescs = Array.from(content.descriptions).slice(0, 5); // Limit to top 5 distinctive rooms to save space
            const joined = distinctDescs.join("\n\n---\n\n");

            batch.set(kbRef.doc('room_types'), {
                category: 'amenity', // broadly amenities / product info
                content: `Typical Room Descriptions:\n${joined}`,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            hasUpdates = true;
        }

        // Consolidated Room Amenities
        if (content.amenities.size > 0) {
            const joined = Array.from(content.amenities).join(", ");
            batch.set(kbRef.doc('room_amenities'), {
                category: 'amenity',
                content: `In-Room Amenities include: ${joined}`,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            hasUpdates = true;
        }

        if (hasUpdates) {
            await batch.commit();
            console.log(` - Updated Knowledge Base for ${hotelId}`);
        }
    }

    console.log("Room Migration Complete.");
}

migrateRoomInfo();
