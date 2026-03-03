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

async function analyzeTQAImages() {
    console.log("Starting TQA Image Dimension Analysis...");
    console.log(" fetching rooms...");

    const roomsSnapshot = await db.collection('rooms')
        .where('hotelCode', '==', 'TQA')
        .get();

    if (roomsSnapshot.empty) {
        console.log("No TQA rooms found.");
        return;
    }

    console.log(`Found ${roomsSnapshot.size} TQA rooms. Scanning images...`);
    console.log("---------------------------------------------------------------");
    console.log("| Room ID  | Image Name                     | Dimensions  | Size Status |");
    console.log("|----------|--------------------------------|-------------|-------------|");

    const bucket = storage.bucket(BUCKET_NAME);

    for (const doc of roomsSnapshot.docs) {
        const roomData = doc.data();
        const roomId = doc.id;
        const imageUrls = roomData.imageUrls || [];

        if (imageUrls.length === 0) {
            console.log(`| ${roomId.padEnd(8)} | (No Images)                    | N/A         | N/A         |`);
            continue;
        }

        for (const imgObj of imageUrls) {
            const url = imgObj.url;
            if (!url) continue;

            // correct URL parsing for standard GCS public URLs
            // Format: https://storage.googleapis.com/cal-airb-api.firebasestorage.app/rooms/TQA-0301/img.jpg
            let filePath = '';
            if (url.includes(BUCKET_NAME)) {
                filePath = url.split(`${BUCKET_NAME}/`)[1];
            } else {
                // Fallback or skip if format unknown
                continue;
            }

            // Handle URL decoding if necessary (usually spaces are %20 in URLs but raw storage paths)
            // But GCS public URLs usually have encoded paths. 
            filePath = decodeURIComponent(filePath);

            const fileName = filePath.split('/').pop();
            const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;

            try {
                // Download file to buffer
                const [buffer] = await bucket.file(filePath).download();

                // Get Metadata
                const metadata = await sharp(buffer).metadata();
                const width = metadata.width;
                const height = metadata.height;
                const dims = `${width}x${height}`;

                let status = "OK";
                if (width > 1600) status = "**LARGE**";

                console.log(`| ${roomId.padEnd(8)} | ${displayName.padEnd(30)} | ${dims.padEnd(11)} | ${status.padEnd(11)} |`);

            } catch (err) {
                console.log(`| ${roomId.padEnd(8)} | ${displayName.padEnd(30)} | ERROR       | ${err.message.substring(0, 10)} |`);
            }
        }
    }
    console.log("---------------------------------------------------------------");
    console.log("Analysis Complete.");
}

analyzeTQAImages();
