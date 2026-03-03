const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// --- CONFIG ---
const SOURCE_DIR = 'C:/Users/jatro/Documents/Vacprop/TQA Pics';
const PROJECT_ID = 'cal-airb-api';
const BUCKET_NAME = 'cal-airb-api.firebasestorage.app';
const SERVICE_ACCOUNT_PATH = './service-account-key.json';

// --- INIT ---
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket(BUCKET_NAME);
const { FieldValue } = require('firebase-admin/firestore');

const IGNORE_DIRS = ['General', 'Rooms - do not use', 'TQ 601 - do not use'];
const IGNORE_ROOMS = ['TQA-0301', 'TQA-0302', 'TQA-0303'];

async function processDirectory() {
    console.log(`Scanning root directory: ${SOURCE_DIR}`);

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Directory not found: ${SOURCE_DIR}`);
        return;
    }

    // 1. Get Category Folders (e.g., "Two Bedroom", "Studios")
    const categories = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !IGNORE_DIRS.includes(dirent.name));

    for (const cat of categories) {
        const catPath = path.join(SOURCE_DIR, cat.name);
        console.log(`\nEntering Category: ${cat.name}`);

        // 2. Get Room Folders (e.g., "TQ 301", "TQ 403")
        const roomFolders = fs.readdirSync(catPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !IGNORE_DIRS.includes(dirent.name));

        for (const roomFolder of roomFolders) {
            // MAP "TQ 301" -> "TQA-0301"
            const originalName = roomFolder.name;
            const normalizedId = normalizeRoomId(originalName);

            if (normalizedId) {
                if (IGNORE_ROOMS.includes(normalizedId)) {
                    console.log(`   Skipping Manual Room: ${normalizedId}`);
                    continue;
                }
                console.log(`   Found Room: ${originalName} -> ID: ${normalizedId}`);
                await processRoomFolder(normalizedId, path.join(catPath, originalName));
            } else {
                console.warn(`   Skipping unrecognized folder format: ${originalName}`);
            }
        }
    }
}

function normalizeRoomId(folderName) {
    // Handle "TQ 301" -> "TQA-0301"
    const match = folderName.match(/^TQ\s*(\d+)$/i);
    if (match) {
        const number = match[1];
        // Ensure 4 digits if needed, or just prepended with 0 if it's 3 digits?
        // Based on user screenshot: TQA-0301 (3 digits became 0301).
        const paddedNumber = number.length === 3 ? '0' + number : number;
        return `TQA-${paddedNumber}`;
    }
    // Handle "TQA-0301" (Exact match)
    if (/^TQA-\d{4}$/.test(folderName)) return folderName;

    return null;
}

async function processRoomFolder(roomId, folderPath) {
    const files = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    console.log(`      Processing ${files.length} images for ${roomId}...`);

    if (files.length === 0) return;

    const uploadedImages = [];

    // UPLOAD LOOP (Sequential to avoid network saturation)
    for (const fileName of files) {
        const localFilePath = path.join(folderPath, fileName);
        const fileExt = path.extname(fileName);
        const storageFilename = `${uuidv4()}${fileExt}`;
        const gcsPath = `rooms/${roomId}/${storageFilename}`;

        try {
            const [uploadedFile] = await bucket.upload(localFilePath, {
                destination: gcsPath,
                metadata: {
                    contentType: 'image/' + fileExt.substring(1).replace('jpg', 'jpeg'),
                    cacheControl: 'public, max-age=31536000'
                }
            });

            await uploadedFile.makePublic();
            const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;

            uploadedImages.push({
                url: publicUrl,
                category: null,
                labels: [],
                isCover: false,
                uploadedAt: new Date().toISOString()
            });

        } catch (e) {
            console.error(`         ERROR uploading ${fileName}:`, e.message);
        }
    }

    if (uploadedImages.length > 0) {
        // RACE CONDITION HANDLING:
        // We prepare the ENTIRE list of new images in memory `uploadedImages`.
        // We send ONE request to Firestore to add them all.
        // This guarantees no race conditions because it's a single atomic transaction for this room.

        console.log(`      Syncing ${uploadedImages.length} images to Firestore...`);

        const roomRef = db.collection('rooms').doc(roomId);
        try {
            await roomRef.set({
                imageUrls: FieldValue.arrayUnion(...uploadedImages),
                lastUpdated: FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`      SUCCESS: ${roomId} updated.`);
        } catch (e) {
            console.error(`      ERROR updating Firestore for ${roomId}:`, e.message);
        }
    }
}

processDirectory().then(() => {
    console.log("Bulk Upload Complete.");
    process.exit(0);
}).catch(e => {
    console.error("Script Failed:", e);
    process.exit(1);
});
