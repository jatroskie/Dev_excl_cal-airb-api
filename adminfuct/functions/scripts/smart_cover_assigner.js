const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
const sharp = require('sharp');
const serviceAccount = require('../../service-account-key.json');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket('cal-airb-api.firebasestorage.app');

// Initialize Vertex AI
const project = 'cal-airb-api';
const location = 'us-central1';
const vertex_ai = new VertexAI({ project, location });
const model = 'gemini-2.0-flash-exp';

const GENERATIVE_MODEL = vertex_ai.getGenerativeModel({
    model: model,
    generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.2, // Low temp for deterministic selection
    }
});

async function smartAssignCovers() {
    console.log(`Starting Smart Cover Assignment for TQA...`);

    // 1. Get TQA Rooms
    const roomsSnapshot = await db.collection('rooms')
        .where('hotelCode', '==', 'TQA')
        .get();

    let processedCount = 0;

    for (const doc of roomsSnapshot.docs) {
        const roomId = doc.id;
        const data = doc.data();

        // Skip if already has cover AND thumbnail (User asked to identify missing, but "If no view..." implies selection logic)
        // We will target rooms that are MISSING cover OR thumbnail.
        const hasCover = !!data.coverImageUrl;
        const hasThumb = !!data.thumbnailImageUrl;

        if (hasCover && hasThumb) {
            // console.log(`Skipping ${roomId} (Already has cover & thumb)`);
            continue;
        }

        console.log(`Processing ${roomId}...`);
        const imageUrls = data.imageUrls || [];

        if (imageUrls.length === 0) {
            console.log(` -> No images found. Skipping.`);
            continue;
        }

        // 2. Prepare Images for AI Selection
        // AI Limit: sending up to 16 images for selection to avoid token limits/latency.
        // We prioritize "View" or "Lounge". Ideally we send all, but let's cap at 12 to be safe with Vision API payloads if we were sending bytes.
        // For Gemini 2.0 Flash with URLs/Storage URIs, we can send more.
        // We need to construct the prompt with image parts.

        // We will use the GCS URI `gs://...` format which is efficient for Vertex AI
        // Convert public URL to gs:// uri
        // https://storage.googleapis.com/cal-airb-api.firebasestorage.app/rooms/TQA-0301/img.jpg 
        // -> gs://cal-airb-api.firebasestorage.app/rooms/TQA-0301/img.jpg

        const imageParts = imageUrls.map(img => {
            if (!img.url) return null;
            const gsPath = img.url.replace('https://storage.googleapis.com/', 'gs://');
            return {
                fileData: {
                    fileUri: gsPath,
                    mimeType: 'image/jpeg' // Assumption, checked in processing
                }
            };
        }).filter(p => p !== null).slice(0, 15); // Limit to first 15 to be safe

        if (imageParts.length === 0) continue;

        // 3. Ask AI to Select
        const prompt = `
        Look at these images of a vacation rental apartment.
        Select the SINGLE BEST image to be the "Cover Image".
        
        Priorities:
        1. A scenic VIEW from the apartment (ocean, city, mountain).
        2. If no good view, a stylish LIVING ROOM / ENTERTAINMENT area.
        3. If unavailable, a high-quality main BEDROOM.
        
        Return ONLY the integer index (0-based) of the selected image.
        Format: "INDEX: 3"
        `;

        let selectedIndex = 0; // Default to first
        try {
            const req = {
                contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }]
            };

            const result = await GENERATIVE_MODEL.generateContent(req);
            const responseText = result.response.candidates[0].content.parts[0].text;

            const match = responseText.match(/INDEX:\s*(\d+)/i);
            if (match) {
                selectedIndex = parseInt(match[1]);
                if (selectedIndex >= imageUrls.length) selectedIndex = 0; // Fallback
                console.log(` -> AI Selected Index: ${selectedIndex} (${imageUrls[selectedIndex].category || 'unknown'})`);
            } else {
                console.log(` -> AI response unclear ("${responseText}"), defaulting to 0.`);
            }

        } catch (e) {
            console.error(` -> AI Error: ${e.message}. Defaulting to index 0.`);
        }

        const selectedImageObj = imageUrls[selectedIndex];
        const coverUrl = selectedImageObj.url;

        // 4. Generate Thumbnail
        let thumbUrl = null;
        try {
            // Download original
            const filePath = coverUrl.split('cal-airb-api.firebasestorage.app/')[1];
            const [buffer] = await bucket.file(decodeURIComponent(filePath)).download();

            // Resize to 300w, WebP
            const thumbBuffer = await sharp(buffer)
                .resize({ width: 300 })
                .webp({ quality: 80 })
                .toBuffer();

            // Upload Thumbnail
            const fileName = filePath.split('/').pop();
            const thumbFileName = fileName.replace(/\.[^/.]+$/, "") + "_thumb_300.webp";
            const thumbPath = filePath.replace(fileName, thumbFileName);

            const thumbFile = bucket.file(thumbPath);
            await thumbFile.save(thumbBuffer, {
                contentType: 'image/webp',
                metadata: { cacheControl: 'public, max-age=31536000' }
            });
            await thumbFile.makePublic();

            thumbUrl = `https://storage.googleapis.com/cal-airb-api.firebasestorage.app/${thumbPath}`;
            console.log(` -> Thumbnail Created: ${thumbFileName}`);

        } catch (e) {
            console.error(` -> Thumbnail Error: ${e.message}`);
        }

        // 5. Update Firestore
        const updates = {
            coverImageUrl: coverUrl,
            thumbnailImageUrl: thumbUrl || coverUrl // Fallback to cover if thumb fails
        };

        // Update isCover in array
        const newImageUrls = imageUrls.map((img, idx) => ({
            ...img,
            isCover: (idx === selectedIndex)
        }));
        updates.imageUrls = newImageUrls;

        await db.collection('rooms').doc(roomId).update(updates);
        console.log(` -> Firestore Updated.`);
        processedCount++;
    }

    console.log(`Done. Processed ${processedCount} rooms.`);
}

smartAssignCovers();
