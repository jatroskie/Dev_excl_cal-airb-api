// adminfuct/functions/index.js

// --- Core Requires ---
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Busboy = require('busboy');

const { FieldValue, Timestamp } = require('firebase-admin/firestore');

// Set global options for all functions
setGlobalOptions({ region: "us-central1" });

// --- ADD YOUR PRIMARY PROJECT'S DEFAULT BUCKET NAME ---
const PRIMARY_PROJECT_BUCKET_NAME = 'cal-airb-api.firebasestorage.app'; // Updated to match .firebaserc
// ---------------------------------------------------------

// --- Initialize Admin SDK ---
try {
    const serviceAccount = require('./service-account-key.json'); // Assumes key is in functions/
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Admin SDK initialized successfully for adminfuct.");
} catch (e) {
    console.error("FATAL ERROR initializing Firebase Admin SDK. Check path/validity of serviceAccountKey.json.", e);
    throw new Error("Admin SDK Initialization Failed in adminfuct.");
}

const db = admin.firestore();
const storage = admin.storage(); // Use Admin SDK's authenticated storage client

// --- Helper Function: Parse GCS URL ---
function getBucketAndPath(gcsUrl) {
    const funcName = '[getBucketAndPath]';
    try {
        const url = new URL(gcsUrl);
        if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
            const parts = url.pathname.split('/');
            if (parts.length < 3 || !parts[1]) throw new Error('Invalid GCS URL path structure (googleapis)');
            const bucketName = parts[1];
            const filePath = parts.slice(2).join('/');
            if (!filePath) throw new Error('File path is empty in GCS URL (googleapis)');
            return { bucketName, filePath };
        } else if (url.hostname === 'firebasestorage.googleapis.com') {
            const pathSegments = url.pathname.split('/o/');
            if (pathSegments.length > 1) {
                const bucketNameSegment = url.pathname.split('/b/')[1];
                if (!bucketNameSegment) throw new Error('Bucket name segment not found (firebasestorage)');
                const bucketName = bucketNameSegment.split('/o/')[0];
                const encodedPathWithQuery = pathSegments[1];
                const encodedPath = encodedPathWithQuery.split('?')[0];
                const filePath = decodeURIComponent(encodedPath);
                if (!bucketName || !filePath) throw new Error('Invalid Firebase Storage URL format after parsing');
                return { bucketName, filePath };
            }
            throw new Error('Path segment /o/ not found (firebasestorage)');
        }
        throw new Error(`Unsupported GCS URL hostname: ${url.hostname}`);
    } catch (e) {
        // Use console.error instead of functions.logger if preferrable in v2, but logger still works
        console.error(`${funcName} Error parsing GCS URL:`, { url: gcsUrl, error: e.message, stack: e.stack });
        return null;
    }
}


