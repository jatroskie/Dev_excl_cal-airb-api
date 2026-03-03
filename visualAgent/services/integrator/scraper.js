const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function scrapeOpera() {
    console.log("Starting Opera Scraper (Mock)...");

    // Simulate scraping time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 10% chance to find a new booking
    if (Math.random() > 0.0) { // Force it for demo
        console.log("Detected new Booking.com reservation!");

        const mockReservation = {
            channel: "Booking.com",
            status: "confirmed",
            guest_name: "Bcom User " + Math.floor(Math.random() * 1000),
            start_date: "2026-03-01",
            end_date: "2026-03-05",
            room_type_id: "Standard Double", // Generic type
            unallocated: true,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // Check duplication (omitted for mock)
        const res = await db.collection("reservations").add(mockReservation);
        console.log(`Synced to Firestore: ${res.id}`);

        // Trigger Deduction Logic (In real app, Gatekeeper listener handles this)
        // Here we just log it.
        await updateLedgerForUnallocated(mockReservation);
    } else {
        console.log("No new reservations found.");
    }
}

async function updateLedgerForUnallocated(res) {
    const key = `${res.start_date}_Generic`; // Using Generic bucket
    const ledgerRef = db.collection("inventory_ledger").doc(key);

    // Simple increment of soft_allocated_count
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(ledgerRef);
            let units = 0;
            if (doc.exists) {
                units = doc.data().soft_allocated_count || 0;
            }
            t.set(ledgerRef, { soft_allocated_count: units + 1 }, { merge: true });
        });
        console.log("Updated Inventory Ledger (Soft Allocation).");
    } catch (e) {
        console.error("Ledger update failed:", e);
    }
}

scrapeOpera();
