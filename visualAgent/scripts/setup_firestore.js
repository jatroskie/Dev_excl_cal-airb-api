const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCollections() {
  console.log("Checking Firestore connection...");
  
  try {
    const roomsSnapshot = await db.collection('rooms').limit(5).get();
    console.log(`Found 'rooms' collection. Documents count: ${roomsSnapshot.size}`);
    if (roomsSnapshot.size > 0) {
      roomsSnapshot.forEach(doc => {
        console.log(` - Room ID: ${doc.id}`);
      });
    }

    const reservationsSnapshot = await db.collection('reservations').limit(5).get();
    console.log(`Found 'reservations' collection. Documents count: ${reservationsSnapshot.size}`);
     if (reservationsSnapshot.size > 0) {
      reservationsSnapshot.forEach(doc => {
        console.log(` - Reservation ID: ${doc.id}`);
      });
    }
    
    // Check inventory_ledger if exists
    const ledgerSnapshot = await db.collection('inventory_ledger').limit(5).get();
        console.log(`Found 'inventory_ledger' collection. Documents count: ${ledgerSnapshot.size}`);


  } catch (error) {
    console.error("Error accessing Firestore:", error);
  }
}

checkCollections();