// --- Cloud Function: Set Cover Image & Generate Thumbnail ---
exports.setCoverImageAndGenerateThumbnail = onRequest({ cors: true, timeoutSeconds: 120, memory: "512MiB", invoker: 'public' }, async (req, res) => {
    const funcName = '[setCoverImageAndGenerateThumbnail]';

    // CORS is handled by { cors: true } automatically!

    if (req.method !== 'POST') {
        console.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    const { roomId, selectedImageUrl } = req.body;
    console.log(`${funcName} Request received for room: ${roomId}`, { selectedImageUrl: selectedImageUrl ? '*** URL Present ***' : '!!! URL MISSING !!!' });
    if (!roomId || !selectedImageUrl) {
        return res.status(400).json({ status: 'error', message: 'Missing required parameters: roomId, selectedImageUrl' });
    }

    const roomRef = db.collection('rooms').doc(roomId);
    let tempLocalOriginalPath = null; let tempLocalThumbPath = null; let finalThumbnailUrl = null;

    try {
        await db.runTransaction(async (transaction) => {
            console.log(`${funcName} Transaction started for room ${roomId}.`);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) throw new Error(`Room document ${roomId} not found.`);
            const roomData = roomDoc.data();
            let imageUrls = roomData.imageUrls;
            if (!Array.isArray(imageUrls)) imageUrls = [];

            let foundSelected = false; let actualSelectedUrl = null;
            const updatedImageUrls = imageUrls.map(img => {
                const currentImgUrl = img && typeof img.url === 'string' ? img.url : null;
                const isSelected = currentImgUrl === selectedImageUrl;
                if (isSelected) { foundSelected = true; actualSelectedUrl = currentImgUrl; }
                return { ...img, isCover: isSelected };
            });
            if (!foundSelected) {
                const selectedIndex = imageUrls.findIndex(img => img && typeof img.url === 'string' && (img.url.includes(selectedImageUrl) || selectedImageUrl.includes(img.url)));
                if (selectedIndex !== -1) {
                    console.warn(`${funcName} Exact URL match failed, using index ${selectedIndex}...`);
                    updatedImageUrls.forEach((img, index) => { img.isCover = (index === selectedIndex); });
                    foundSelected = true; actualSelectedUrl = imageUrls[selectedIndex].url;
                } else { throw new Error(`Selected image URL not found in room ${roomId} imageUrls.`); }
            }
            if (!actualSelectedUrl) { throw new Error('Could not determine actual selected URL for processing.'); }

            console.log(`${funcName} Generating thumbnail for: ${actualSelectedUrl}`);
            const parsedGcsUrl = getBucketAndPath(actualSelectedUrl);
            if (!parsedGcsUrl) throw new Error(`Could not parse GCS URL: ${actualSelectedUrl}`);
            const { bucketName, filePath: originalGcsFilePath } = parsedGcsUrl;
            const bucket = storage.bucket(bucketName);
            const originalFile = bucket.file(originalGcsFilePath);
            const uniqueId = uuidv4(); const originalBaseName = path.basename(originalGcsFilePath);
            tempLocalOriginalPath = path.join(os.tmpdir(), `${uniqueId}_${originalBaseName}`);
            const thumbnailFileName = `${path.parse(originalGcsFilePath).name}_thumb_300.webp`;
            const thumbnailGcsPath = `${path.dirname(originalGcsFilePath)}/${thumbnailFileName}`;
            tempLocalThumbPath = path.join(os.tmpdir(), `${uniqueId}_thumb_${path.parse(originalBaseName).name}.webp`);
            await originalFile.download({ destination: tempLocalOriginalPath });
            await sharp(tempLocalOriginalPath).resize(300).webp({ quality: 80 }).toFile(tempLocalThumbPath);
            const [uploadedFile] = await bucket.upload(tempLocalThumbPath, {
                destination: thumbnailGcsPath,
                metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' },
            });
            try { await uploadedFile.makePublic(); } catch (publicError) { console.error(`${funcName} Failed to make thumbnail public.`, publicError); }
            finalThumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbnailGcsPath}`;
            console.log(`${funcName} Generated Thumbnail URL: ${finalThumbnailUrl}`);
            transaction.update(roomRef, { imageUrls: updatedImageUrls, thumbnailImageUrl: finalThumbnailUrl });
            console.log(`${funcName} Firestore transaction update prepared for room ${roomId}.`);
        });
        console.log(`${funcName} Transaction successful for room ${roomId}.`);
        res.status(200).json({ status: 'success', message: 'Cover image set and thumbnail generated.', thumbnailUrl: finalThumbnailUrl });
    } catch (error) {
        console.error(`${funcName} Operation FAILED for room ${roomId}:`, { message: error.message, stack: error.stack });
        res.status(500).json({ status: 'error', message: `Operation failed: ${error.message}` });
    } finally {
        try {
            if (tempLocalOriginalPath && fs.existsSync(tempLocalOriginalPath)) fs.unlinkSync(tempLocalOriginalPath);
            if (tempLocalThumbPath && fs.existsSync(tempLocalThumbPath)) fs.unlinkSync(tempLocalThumbPath);
        } catch (cleanupError) { console.error(`${funcName} Error cleaning temp files:`, cleanupError); }
    }
});


// --- Cloud Function: Upload Property Image ---
exports.uploadPropertyImage = onRequest({ cors: true, timeoutSeconds: 120, memory: "512MiB", invoker: 'public' }, (req, res) => {
    const funcName = '[uploadPropertyImage]';

    if (req.method !== 'POST') {
        console.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    const busboy = Busboy({ headers: req.headers });
    const tmpdir = os.tmpdir();
    const fields = {};
    const uploads = {};
    const fileWrites = [];

    busboy.on('field', (fieldname, val) => {
        console.log(`${funcName} Processed field ${fieldname}: ${val}.`);
        fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, file, fileinfo) => {
        const { filename, encoding, mimeType } = fileinfo;
        console.log(`${funcName} Processing file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
        const uniquePrefix = uuidv4();
        const uniqueFilename = `${uniquePrefix}_${filename}`; // Ensure unique temp name
        const filepath = path.join(tmpdir, uniqueFilename);
        uploads[fieldname] = { filepath, originalFilename: filename, mimeType };

        const writeStream = fs.createWriteStream(filepath);
        file.pipe(writeStream);

        const promise = new Promise((resolve, reject) => {
            file.on('end', () => { writeStream.end(); });
            writeStream.on('finish', () => {
                console.log(`${funcName} File ${filename} written to ${filepath}`);
                resolve();
            });
            writeStream.on('error', (err) => {
                console.error(`${funcName} Error writing file ${filename} to temp:`, err);
                reject(err);
            });
        });
        fileWrites.push(promise);
    });

    busboy.on('finish', async () => {
        console.log(`${funcName} Busboy finished parsing form.`);
        try {
            await Promise.all(fileWrites);
            console.log(`${funcName} All file writes complete. Fields:`, fields);
            console.log(`${funcName} Uploads metadata:`, uploads);

            const { roomId, category, labels } = fields;
            const imageFileField = 'imageFile';

            if (!roomId) throw new Error('Missing roomId field in form data.');
            if (!uploads[imageFileField] || !uploads[imageFileField].filepath) throw new Error('Missing imageFile or filepath in form data.');

            const { filepath: localFilePath, originalFilename, mimeType: detectedMimeType } = uploads[imageFileField];
            const fileExt = path.extname(originalFilename);
            const storageFilename = `${uuidv4()}${fileExt}`;
            const gcsPath = `rooms/${roomId}/${storageFilename}`;
            const targetBucket = storage.bucket(PRIMARY_PROJECT_BUCKET_NAME);

            console.log(`${funcName} Uploading ${localFilePath} to gs://${targetBucket.name}/${gcsPath}`);

            let uploadedFile;
            try {
                [uploadedFile] = await targetBucket.upload(localFilePath, {
                    destination: gcsPath,
                    metadata: { contentType: detectedMimeType || 'application/octet-stream', cacheControl: 'public, max-age=31536000' },
                });
                console.log(`${funcName} GCS Upload completed.`);
            } catch (uploadErr) {
                console.error(`${funcName} GCS Upload Failed:`, uploadErr);
                throw uploadErr;
            }

            try {
                await uploadedFile.makePublic();
                console.log(`${funcName} File made public.`);
            } catch (e) {
                console.error(`${funcName} Failed to make uploaded image public`, e);
            }

            const publicUrl = `https://storage.googleapis.com/${targetBucket.name}/${gcsPath}`;
            console.log(`${funcName} Public URL generated: ${publicUrl}`);

            let newImageObject;
            try {
                const roomRef = db.collection('rooms').doc(roomId);

                newImageObject = {
                    url: publicUrl,
                    category: category || null,
                    labels: labels ? labels.split(',').map(l => l.trim()).filter(l => l) : [],
                    isCover: false,
                    uploadedAt: new Date().toISOString()
                };

                await roomRef.set({
                    imageUrls: FieldValue.arrayUnion(newImageObject),
                    lastUpdated: FieldValue.serverTimestamp() // or Timestamp.now()
                }, { merge: true });

                console.log(`${funcName} Firestore updated successfully for ${roomId}.`);
            } catch (dbError) {
                console.error(`${funcName} *** FIRESTORE OPERATION FAILED ***`, dbError);
                throw dbError;
            }

            try { fs.unlinkSync(localFilePath); } catch (e) { console.warn(`${funcName} Failed to delete temp file ${localFilePath}`, e); }
            res.status(200).json({ status: 'success', message: 'Image uploaded successfully', newImage: newImageObject });

        } catch (error) {
            console.error(`${funcName} ***** ERROR IN UPLOAD LOGIC *****:`, error);

            // Try cleanup
            Object.values(uploads).forEach(uploadInfo => {
                if (uploadInfo.filepath) {
                    try {
                        if (fs.existsSync(uploadInfo.filepath)) fs.unlinkSync(uploadInfo.filepath);
                    } catch (e) {
                        console.error("Cleanup error:", e);
                    }
                }
            });

            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: `Upload failed: ${error.message}` });
            }
        }
    });

    busboy.on('error', (err) => {
        console.error(`${funcName} ***** BUSBOY PARSER ERROR *****:`, err);
        if (!res.headersSent) {
            res.status(500).send('Multipart parsing error');
        }
    });

    if (req.rawBody) {
        busboy.end(req.rawBody);
    } else {
        req.pipe(busboy);
    }
});


