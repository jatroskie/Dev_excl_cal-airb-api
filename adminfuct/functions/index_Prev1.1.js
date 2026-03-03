// adminfuct/functions/index.js

// --- Core Requires ---
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage'); // For Storage access
const sharp = require('sharp');                     // Image processing
const path = require('path');                       // Built-in for paths
const os = require('os');                           // Built-in for temp directory
const fs = require('fs');                           // Built-in for file system access
const { v4: uuidv4 } = require('uuid');             // For unique IDs

// --- Initialize Admin SDK ---
// IMPORTANT: Ensure serviceAccountKey.json is in the correct location relative to this file
// If index.js is in functions/ and key is in adminfuct/, use '../serviceAccountKey.json'
// If index.js is in functions/ and key is in functions/, use './serviceAccountKey.json'
try {
    const serviceAccount = require('./service-account-key.json'); // Assuming key file is in the *same* directory as index.js
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Admin SDK initialized successfully.");
} catch (e) {
    console.error("FATAL ERROR initializing Firebase Admin SDK. Check path/validity of serviceAccountKey.json.", e);
    // Throwing error here prevents function deployment if SDK fails to init
    throw new Error("Admin SDK Initialization Failed.");
}

// --- Firestore & Storage Instances ---
// These will interact with the Firebase project associated with the service account key
const db = admin.firestore();
const storage = new Storage(); // Initialize storage client

// --- Helper Function: Parse GCS URL ---
function getBucketAndPath(gcsUrl) {
    try {
        const url = new URL(gcsUrl);
        if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
            const parts = url.pathname.split('/');
            const bucketName = parts[1];
            const filePath = parts.slice(2).join('/');
            if (!bucketName || !filePath) throw new Error('Invalid GCS URL format');
            return { bucketName, filePath };
        } else if (url.hostname === 'firebasestorage.googleapis.com') {
            const pathSegments = url.pathname.split('/o/');
            if (pathSegments.length > 1) {
                const bucketName = url.pathname.split('/b/')[1].split('/o/')[0];
                const encodedPath = pathSegments[1].split('?')[0];
                const filePath = decodeURIComponent(encodedPath);
                if (!bucketName || !filePath) throw new Error('Invalid Firebase Storage URL format');
                return { bucketName, filePath };
            }
        }
        throw new Error('Unsupported GCS URL hostname');
    } catch (e) {
        functions.logger.error("Error parsing GCS URL:", gcsUrl, e);
        return null;
    }
}


