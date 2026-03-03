const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'cal-airb-api.firebasestorage.app' // Inferred from .env.cal-airb-api
    });
}
const db = admin.firestore();
const storage = admin.storage();

async function check() {
    console.log("=== FIRESTORE CHECK ===");
    const collections = await db.listCollections();
    console.log("Root Collections:", collections.map(c => c.id).join(', '));

    for (const col of collections) {
        if (['integrations', 'config', 'secrets', 'admin', 'system'].includes(col.id)) {
            console.log(`\nScanning collection: ${col.id}...`);
            const snapshot = await col.limit(10).get();
            snapshot.forEach(doc => {
                console.log(`  Doc: ${doc.id}`);
                const d = doc.data();
                // Mask potential secrets
                const masked = JSON.stringify(d, (key, value) => {
                    if (typeof value === 'string' && value.length > 20 && (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret'))) {
                        return value.substring(0, 10) + '...';
                    }
                    return value;
                }, 2);
                console.log(masked);
            });
        }
    }

    console.log("\n=== GCS CHECK ===");
    try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix: '' });
        console.log("Files in root of bucket:");
        files.forEach(file => {
            if (file.name.endsWith('.json') || file.name.endsWith('.env') || file.name.includes('config') || file.name.includes('token')) {
                console.log(`  ${file.name}`);
            }
        });
    } catch (e) {
        console.error("GCS Check Failed:", e.message);
    }
}

check();