// --- Cloud Function: Sync Room Images (GCS <-> Firestore) ---
exports.syncRoomImages = onRequest({ cors: true, timeoutSeconds: 300, memory: "1GiB", invoker: 'public' }, async (req, res) => {
    const funcName = '[syncRoomImages]';

    const { roomId } = req.query; // Use query param for GET request ease
    if (!roomId) return res.status(400).send('Missing roomId query parameter.');

    console.log(`${funcName} Starting sync for room: ${roomId}`);

    try {
        const bucket = admin.storage().bucket(PRIMARY_PROJECT_BUCKET_NAME);
        const prefix = `rooms/${roomId}/`;

        // 1. List all files in GCS for this room
        const [files] = await bucket.getFiles({ prefix });
        console.log(`${funcName} Found ${files.length} files in GCS.`);

        // 2. Deduplicate by MD5 Hash
        const uniqueFiles = new Map(); // md5 -> fileObj
        const filesToDelete = [];

        for (const file of files) {
            // Skip non-image files if any (or folders)
            if (file.name.endsWith('/')) continue;

            const [metadata] = await file.getMetadata();
            const md5 = metadata.md5Hash;

            if (uniqueFiles.has(md5)) {
                // Duplicate found! Mark for deletion
                filesToDelete.push(file);
            } else {
                uniqueFiles.set(md5, {
                    file: file,
                    url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
                    name: file.name,
                    updated: metadata.updated
                });
            }
        }

        // 3. Delete duplicates from GCS
        const deletionResults = { success: 0, failed: 0, errors: [] };
        if (filesToDelete.length > 0) {
            console.log(`${funcName} Attempting to delete ${filesToDelete.length} duplicate files...`);

            // Process in chunks to avoid overwhelming API limits
            const DELETE_BATCH_SIZE = 10;
            for (let i = 0; i < filesToDelete.length; i += DELETE_BATCH_SIZE) {
                const chunk = filesToDelete.slice(i, i + DELETE_BATCH_SIZE);
                await Promise.all(chunk.map(async (f) => {
                    try {
                        await f.delete();
                        deletionResults.success++;
                    } catch (delErr) {
                        deletionResults.failed++;
                        deletionResults.errors.push({ file: f.name, error: delErr.message });
                        console.error(`${funcName} Failed to delete ${f.name}:`, delErr);
                    }
                }));
            }

            console.log(`${funcName} Deletion complete. Success: ${deletionResults.success}, Failed: ${deletionResults.failed}`);
        }

        // 4. Update Firestore
        const roomRef = db.collection('rooms').doc(roomId);
        await db.runTransaction(async (t) => {
            const doc = await t.get(roomRef);
            const currentData = doc.exists ? doc.data() : {};
            const currentImages = Array.isArray(currentData.imageUrls) ? currentData.imageUrls : [];

            const validUrls = new Set(Array.from(uniqueFiles.values()).map(f => f.url));
            const newImageUrls = [];
            const addedUrls = [];

            // Keep existing DB entries if they are still valid
            for (const img of currentImages) {
                if (validUrls.has(img.url)) {
                    newImageUrls.push(img);
                    validUrls.delete(img.url);
                }
            }

            // Add remaining (new) files from GCS
            for (const url of validUrls) {
                const newImg = {
                    url: url,
                    category: null,
                    labels: [],
                    isCover: false,
                    uploadedAt: new Date().toISOString()
                };
                newImageUrls.push(newImg);
                addedUrls.push(url);
            }

            t.set(roomRef, { imageUrls: newImageUrls }, { merge: true });
            console.log(`${funcName} Firestore updated. Total images: ${newImageUrls.length}. Added: ${addedUrls.length}`);
        });

        res.status(200).json({
            status: 'success',
            message: `Synced ${uniqueFiles.size} images. Deletion Stats: Success=${deletionResults.success}, Failed=${deletionResults.failed}.`,
            totalImages: uniqueFiles.size,
            stats: deletionResults,
            remainingUniqueFiles: Array.from(uniqueFiles.values()).map(f => f.name)
        });

    } catch (error) {
        console.error(`${funcName} Sync Failed:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// --- Cloud Function: Delete Property Image ---
exports.deletePropertyImage = onRequest({ cors: true, timeoutSeconds: 60, memory: "256MiB", invoker: 'public' }, async (req, res) => {
    const funcName = '[deletePropertyImage]';
    if (req.method !== 'POST') {
        console.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    const { roomId, imageUrlToDelete } = req.body;
    console.log(`${funcName} Request received:`, { roomId, imageUrlToDelete: imageUrlToDelete ? '*** URL Present ***' : '!!! URL MISSING !!!' });
    if (!roomId || !imageUrlToDelete) {
        return res.status(400).json({ status: 'error', message: 'Missing required parameters: roomId, imageUrlToDelete' });
    }

    const roomRef = db.collection('rooms').doc(roomId);
    let wasCover = false;
    let thumbnailGcsPathToDelete = null;

    try {
        const parsedUrl = getBucketAndPath(imageUrlToDelete);
        if (!parsedUrl) throw new Error(`Could not parse GCS URL for deletion: ${imageUrlToDelete}`);
        const { bucketName, filePath } = parsedUrl;
        const bucket = storage.bucket(bucketName);
        const fileToDelete = bucket.file(filePath);

        console.log(`${funcName} Deleting GCS file: gs://${bucketName}/${filePath}`);
        try {
            await fileToDelete.delete();
            console.log(`${funcName} GCS file deleted successfully.`);
            thumbnailGcsPathToDelete = `${path.dirname(filePath)}/${path.parse(filePath).name}_thumb_300.webp`;
        } catch (storageError) {
            if (storageError.code === 404) {
                console.warn(`${funcName} GCS file already deleted or not found: gs://${bucketName}/${filePath}. Proceeding.`);
                thumbnailGcsPathToDelete = `${path.dirname(filePath)}/${path.parse(filePath).name}_thumb_300.webp`; // Still try to delete thumb
            } else {
                throw new Error(`Failed to delete image from Storage: ${storageError.message}`);
            }
        }

        if (thumbnailGcsPathToDelete) {
            console.log(`${funcName} Attempting to delete GCS thumbnail: gs://${bucketName}/${thumbnailGcsPathToDelete}`);
            try {
                await bucket.file(thumbnailGcsPathToDelete).delete();
                console.log(`${funcName} GCS thumbnail deleted successfully.`);
            } catch (thumbError) {
                if (thumbError.code === 404) console.warn(`${funcName} GCS thumbnail not found.`);
                else console.error(`${funcName} Failed to delete thumbnail from Storage:`, thumbError);
            }
        }

        console.log(`${funcName} Updating Firestore for room ${roomId} to remove image URL...`);
        const roomDoc = await roomRef.get(); // Get latest doc for accurate imageUrls array
        if (!roomDoc.exists) {
            console.warn(`${funcName} Room ${roomId} not found in Firestore, cannot remove image URL.`);
            return res.status(200).json({ status: 'success', message: 'Image deleted from storage; room not found in DB.' });
        }

        let currentImageUrls = roomDoc.data().imageUrls;
        if (!Array.isArray(currentImageUrls)) currentImageUrls = [];

        // Find the exact object to remove to correctly use arrayRemove
        const imageObjectToRemove = currentImageUrls.find(img => img && img.url === imageUrlToDelete);

        if (!imageObjectToRemove) {
            console.warn(`${funcName} Image URL not found in Firestore array for room ${roomId}. Assuming already removed.`);
        } else {
            if (imageObjectToRemove.isCover) wasCover = true;
            await roomRef.update({ imageUrls: admin.firestore.FieldValue.arrayRemove(imageObjectToRemove) });
            console.log(`${funcName} Firestore imageUrls array updated.`);
        }

        if (wasCover) {
            console.log(`${funcName} Deleted image was cover. Clearing thumbnailImageUrl.`);
            await roomRef.update({ thumbnailImageUrl: admin.firestore.FieldValue.delete() });
        }

        console.log(`${funcName} Firestore update successful for room ${roomId}.`);
        res.status(200).json({ status: 'success', message: 'Image deleted successfully.' });

    } catch (error) {
        console.error(`${funcName} Operation FAILED for room ${roomId}:`, error);
        res.status(500).json({ status: 'error', message: `Delete failed: ${error.message}` });
    }
});


// --- Cloud Function: Generate AI Listing Content ---
exports.generateListingContent = onRequest({ cors: true, timeoutSeconds: 300, memory: "1GiB", invoker: 'public' }, async (req, res) => {
    const funcName = '[generateListingContent]';

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { roomId, destinationName } = req.body;
    console.log(`${funcName} Request received for room: ${roomId}, Destination: ${destinationName}`);

    if (!roomId) {
        return res.status(400).json({ status: 'error', message: 'Missing required parameter: roomId' });
    }

    try {
        // 1. Fetch Room Images from Firestore
        const roomRef = db.collection('rooms').doc(roomId);
        const roomDoc = await roomRef.get();
        if (!roomDoc.exists) throw new Error(`Room document ${roomId} not found.`);

        const roomData = roomDoc.data();
        let imageUrls = roomData.imageUrls || [];

        // Filter valid images and take up to 5 for analysis
        const analysisImages = imageUrls
            .filter(img => img.url && typeof img.url === 'string')
            .slice(0, 5)
            .map(img => img.url);

        if (analysisImages.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No images found for this room.' });
        }

        // 2. Initialize Vertex AI
        const { VertexAI } = require('@google-cloud/vertexai');
        const vertex_ai = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: 'us-central1' });
        const model = vertex_ai.preview.getGenerativeModel({
            model: 'gemini-1.5-pro-vision-001',
            generationConfig: {
                'maxOutputTokens': 2048,
                'temperature': 0.4,
                'topP': 0.8,
                'topK': 40
            }
        });

        // 3. Prepare Prompt
        let locationContext = "";
        if (destinationName) {
            locationContext = `The property is located in ${destinationName}. Ensure the description highlights the appeal of this specific location.`;
        }

        if (destinationName === 'De Waterkant' || destinationName === 'The Quarter') {
            locationContext = `Located in the Quarter, in the trendy De Waterkant suburb, near the Waterfront, Cape Town city and Lions Head mountain.`;
        }

        const prompt = `
            Analyze these images of a vacation rental property.
            Task:
            1. Generate a short, attractive Title (MAX 50 CHARACTERS). It must be punchy.
            2. Write a captivating marketing description (approx 500 characters). ${locationContext}
            3. List up to 10 strictly VISIBLE amenities found in the photos (e.g., 'Pool', 'Balcony', 'Coffee Machine'). Do NOT guess invisible items like Wifi.
            
            Return the response in valid JSON format:
            {
                "title": "...",
                "description": "...",
                "amenities": ["..."]
            }
        `;

        // 4. Prepare Image Parts
        const imageParts = await Promise.all(analysisImages.map(async (url) => {
            try {
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                return {
                    inlineData: {
                        data: Buffer.from(buffer).toString('base64'),
                        mimeType: 'image/jpeg'
                    }
                };
            } catch (e) {
                console.warn(`Failed to fetch image for AI: ${url}`, e);
                return null;
            }
        }));

        const validImageParts = imageParts.filter(p => p !== null);

        // 5. Call Gemini
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }, ...validImageParts] }],
        });
        const responseText = result.response.candidates[0].content.parts[0].text;
        console.log("AI Response:", responseText);

        // 6. Parse JSON
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const metadata = JSON.parse(cleanJson);

        res.status(200).json({ status: 'success', data: metadata });

    } catch (error) {
        console.error(`${funcName} AI Generation Failed:`, error);
        res.status(500).json({ status: 'error', message: `AI processing failed: ${error.message}` });
    }
});