// --- Cloud Function: Set Cover Image & Generate Thumbnail ---
// Exported directly (not using Express 'app')
exports.setCoverImageAndGenerateThumbnail = functions.https.onRequest(async (req, res) => {
    // Define function name locally for logging context
    const funcName = '[setCoverImageAndGenerateThumbnail]';

    // --- CORS Preflight Handling & Headers ---
    // Set CORS headers for all responses
    res.set('Access-Control-Allow-Origin', '*'); // Consider restricting in production
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow common headers
    res.set('Access-Control-Max-Age', '3600');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        functions.logger.info(`${funcName} Responding to OPTIONS preflight request.`);
        res.status(204).send(''); // Send 'No Content' for preflight success
        return;
    }

    // --- Method Check ---
    if (req.method !== 'POST') {
        functions.logger.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    // --- Extract Data ---
    const { roomId, selectedImageUrl } = req.body;
    functions.logger.info(`${funcName} POST Request received:`, { roomId, selectedImageUrl: selectedImageUrl ? '*** URL Present ***' : '!!! URL MISSING !!!' }); // Log received data (hide full URL for brevity/security)

    if (!roomId || !selectedImageUrl) {
        functions.logger.error(`${funcName} Missing roomId or selectedImageUrl in request body.`);
        return res.status(400).json({ status: 'error', message: 'Missing required parameters: roomId, selectedImageUrl' });
    }

    // --- Firestore Reference ---
    const roomRef = db.collection('rooms').doc(roomId);

    // --- Temporary File Paths ---
    // Declare these outside the transaction but ensure they are unique per invocation
    let tempFilePath = null;
    let tempThumbPath = null;

    try {
        let thumbnailUrl = null; // Variable to store the final thumbnail URL

        // --- Firestore Transaction ---
        await db.runTransaction(async (transaction) => {
            functions.logger.info(`${funcName} Starting Firestore transaction for room ${roomId}.`);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) {
                throw new Error(`Room document ${roomId} not found.`);
            }

            const roomData = roomDoc.data();
            const imageUrls = roomData.imageUrls;

            if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
                throw new Error(`Room ${roomId} has no valid imageUrls array.`);
            }

            // --- 1. Update isCover flags ---
            let foundSelected = false;
            let originalCoverUrl = null; // Store the URL we actually match
            const updatedImageUrls = imageUrls.map(img => {
                // Be more robust checking img.url
                const currentUrl = img && typeof img.url === 'string' ? img.url : '';
                const isSelected = currentUrl === selectedImageUrl;
                if (isSelected) {
                    foundSelected = true;
                    originalCoverUrl = currentUrl;
                }
                // Return a new object to avoid potential side effects if img object is reused
                return { ...img, isCover: isSelected };
            });

             // Fallback check if exact match failed (e.g., encoding differences)
            if (!foundSelected) {
                 const selectedIndex = imageUrls.findIndex(img => img && typeof img.url === 'string' && (img.url.includes(selectedImageUrl) || selectedImageUrl.includes(img.url)) );
                 if (selectedIndex !== -1) {
                     functions.logger.warn(`${funcName} Exact URL match failed, using index ${selectedIndex} based on partial match for ${roomId}`);
                     updatedImageUrls.forEach((img, index) => { img.isCover = (index === selectedIndex); });
                     foundSelected = true;
                     originalCoverUrl = imageUrls[selectedIndex].url; // Get the URL from the original array
                 } else {
                     throw new Error(`Selected image URL not found in room ${roomId} imageUrls.`);
                 }
            }

            if (!originalCoverUrl) {
                 throw new Error(`Could not determine the original URL for the selected cover image.`);
            }

            // --- 2. Generate Thumbnail ---
            functions.logger.info(`${funcName} Starting thumbnail generation for: ${originalCoverUrl}`);

            const parsedUrl = getBucketAndPath(originalCoverUrl); // Use the confirmed original URL
            if (!parsedUrl) {
                throw new Error(`Could not parse bucket/path from URL: ${originalCoverUrl}`);
            }
            const { bucketName, filePath } = parsedUrl;
            const bucket = storage.bucket(bucketName);
            const originalFile = bucket.file(filePath);

            // Define temporary file paths within the transaction scope if needed, or rely on outer scope ones
            const uniquePrefix = uuidv4();
            const baseFileName = path.basename(filePath);
            tempFilePath = path.join(os.tmpdir(), `${uniquePrefix}_${baseFileName}`);
            const thumbFileName = `${path.parse(filePath).name}_thumb_300.webp`;
            const thumbFilePath = `${path.dirname(filePath)}/${thumbFileName}`; // GCS path
            tempThumbPath = path.join(os.tmpdir(), `${uniquePrefix}_thumb_${baseFileName}.webp`); // Local temp path

            functions.logger.info(`${funcName} Downloading original to: ${tempFilePath}`);
            await originalFile.download({ destination: tempFilePath });
            functions.logger.info(`${funcName} Download complete. Resizing...`);

            await sharp(tempFilePath)
                .resize(300)
                .webp({ quality: 80 })
                .toFile(tempThumbPath);

            functions.logger.info(`${funcName} Resizing complete. Uploading thumbnail to GCS path: ${thumbFilePath}`);

            const [uploadedFile] = await bucket.upload(tempThumbPath, {
                destination: thumbFilePath,
                metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' },
            });

            // Attempt to make public - Adjust based on your bucket's public access settings
            try {
                await uploadedFile.makePublic();
                functions.logger.info(`${funcName} Thumbnail ${thumbFilePath} made public.`);
            } catch (publicError) {
                 functions.logger.error(`${funcName} Failed to make thumbnail public. Signed URLs or bucket policy adjustment needed?`, publicError);
                 // Decide if this is critical. For now, we proceed.
            }

            // --- 3. Get Public URL ---
            thumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbFilePath}`; // Assign the final URL
            functions.logger.info(`${funcName} Generated Thumbnail URL: ${thumbnailUrl}`);

            // --- 4. Update Firestore Document within Transaction ---
            functions.logger.info(`${funcName} Updating Firestore document ${roomId} within transaction...`);
            transaction.update(roomRef, {
                imageUrls: updatedImageUrls,      // Save array with updated isCover flags
                thumbnailImageUrl: thumbnailUrl   // Save the new thumbnail URL
            });
            functions.logger.info(`${funcName} Firestore transaction update prepared.`);

        }); // End Firestore Transaction

        functions.logger.info(`${funcName} Transaction successful for room ${roomId}.`);
        // CORS headers were already set
        res.status(200).json({ status: 'success', message: 'Cover image set and thumbnail generated.', thumbnailUrl: thumbnailUrl });

    } catch (error) {
        functions.logger.error(`${funcName} Operation Failed for room ${roomId}:`, { message: error.message, stack: error.stack });
        // CORS headers were already set
        res.status(500).json({ status: 'error', message: `Operation failed: ${error.message}` });
    } finally {
         // --- Clean up temporary files AFTER transaction ---
         try {
             if (tempFilePath && fs.existsSync(tempFilePath)) {
                 fs.unlinkSync(tempFilePath);
                 functions.logger.info(`${funcName} Cleaned up temporary file: ${tempFilePath}`);
             }
             if (tempThumbPath && fs.existsSync(tempThumbPath)) {
                 fs.unlinkSync(tempThumbPath);
                 functions.logger.info(`${funcName} Cleaned up temporary thumbnail: ${tempThumbPath}`);
             }
         } catch (cleanupError) {
             functions.logger.error(`${funcName} Error cleaning up temporary files:`, cleanupError);
         }
    }
}); // End of functions.https.onRequest

// --- NO other exports in this file if it's just for this function ---