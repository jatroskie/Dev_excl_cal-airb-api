const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRooms() {
    const snapshot = await db.collection('rooms').limit(2).get();
    snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}

checkRooms();