// --- Cloud Function: Rotate Property Image ---
exports.rotateImage = onRequest({ cors: true, timeoutSeconds: 120, memory: "1GiB", invoker: 'public' }, async (req, res) => {
    const funcName = '[rotateImage]';

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { roomId, imageUrl, angle = 90 } = req.body;

    if (!roomId || !imageUrl) {
        return res.status(400).json({ status: 'error', message: 'Missing roomId or imageUrl' });
    }

    console.log(`${funcName} Request for room ${roomId}, rotate ${angle} deg. URL: ${imageUrl}`);

    let tempLocalPath = null;
    let tempLocalDest = null;

    try {
        // 1. Identify File
        const parsed = getBucketAndPath(imageUrl);
        if (!parsed) throw new Error('Invalid GCS URL');

        const { bucketName, filePath } = parsed;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filePath);

        // 2. Download
        const uniqueId = uuidv4();
        tempLocalPath = path.join(os.tmpdir(), `${uniqueId}_original`);
        tempLocalDest = path.join(os.tmpdir(), `${uniqueId}_rotated.webp`);

        await file.download({ destination: tempLocalPath });

        // 3. Rotate
        // Convert to webp for consistency/size if desired, or keep original format.
        // Let's stick to simple rotation and outputting as webp to standardized.
        await sharp(tempLocalPath)
            .rotate(angle)
            .toFile(tempLocalDest);

        // 4. Upload as NEW file (to bust cache)
        const fileExt = path.extname(filePath);
        const nameWithoutExt = path.parse(filePath).name;
        // append timestamp or random
        const newFileName = `${nameWithoutExt}_r${Date.now()}.webp`;
        const newFilePath = `${path.dirname(filePath)}/${newFileName}`;

        const [uploadedFile] = await bucket.upload(tempLocalDest, {
            destination: newFilePath,
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
        });

        await uploadedFile.makePublic();
        const newUrl = `https://storage.googleapis.com/${bucketName}/${newFilePath}`;

        // 5. Update Firestore
        const roomRef = db.collection('rooms').doc(roomId);
        await db.runTransaction(async (t) => {
            const doc = await t.get(roomRef);
            if (!doc.exists) throw new Error('Room not found');
            const data = doc.data();
            const images = data.imageUrls || [];

            // Find and replace
            const idx = images.findIndex(img => img.url === imageUrl);
            if (idx === -1) {
                // If not found (maybe changed in interim), just append? No, dangerous.
                // Just warn and append if we want, or fail.
                // Better: assume it's a new image.
                console.warn(`${funcName} Original URL not found in DB. Appending new one.`);
                images.push({
                    url: newUrl,
                    category: null,
                    isCover: false, // Assume not cover if missing
                    uploadedAt: new Date().toISOString()
                });
            } else {
                // Update existing object
                images[idx].url = newUrl;
                images[idx].uploadedAt = new Date().toISOString();
            }

            t.update(roomRef, { imageUrls: images });
        });

        // 6. Cleanup OLD file (Optional, but good for hygiene)
        try {
            await file.delete();
        } catch (e) {
            console.warn(`${funcName} Failed to delete old file: ${filePath}`, e);
        }

        res.status(200).json({
            status: 'success',
            message: 'Image rotated',
            newUrl: newUrl
        });

    } catch (error) {
        console.error(`${funcName} Failed:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        try {
            if (tempLocalPath && fs.existsSync(tempLocalPath)) fs.unlinkSync(tempLocalPath);
            if (tempLocalDest && fs.existsSync(tempLocalDest)) fs.unlinkSync(tempLocalDest);
        } catch (e) { console.error('Cleanup error', e); }
    }
});