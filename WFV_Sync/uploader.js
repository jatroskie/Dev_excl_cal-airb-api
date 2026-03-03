// uploader.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function uploadToFirebase(jsonPath) {
  // Assume serviceAccount.json in root; or env vars
  if (!admin.apps.length) {
    const serviceAccount = require('./new-service-account-key.json'); // User to provide
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://your-project.firebaseio.com'
    });
  }

  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const timestamp = path.basename(jsonPath).replace('.json', '');
  await admin.database().ref(`reservations/wfv/${timestamp}`).set(json);
  console.log(`Uploaded to Firebase: reservations/wfv/${timestamp}`);
}

module.exports = { uploadToFirebase };