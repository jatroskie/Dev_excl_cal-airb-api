const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');
const sharp = require('sharp');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const storage = admin.storage();
const BUCKET_NAME = 'cal-airb-api.firebasestorage.app';
const MAX_WIDTH = 1600;
const QUALITY = 85;
const CONCURRENCY_LIMIT = 8; // Process 8 images in parallel

async function resizeTQAImagesInPlace() {
    console.log("---------------------------------------------------------------");
    console.log("STARTING OPTIMIZED IN-PLACE RESIZE (Concurrency: " + CONCURRENCY_LIMIT + ")");
    console.log(`Target Max Width: ${MAX_WIDTH}px`);
    console.log("---------------------------------------------------------------");

    const roomsSnapshot = await db.collection('rooms')
        .where('hotelCode', '==', 'TQA')
        .get();

    if (roomsSnapshot.empty) {
        console.log("No TQA rooms found.");
        return;
    }

    console.log(`Found ${roomsSnapshot.size} TQA rooms. Queuing images...`);
    const bucket = storage.bucket(BUCKET_NAME);

    // 1. Gather all tasks
    let allImageTasks = [];

    roomsSnapshot.forEach(doc => {
        const roomId = doc.id;
        const roomData = doc.data();
        const imageUrls = roomData.imageUrls || [];

        imageUrls.forEach((imgObj, idx) => {
            if (imgObj.url && imgObj.url.includes(BUCKET_NAME)) {
                allImageTasks.push({
                    roomId,
                    index: idx + 1,
                    totalInRoom: imageUrls.length,
                    url: imgObj.url
                });
            }
        });
    });

    console.log(`Total Images to Process: ${allImageTasks.length}`);

    // 2. Process with Concurrency Limit
    let processed = 0;
    let resized = 0;
    let skipped = 0;
    let errors = 0;

    // Helper for simple concurrency
    async function processPool(tasks, limit, worker) {
        const results = [];
        const executing = [];
        for (const item of tasks) {
            const p = Promise.resolve().then(() => worker(item));
            results.push(p);
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    const worker = async (task) => {
        const { roomId, index, totalInRoom, url } = task;

        let filePath = decodeURIComponent(url.split(`${BUCKET_NAME}/`)[1]);
        const file = bucket.file(filePath);

        try {
            const [buffer] = await file.download();
            const metadata = await sharp(buffer).metadata();

            if (metadata.width > MAX_WIDTH) {
                const resizedBuffer = await sharp(buffer)
                    .resize({ width: MAX_WIDTH })
                    .jpeg({ quality: QUALITY, mozjpeg: true })
                    .toBuffer();

                await file.save(resizedBuffer, {
                    contentType: 'image/jpeg',
                    resumable: false,
                    metadata: { cacheControl: 'public, max-age=31536000' }
                });
                await file.makePublic();

                resized++;
                process.stdout.write(`+`); // Visual progress
            } else {
                skipped++;
                process.stdout.write(`.`); // Visual progress
            }
        } catch (err) {
            errors++;
            process.stdout.write(`X`);
            console.error(`\n[ERROR] ${roomId} Img ${index}: ${err.message}`);
        }

        processed++;
        if (processed % 20 === 0) {
            process.stdout.write(` (${processed}/${allImageTasks.length})\n`);
        }
    };

    const startTime = Date.now();
    await processPool(allImageTasks, CONCURRENCY_LIMIT, worker);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n---------------------------------------------------------------");
    console.log("OPTIMIZED RESIZE COMPLETE");
    console.log(`Duration:             ${duration}s`);
    console.log(`Total Scanned:        ${processed}`);
    console.log(`Total Resized:        ${resized}`);
    console.log(`Total Skipped:        ${skipped}`);
    console.log(`Total Errors:         ${errors}`);
    console.log("---------------------------------------------------------------");
}

resizeTQAImagesInPlace();
