const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function updateConfig() {
    console.log('Updating [yi-outdoor-1] for MAXIMUM DEBUGGING...');
    try {
        await db.collection('cameras').doc('yi-outdoor-1').update({
            alert_frequency: 10,        // 10 seconds cooldown
            save_all: true,            // Process EVERYTHING (even "CLEAR" / "Static")
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Success: Alert Freq = 10s, Save All = TRUE.');
    } catch (error) {
        console.error('Error:', error);
    }
}

updateConfig();
