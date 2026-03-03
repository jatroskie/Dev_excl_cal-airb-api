const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function readConfig() {
    console.log('--- Checking Camera Config ---');
    const doc = await db.collection('cameras').doc('yi-outdoor-1').get();
    if (doc.exists) {
        console.log('Firestore Data:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('No config found for yi-outdoor-1');
    }
}

readConfig();
