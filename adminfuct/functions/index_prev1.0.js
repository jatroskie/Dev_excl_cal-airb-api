const functions = require('firebase-functions');
const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage'); // For Storage access
//const storage = new Storage();   // Initialize storage client
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
// --- ADD EXPRESS SETUP ---
const express = require('express');
//const cors = require('cors');
//const app = express();

// --- Use Middleware (Optional but Recommended) ---
// Automatically allow cross-origin requests
//app.use(cors({ origin: true }));
// Automatically parse JSON request bodies
//app.use(express.json());
// ------------------------

// --- Initialize Admin SDK ---
try {
    const serviceAccount = require('./service-account-key.json'); // Adjust path if needed
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Admin SDK initialized...");
} catch (e) {
    console.error("FATAL ERROR initializing Admin SDK:", e);
    throw new Error("Admin SDK Initialization Failed.");
}
const db = admin.firestore();
const storage = new Storage();
// ---------------------------


// --- Cloud Function to Set Cover & Generate Thumbnail ---
// Use onCall for easier authentication/data passing from web app if using Firebase Auth
// Using onRequest for simpler testing here
exports.setCoverImageAndGenerateThumbnail = functions.https.onRequest(async (req, res) => {
    // Enable CORS for testing from local admin app if needed
     // Consider more restrictive CORS for production
    res.set('Access-Control-Allow-Origin', '*'); // Allow requests from any origin (adjust for production)
res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST'); // Allow POST and standard methods
res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow necessary headers
res.set('Access-Control-Max-Age', '3600'); // Cache preflight response for 1 hour




     if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
     //   res.set('Access-Control-Allow-Methods', 'POST');
     //   res.set('Access-Control-Allow-Headers', 'Content-Type');
     //   res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }


    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { roomId, selectedImageUrl } = req.body;
    const funcName = '[setCoverImage]';
    functions.logger.info(`${funcName} Request received:`, { roomId, selectedImageUrl });

    if (!roomId || !selectedImageUrl) {
        functions.logger.error("Missing roomId or selectedImageUrl in request body");
        res.status(400).json({ status: 'error', message: 'Missing roomId or selectedImageUrl' });
        return;
    }

    const funcName = '[setCoverImage]';
    functions.logger.info(`${funcName} Request received:`, { roomId, selectedImageUrl });

    const roomRef = db.collection('rooms').doc(roomId);

    try {
        await db.runTransaction(async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) {
                throw new Error(`Room document ${roomId} not found.`);
            }

            const roomData = roomDoc.data();
            const imageUrls = roomData.imageUrls;

            if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
                throw new Error(`Room ${roomId} has no imageUrls array.`);
            }

            // --- 1. Update isCover flags ---
            let foundSelected = false;
            const updatedImageUrls = imageUrls.map(img => {
                const isSelected = img.url === selectedImageUrl;
                if (isSelected) foundSelected = true;
                return { ...img, isCover: isSelected }; // Set isCover based on selection
            });

            if (!foundSelected) {
                 // If the exact URL wasn't found (maybe due to encoding?), try finding by basic match
                 const selectedIndex = imageUrls.findIndex(img => img.url?.includes(selectedImageUrl) || selectedImageUrl?.includes(img.url) );
                 if (selectedIndex !== -1) {
                     functions.logger.warn(`${funcName} Exact URL match failed, using index ${selectedIndex} based on partial match for ${roomId}`);
                     updatedImageUrls.forEach((img, index) => { img.isCover = (index === selectedIndex); });
                     foundSelected = true;
                 } else {
                    throw new Error(`Selected image URL ${selectedImageUrl} not found in room ${roomId} imageUrls.`);
                 }
            }


            // --- 2. Generate Thumbnail ---
            functions.logger.info(`${funcName} Starting thumbnail generation for: ${selectedImageUrl}`);

            const parsedUrl = getBucketAndPath(selectedImageUrl);
            if (!parsedUrl) {
                throw new Error(`Could not parse bucket/path from selected image URL: ${selectedImageUrl}`);
            }
            const { bucketName, filePath } = parsedUrl;
            const bucket = storage.bucket(bucketName);
            const originalFile = bucket.file(filePath);

            const tempFileName = `${uuidv4()}_${path.basename(filePath)}`;
            const tempFilePath = path.join(os.tmpdir(), tempFileName);
            const thumbFileName = `${path.parse(filePath).name}_thumb_300.webp`; // Create WebP thumbnail name
            const thumbFilePath = `${path.dirname(filePath)}/${thumbFileName}`; // Store in same "folder"

            functions.logger.info(`${funcName} Downloading original to: ${tempFilePath}`);
            await originalFile.download({ destination: tempFilePath });
            functions.logger.info(`${funcName} Download complete. Resizing...`);

            const tempThumbPath = path.join(os.tmpdir(), `thumb_${tempFileName}`); // Temp path for resized file

             await sharp(tempFilePath)
                 .resize(300) // Resize to 300px wide, maintaining aspect ratio
                 .webp({ quality: 80 }) // Convert to WebP with quality 80
                 .toFile(tempThumbPath); // Save resized temp file

             functions.logger.info(`${funcName} Resizing complete. Uploading thumbnail to: ${thumbFilePath}`);

            // Upload the thumbnail
            const [uploadedFile] = await bucket.upload(tempThumbPath, {
                 destination: thumbFilePath,
                 metadata: {
                     contentType: 'image/webp', // Set correct content type
                     cacheControl: 'public, max-age=31536000', // Set cache policy
                 },
                 // Make the object publicly readable - adjust permissions as needed
                 // Using predefinedAcl: 'publicRead' might be simpler if bucket allows
                 // Or manage permissions via IAM/signed URLs
                 // For simplicity here, assuming public read needed by client:
                 // predefinedAcl: 'publicRead', // Uncomment carefully - makes file public
             });

              // Make the uploaded file public (alternative to predefinedAcl) - REMOVE IF NOT NEEDED
               try {
                   await uploadedFile.makePublic();
                   functions.logger.info(`${funcName} Thumbnail ${thumbFilePath} made public.`);
               } catch (publicError) {
                    functions.logger.error(`${funcName} Failed to make thumbnail public. Manual action may be required.`, publicError);
                    // Decide if this is a fatal error - maybe not if signed URLs are used client-side
               }

             // Clean up temporary files
             fs.unlinkSync(tempFilePath);
             fs.unlinkSync(tempThumbPath);
             functions.logger.info(`${funcName} Temporary files deleted.`);

            // --- 3. Get Public URL ---
             // Construct the public URL - this format might vary slightly based on bucket setup
             // Simple public URL format:
             const thumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbFilePath}`;
             // Alternative for Firebase Storage (if default bucket):
             // const thumbnailUrl = uploadedFile.publicUrl(); // Sometimes works directly

             functions.logger.info(`${funcName} Generated Thumbnail URL: ${thumbnailUrl}`);


            // --- 4. Update Firestore Document ---
            functions.logger.info(`${funcName} Updating Firestore document ${roomId}...`);
            transaction.update(roomRef, {
                imageUrls: updatedImageUrls,      // Save array with updated isCover flags
                thumbnailImageUrl: thumbnailUrl   // Save the new thumbnail URL
            });
             functions.logger.info(`${funcName} Firestore transaction update prepared.`);
        });

        functions.logger.info(`${funcName} Transaction successful for room ${roomId}.`);
        res.status(200).json({ status: 'success', message: 'Cover image set and thumbnail generated.' });

    } catch (error) {
        functions.logger.error(`${funcName} Failed for room ${roomId}:`, { message: error.message, stack: error.stack });
        res.status(500).json({ status: 'error', message: `Operation failed: ${error.message}` });
    }
});

// --- Helper to extract bucket/path from GCS URL, used by setCoverImageAndGenerateThumbnail ---
function getBucketAndPath(gcsUrl) {
    try {
        const url = new URL(gcsUrl);
        // Standard format: https://storage.googleapis.com/BUCKET_NAME/PATH/TO/OBJECT
        if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
            const parts = url.pathname.split('/');
            const bucketName = parts[1];
            const filePath = parts.slice(2).join('/');
            if (!bucketName || !filePath) throw new Error('Invalid GCS URL format');
            return { bucketName, filePath };
        }
        // Add other potential formats if needed (e.g., firebasestorage.googleapis.com)
         else if (url.hostname === 'firebasestorage.googleapis.com') {
             // Format: https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/PATH%2FTO%2FOBJECT?alt=media...
             const pathSegments = url.pathname.split('/o/');
             if (pathSegments.length > 1) {
                 const bucketName = url.pathname.split('/b/')[1].split('/o/')[0];
                 const encodedPath = pathSegments[1].split('?')[0]; // Get path before query params
                 const filePath = decodeURIComponent(encodedPath); // Decode URL encoding
                 if (!bucketName || !filePath) throw new Error('Invalid Firebase Storage URL format');
                 return { bucketName, filePath };
             }
         }

    } catch (e) {
        functions.logger.error("Error parsing GCS URL:", gcsUrl, e);
        return null;
    }
    functions.logger.warn("Could not parse non-standard GCS URL:", gcsUrl);
    return null; // Or handle other URL formats if necessary
}
