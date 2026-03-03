const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
const fetch = require('node-fetch'); // Ensure you have node-fetch installed or use axios

// Initialize Firebase Admin (for direct DB verification usually, but here we simulate the webhook)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 1. SAMPLE PAYLOAD (As provided by user)
const SAMPLE_PAYLOAD = {
    "id": 13,
    "hostawayReservationId": 13,
    "channelId": 2000,
    "channelName": "airbnb",
    "channelReservationId": "10450-40160-thread313906227-" + Math.floor(Math.random() * 1000000000), // Randomize for uniqueness
    "status": "new",
    "isInstantBooked": 1,
    "arrivalDate": "2026-07-15", // Updated to future date
    "departureDate": "2026-07-16",
    "totalPrice": 267,
    "currency": "USD",
    "guestName": "Andrew Peterson",
    "guestEmail": "mail@test.com",
    "checkInTime": "15:00",
    "checkOutTime": "11:00",
    "confirmationCode": "HMP" + Math.random().toString(36).substring(7).toUpperCase(),
    // ... other fields can be added strictly as needed
};

// 2. CONFIGURATION
const WEBHOOK_URL = 'http://127.0.0.1:5001/visualagent-app/us-central1/handleAirbnbWebhook'; // Update with actual local/prod URL
const USE_DIRECT_DB_WRITE = true; // Set to TRUE until the Cloud Function is actually deployed

async function main() {
    console.log("🚀 Starting Mock Airbnb Webhook Simulation...");
    console.log("Target:", USE_DIRECT_DB_WRITE ? "Direct Firestore Write (Mocking Function Logic)" : WEBHOOK_URL);

    try {
        if (USE_DIRECT_DB_WRITE) {
            await simulateFunctionLogic(SAMPLE_PAYLOAD);
        } else {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(SAMPLE_PAYLOAD)
            });
            const data = await response.text();
            console.log("Response:", response.status, data);
        }
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// 3. LOGIC (Simulates what the Cloud Function WILL do)
async function simulateFunctionLogic(payload) {
    const reservationId = `airbnb_${payload.channelReservationId}`;
    const docRef = db.collection('reservations').doc(reservationId);

    console.log(`Processing Reservation ID: ${reservationId}`);

    // Map Airbnb Payload to Our Internal Schema
    const internalReservation = {
        source: 'airbnb',
        externalId: payload.channelReservationId,
        status: payload.status === 'new' ? 'confirmed' : payload.status, // Map 'new' instant book to 'confirmed'
        guest: {
            name: payload.guestName,
            email: payload.guestEmail,
            phone: payload.guestPhone || null
        },
        stay: {
            checkIn: payload.arrivalDate,
            checkOut: payload.departureDate,
            api_checkInTime: payload.checkInTime,
            api_checkOutTime: payload.checkOutTime
        },
        financials: {
            total: payload.totalPrice,
            currency: payload.currency,
            cleaningFee: payload.airbnbListingCleaningFee || 0
        },
        channelData: payload, // Store raw payload for audit
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Write to Firestore
    await docRef.set(internalReservation, { merge: true });
    console.log("✅ Successfully wrote to Firestore:", reservationId);

    // Optional: Simulating Guest Profile Creation (Idempotent)
    // In a real scenario, we'd search by email first
    const guestRef = db.collection('guests').doc(payload.guestEmail); // Simple keying by email for now
    await guestRef.set({
        name: payload.guestName,
        email: payload.guestEmail,
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log("✅ Guest profile updated:", payload.guestEmail);
}

main();
