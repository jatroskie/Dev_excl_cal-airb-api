const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// --- Configuration ---
const HOTEL_CODE = 'TQA';
const DESTINATION = 'De Waterkant';
const CITY = 'Cape Town';
const DEFAULT_CURRENCY = 'ZAR';

// Default Rate Configuration (can be updated later by user)
const DEFAULT_RATES = {
    '2-BR': {
        rack: 5500,
        weekend: 6000,
        weekday: 4500
    },
    '1-BR': {
        rack: 3500,
        weekend: 4000,
        weekday: 3000
    }
};

async function fixTQAListings() {
    console.log(`Starting TQA Listing Gap Fix...`);

    // 1. Fetch all TQA Rooms
    const roomsSnapshot = await db.collection('rooms')
        .where('hotelCode', '==', HOTEL_CODE)
        .get();

    if (roomsSnapshot.empty) {
        console.error("No TQA rooms found! Run bulk_uploader first.");
        return;
    }

    const batch = db.batch();
    let updateCount = 0;
    const actTypesFound = new Set();

    roomsSnapshot.forEach(doc => {
        const data = doc.data();
        const ref = doc.ref;
        let updates = {};

        // A. Fix Destination
        if (data.destination !== DESTINATION) {
            updates.destination = DESTINATION;
        }

        // B. Fix City
        if (data.city !== CITY) {
            updates.city = CITY;
        }

        // C. Fix Bathrooms (Default to bathrooms matching bedrooms if null)
        if (!data.bathrooms && data.bedrooms) {
            updates.bathrooms = data.bedrooms; // logical default
        } else if (!data.bathrooms) {
            updates.bathrooms = 1; // Fallback
        }

        // D. Ensure actType is set (Critical for Rates)
        // If 'bedrooms' is 2, actType should be '2-BR'
        if (!data.actType) {
            if (data.bedrooms === 2) updates.actType = '2-BR';
            else if (data.bedrooms === 1) updates.actType = '1-BR';
            else updates.actType = '2-BR'; // Default for TQA
        }

        const finalActType = updates.actType || data.actType || '2-BR';
        actTypesFound.add(finalActType);

        // E. Ensure Currency
        if (!data.currency) {
            updates.currency = DEFAULT_CURRENCY;
        }

        if (Object.keys(updates).length > 0) {
            console.log(`Updating ${doc.id}:`, updates);
            batch.update(ref, updates);
            updateCount++;
        }
    });

    if (updateCount > 0) {
        await batch.commit();
        console.log(`Updated ${updateCount} rooms with metadata.`);
    } else {
        console.log("Rooms metadata already up to date.");
    }

    // 2. Create/Verify Rates for Found ActTypes
    console.log("Checking Rates for ActTypes:", Array.from(actTypesFound));

    for (const actType of actTypesFound) {
        const unitType = `${HOTEL_CODE}-${actType}`; // e.g., TQA-2-BR
        const rates = DEFAULT_RATES[actType] || DEFAULT_RATES['2-BR'];

        // Check if rate exists
        const rateQuery = await db.collection('apartmentSeasonRates')
            .where('unitType', '==', unitType)
            .get();

        if (rateQuery.empty) {
            console.log(`Creating default rate for ${unitType}...`);
            await db.collection('apartmentSeasonRates').add({
                unitType: unitType,
                name: `Standard 2025-2026 Rate - ${unitType}`,
                startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
                endDate: admin.firestore.Timestamp.fromDate(new Date('2030-12-31')),
                rackRateAgent: rates.rack,
                weekdayRateAgent: rates.weekday,
                weekendRateAgent: rates.weekend,
                minStay: 2,
                currency: DEFAULT_CURRENCY,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Created Rate for ${unitType}.`);
        } else {
            console.log(`Rate already exists for ${unitType}. Skipping.`);
        }
    }

    console.log("TQA Listing Gap Fix Complete.");
}

fixTQAListings();
