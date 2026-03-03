const admin = require('firebase-admin');
const serviceAccount = require('../../service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function readReferenceRoom() {
    const roomId = 'TQA-415SIGDW';
    console.log(`Reading reference room ${roomId}...`);
    const doc = await db.collection('rooms').doc(roomId).get();
    if (!doc.exists) {
        console.log('No such document!');
    } else {
        const data = doc.data();
        console.log(`-- Reference Data for ${roomId} --`);
        console.log(`coverImageUrl:`, data.coverImageUrl);
        console.log(`thumbnailImageUrl:`, data.thumbnailImageUrl);
        // Also check if imageUrls has specific structure
        if (data.imageUrls && data.imageUrls.length > 0) {
            console.log(`Sample Image Object:`, JSON.stringify(data.imageUrls[0], null, 2));
        }
    }
}

async function checkTQACoverImages() {
    console.log("Checking TQA Rooms for Cover Images...");

    const roomsSnapshot = await db.collection('rooms')
        .where('hotelCode', '==', 'TQA')
        .get();

    if (roomsSnapshot.empty) {
        console.log("No TQA rooms found.");
        return;
    }

    console.log(`Scanning ${roomsSnapshot.size} TQA rooms...`);
    console.log("--------------------------------------------------");

    let missingCoverCount = 0;
    let totalRooms = 0;

    roomsSnapshot.forEach(doc => {
        totalRooms++;
        const data = doc.data();
        const roomId = doc.id;

        let hasCover = false;

        // Check 1: Explicit coverImageUrl field
        if (data.coverImageUrl) {
            hasCover = true;
        }

        // Check 2: isCover flag in imageUrls array
        if (!hasCover && data.imageUrls && Array.isArray(data.imageUrls)) {
            const coverImg = data.imageUrls.find(img => img.isCover === true);
            if (coverImg) {
                hasCover = true;
            }
        }

        if (!hasCover) {
            console.log(`[MISSING COVER] Room: ${roomId}`);
            missingCoverCount++;
        }
    });

    console.log("--------------------------------------------------");
    console.log(`Total Rooms Scanned: ${totalRooms}`);
    console.log(`Rooms Missing Cover: ${missingCoverCount}`);

    if (missingCoverCount === 0) {
        console.log("All TQA rooms have a cover image.");
    }
}

readReferenceRoom();
checkTQACoverImages();
