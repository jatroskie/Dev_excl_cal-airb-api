const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function readRoom() {
    const roomId = 'TQA-0601';
    console.log(`Reading ${roomId}...`);
    const doc = await db.collection('rooms').doc(roomId).get();
    if (!doc.exists) {
        console.log('No such document!');
    } else {
        console.log(JSON.stringify(doc.data(), null, 2));
    }
}

readRoom();
