const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'cal-airb-api.firebasestorage.app'
    });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();

async function testFetch(config, res) {
    const url = `http://${config.ip}/cgi-bin/snapshot.sh?res=${res}`;
    const start = Date.now();
    try {
        const response = await axios.get(url, {
            auth: { username: config.user, password: config.pass },
            responseType: 'arraybuffer',
            timeout: 15000
        });
        const duration = Date.now() - start;
        return { success: true, duration, size: response.data.length };
    } catch (e) {
        return { success: false, duration: Date.now() - start, error: e.message };
    }
}

async function testUpload(buffer) {
    const start = Date.now();
    const filename = `calibration_test_${Date.now()}.jpg`;
    const file = bucket.file(filename);
    try {
        await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
        // Cleanup
        // await file.delete(); 
        return { success: true, duration: Date.now() - start };
    } catch (e) {
        return { success: false, duration: Date.now() - start, error: e.message };
    }
}

async function runCalibration() {
    console.log("--- Camera Calibration Tool ---");

    const camerasSnapshot = await db.collection('cameras').where('active', '==', true).get();
    if (camerasSnapshot.empty) {
        console.log("No active cameras found.");
        return;
    }

    for (const doc of camerasSnapshot.docs) {
        const config = doc.data();
        config.id = doc.id;
        console.log(`\nTesting Camera: ${config.id} (${config.ip})`);

        // Test High Res
        console.log("  [High Res] Testing...");
        let highResStats = { times: [], sizes: [], failures: 0 };
        for (let i = 0; i < 3; i++) {
            const res = await testFetch(config, 'high');
            if (res.success) {
                highResStats.times.push(res.duration);
                highResStats.sizes.push(res.size);
                process.stdout.write(`    Attempt ${i + 1}: ${res.duration}ms (${(res.size / 1024).toFixed(1)} KB)\n`);
            } else {
                highResStats.failures++;
                process.stdout.write(`    Attempt ${i + 1}: Failed (${res.error})\n`);
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        // Test Low Res
        console.log("  [Low Res] Testing...");
        let lowResStats = { times: [], sizes: [], failures: 0 };
        for (let i = 0; i < 3; i++) {
            const res = await testFetch(config, 'low');
            if (res.success) {
                lowResStats.times.push(res.duration);
                lowResStats.sizes.push(res.size);
                process.stdout.write(`    Attempt ${i + 1}: ${res.duration}ms (${(res.size / 1024).toFixed(1)} KB)\n`);
            } else {
                lowResStats.failures++;
                process.stdout.write(`    Attempt ${i + 1}: Failed (${res.error})\n`);
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        // Test Upload (using smaller buffer for speed)
        console.log("  [Cloud Upload] Testing...");
        let uploadStats = { times: [], failures: 0 };
        const dummyBuffer = Buffer.alloc(50 * 1024); // 50KB dummy
        for (let i = 0; i < 3; i++) {
            const res = await testUpload(dummyBuffer);
            if (res.success) {
                uploadStats.times.push(res.duration);
                process.stdout.write(`    Attempt ${i + 1}: ${res.duration}ms\n`);
            } else {
                uploadStats.failures++;
                process.stdout.write(`    Attempt ${i + 1}: Failed (${res.error})\n`);
            }
        }

        // Summary
        console.log("\n  --- Results ---");
        const avgHigh = highResStats.times.reduce((a, b) => a + b, 0) / highResStats.times.length || 0;
        const avgLow = lowResStats.times.reduce((a, b) => a + b, 0) / lowResStats.times.length || 0;
        const avgUpload = uploadStats.times.reduce((a, b) => a + b, 0) / uploadStats.times.length || 0;

        console.log(`  High Res Avg: ${avgHigh.toFixed(0)}ms (Failures: ${highResStats.failures}/3)`);
        console.log(`  Low Res Avg:  ${avgLow.toFixed(0)}ms (Failures: ${lowResStats.failures}/3)`);
        console.log(`  Upload Avg:   ${avgUpload.toFixed(0)}ms`);

        let recommendation = "High Res";
        if (highResStats.failures > 0 || avgHigh > 5000) recommendation = "Low Res";

        console.log(`  Recommendation: ${recommendation}`);
    }
}

runCalibration();
