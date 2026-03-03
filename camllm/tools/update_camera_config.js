const admin = require('firebase-admin');
const serviceAccount = require(require('path').join(__dirname, '../service-account-key.json'));

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function updateConfig() {
  console.log('Updating Camera Configuration to RE-ENABLE Authentication for [yi-outdoor-1]...');
  try {
    // Updating 'yi-outdoor-1' with new credentials
    await db.collection('cameras').doc('yi-outdoor-1').update({
      username: 'jatroskie',
      user: 'jatroskie',
      password: 'alexis147',
      pass: 'alexis147',
      save_all: true, // DEBUG: Save everything to analyze "CLEAR" results
      capture_setup_frame: true, // DEBUG: Capture full frame to check FOV
      crop: '', // RESET: Full frame to guarantee detection for now
      prompt: 'Analyze this security camera image. If the scene is static (empty driveway, yard, street) or only has minor movement like leaves/shadows, reply with exactly "CLEAR". If there is a person, vehicle, or animal, describe it briefly (e.g., "Person walking near the gate", "Red car parked in driveway"). Be concise.',
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Successfully updated credentials for yi-outdoor-1.');
  } catch (error) {
    console.error('Error updating config:', error);
  }
}

updateConfig();
