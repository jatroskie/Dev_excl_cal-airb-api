const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function seed() {
    const cameraId = 'yi-outdoor-1';
    const config = {
        ip: '192.168.0.113', // Current IP
        user: 'jatroskie',     // Current User
        pass: 'alexis147',     // Current Pass
        pollIntervalMs: 15000,
        prompt: `Analyze this security camera image. 
    If the scene is static (empty driveway, yard, street) or only has minor movement like leaves/shadows, reply with exactly "CLEAR". 
    If there is a person, vehicle, or animal, describe it briefly (e.g., "Person walking near the gate", "Red car parked in driveway").
    Be concise.`,
        whatsapp_recipient: '27827827827', // Placeholder, user can update via UI
        whatsapp_token: 'PLACEHOLDER_TOKEN', // Should ideally be secure/env, but for now in DB or Env
        active: true
    };

    await db.collection('cameras').doc(cameraId).set(config, { merge: true });
    console.log(`Seeded config for ${cameraId}`);
}

seed();
