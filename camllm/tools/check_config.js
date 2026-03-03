const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function checkConfig() {
    console.log("Checking Camera Config...");
    const snapshot = await db.collection('cameras').get();
    snapshot.forEach(doc => {
        console.log(`\nID: ${doc.id}`);
        console.log(doc.data());
    });
}

checkConfig();
