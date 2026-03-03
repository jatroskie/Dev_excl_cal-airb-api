const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize with projectId to help discovery
// We do NOT set storageBucket here because we don't know it yet.
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'cal-airb-api'
});

async function listBuckets() {
    try {
        // Access the GCS client directly to list buckets
        // The previous error was because we tried to call .bucket() without a name or default.
        // We need to access the storage client directly.
        const storage = admin.storage().bucket('non-existent-placeholder').storage;
        const [buckets] = await storage.getBuckets();

        console.log('Available Buckets:');
        if (buckets && buckets.length) {
            buckets.forEach(bucket => console.log(bucket.name));
        } else {
            console.log('No buckets found (or permission denied).');
        }
    } catch (err) {
        console.error('ERROR:', err);
    }
}

listBuckets();
