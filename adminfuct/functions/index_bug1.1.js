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
const Busboy = require('busboy'); // <-- Add Busboy
const {onRequest} = require("firebase-functions/v2/https");

// --- Initialize Admin SDK ---
// IMPORTANT: Ensure serviceAccountKey.json is in the correct location relative to this file
// If index.js is in functions/ and key is in adminfuct/, use '../serviceAccountKey.json'
// If index.js is in functions/ and key is in functions/, use './serviceAccountKey.json'
try {
    // Assuming serviceAccountKey.json is in the SAME directory as this index.js
    const serviceAccount = require('./service-account-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Admin SDK initialized successfully for adminfuct.");
} catch (e) {
    console.error("FATAL ERROR initializing Firebase Admin SDK in adminfuct. Check path/validity of serviceAccountKey.json.", e);
    // Throwing error here prevents function deployment if SDK fails to init
    throw new Error("Admin SDK Initialization Failed in adminfuct.");
}

// --- Firestore & Storage Instances ---
// These will interact with the Firebase project associated with the service account key
const db = admin.firestore();
const storage = new Storage(); // Initialize storage client

// --- Helper Function: Parse GCS URL ---
function getBucketAndPath(gcsUrl) {
    const funcName = '[getBucketAndPath]'; // Local context for logging
    try {
        const url = new URL(gcsUrl); // Throws if gcsUrl is not a valid URL string

        if (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com')) {
            // Standard format: https://storage.googleapis.com/BUCKET_NAME/PATH/TO/OBJECT
            const parts = url.pathname.split('/');
            if (parts.length < 3 || !parts[1]) { // Need at least /bucketname/objectpath
                throw new Error('Invalid GCS URL path structure for storage.googleapis.com');
            }
            const bucketName = parts[1];
            const filePath = parts.slice(2).join('/');
            if (!filePath) throw new Error('File path is empty in GCS URL');
            return { bucketName, filePath };
        } else if (url.hostname === 'firebasestorage.googleapis.com') {
            // Firebase Storage URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/PATH%2FTO%2FOBJECT?alt=media...
            const pathSegments = url.pathname.split('/o/');
            if (pathSegments.length > 1) {
                const bucketNameSegment = url.pathname.split('/b/')[1];
                if (!bucketNameSegment) throw new Error('Bucket name segment not found in Firebase Storage URL');
                const bucketName = bucketNameSegment.split('/o/')[0];

                const encodedPathWithQuery = pathSegments[1];
                const encodedPath = encodedPathWithQuery.split('?')[0]; // Get path before query params
                const filePath = decodeURIComponent(encodedPath); // Decode URL encoding (e.g., %2F to /)
                if (!bucketName || !filePath) throw new Error('Invalid Firebase Storage URL format after parsing');
                return { bucketName, filePath };
            }
             throw new Error('Path segment /o/ not found in Firebase Storage URL');
        }
        throw new Error(`Unsupported GCS URL hostname: ${url.hostname}`);
    } catch (e) {
        functions.logger.error(`${funcName} Error parsing GCS URL:`, { url: gcsUrl, error: e.message, stack: e.stack });
        return null; // Return null on parsing failure
    }
}

// --- Cloud Function: Set Cover Image & Generate Thumbnail ---
exports.setCoverImageAndGenerateThumbnail = functions.region('us-central1') // Specify region if needed
    .runWith({
        timeoutSeconds: 120, // Increase timeout if image processing takes longer
        memory: '512MB'      // Increase memory if sharp needs more (e.g., '1GB')
    })
    .https.onRequest(async (req, res) => {
    // Define function name locally for logging context
    const funcName = '[setCoverImageAndGenerateThumbnail]';

    // --- CORS Preflight Handling & Headers ---
    res.set('Access-Control-Allow-Origin', '*'); // For testing. Restrict in production!
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        functions.logger.info(`${funcName} Responding to OPTIONS preflight request.`);
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        functions.logger.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    // --- Extract Data from Request Body ---
    const { roomId, selectedImageUrl } = req.body;
    functions.logger.info(`${funcName} POST request received for room: ${roomId}`, { selectedImageUrl: selectedImageUrl ? '*** URL Present ***' : '!!! URL MISSING !!!' });

    if (!roomId || !selectedImageUrl) {
        functions.logger.error(`${funcName} Missing roomId or selectedImageUrl in request body.`);
        return res.status(400).json({ status: 'error', message: 'Missing required parameters: roomId, selectedImageUrl' });
    }

    const roomRef = db.collection('rooms').doc(roomId);
    let tempLocalOriginalPath = null;
    let tempLocalThumbPath = null;
    let finalThumbnailUrl = null;

    try {
        await db.runTransaction(async (transaction) => {
            functions.logger.info(`${funcName} Starting Firestore transaction for room ${roomId}.`);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) {
                throw new Error(`Room document ${roomId} not found.`);
            }

            const roomData = roomDoc.data();
            let imageUrls = roomData.imageUrls; // Keep mutable if you intend to modify the original array's objects

            if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
                throw new Error(`Room ${roomId} has no valid imageUrls array or is empty.`);
            }

            // --- 1. Update isCover flags ---
            let foundSelected = false;
            let actualSelectedUrl = null; // The URL we'll use for processing
            const updatedImageUrls = imageUrls.map(img => {
                const currentImgUrl = img && typeof img.url === 'string' ? img.url : null;
                const isSelected = currentImgUrl === selectedImageUrl;
                if (isSelected) {
                    foundSelected = true;
                    actualSelectedUrl = currentImgUrl;
                }
                // Create new objects to avoid modifying the original array in place if it's cached
                return { ...img, isCover: isSelected };
            });

            if (!foundSelected) { // Fallback if exact match failed
                 const selectedIndex = imageUrls.findIndex(img => img && typeof img.url === 'string' && (img.url.includes(selectedImageUrl) || selectedImageUrl.includes(img.url)) );
                 if (selectedIndex !== -1) {
                     functions.logger.warn(`${funcName} Exact URL match failed for selectedImageUrl, using index ${selectedIndex} based on partial match for room ${roomId}`);
                     updatedImageUrls.forEach((img, index) => { img.isCover = (index === selectedIndex); });
                     foundSelected = true;
                     actualSelectedUrl = imageUrls[selectedIndex].url;
                 } else {
                    throw new Error(`Selected image URL '${selectedImageUrl}' not found in room ${roomId} imageUrls after partial match attempt.`);
                 }
            }
            if (!actualSelectedUrl) { throw new Error('Could not determine the actual selected URL for processing.'); }


            // --- 2. Generate Thumbnail ---
            functions.logger.info(`${funcName} Starting thumbnail generation for: ${actualSelectedUrl}`);

            const parsedGcsUrl = getBucketAndPath(actualSelectedUrl);
            if (!parsedGcsUrl) {
                throw new Error(`Could not parse bucket/path from selected image URL: ${actualSelectedUrl}`);
            }
            const { bucketName, filePath: originalGcsFilePath } = parsedGcsUrl;
            const bucket = storage.bucket(bucketName);
            const originalFile = bucket.file(originalGcsFilePath);

            const uniqueId = uuidv4();
            const originalBaseName = path.basename(originalGcsFilePath);
            tempLocalOriginalPath = path.join(os.tmpdir(), `${uniqueId}_${originalBaseName}`);

            const thumbnailFileName = `${path.parse(originalGcsFilePath).name}_thumb_300.webp`;
            const thumbnailGcsPath = `${path.dirname(originalGcsFilePath)}/${thumbnailFileName}`;
            tempLocalThumbPath = path.join(os.tmpdir(), `${uniqueId}_thumb_${path.parse(originalBaseName).name}.webp`);

            functions.logger.info(`${funcName} Downloading original GCS file '${originalGcsFilePath}' to local temp: ${tempLocalOriginalPath}`);
            await originalFile.download({ destination: tempLocalOriginalPath });
            functions.logger.info(`${funcName} Download complete. Resizing image...`);

            await sharp(tempLocalOriginalPath)
                .resize(300) // Resize to 300px wide, maintaining aspect ratio
                .webp({ quality: 80 }) // Convert to WebP, quality 80
                .toFile(tempLocalThumbPath);
            functions.logger.info(`${funcName} Resizing complete. Uploading thumbnail from '${tempLocalThumbPath}' to GCS path: '${thumbnailGcsPath}' in bucket '${bucketName}'`);

            const [uploadedFile] = await bucket.upload(tempLocalThumbPath, {
                destination: thumbnailGcsPath,
                metadata: {
                    contentType: 'image/webp',
                    cacheControl: 'public, max-age=31536000', // Cache for 1 year
                },
            });

            try {
                await uploadedFile.makePublic(); // Attempt to make it public
                functions.logger.info(`${funcName} Thumbnail '${thumbnailGcsPath}' in bucket '${bucketName}' made public.`);
            } catch (publicError) {
                functions.logger.error(`${funcName} Failed to make thumbnail public for '${thumbnailGcsPath}'. Manual intervention or signed URLs may be needed.`, publicError);
                // This might not be a fatal error depending on how you access images
            }

            // --- 3. Get Public URL for the Thumbnail ---
            finalThumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbnailGcsPath}`;
            functions.logger.info(`${funcName} Generated Thumbnail URL: ${finalThumbnailUrl}`);

            // --- 4. Update Firestore Document within Transaction ---
            functions.logger.info(`${funcName} Preparing Firestore update for room ${roomId} within transaction...`);
            transaction.update(roomRef, {
                imageUrls: updatedImageUrls,
                thumbnailImageUrl: finalThumbnailUrl
            });
            functions.logger.info(`${funcName} Firestore transaction update for room ${roomId} prepared.`);
        }); // End Firestore Transaction

        functions.logger.info(`${funcName} Transaction and image processing successful for room ${roomId}.`);
        // CORS headers were already set
        res.status(200).json({
            status: 'success',
            message: 'Cover image set and thumbnail generated successfully.',
            thumbnailUrl: finalThumbnailUrl // Send back the new thumbnail URL
        });

    } catch (error) {
        functions.logger.error(`${funcName} Operation FAILED for room ${roomId}:`, { message: error.message, stack: error.stack });
        // CORS headers were already set
        res.status(500).json({ status: 'error', message: `Operation failed: ${error.message}` });
    } finally {
        // --- Clean up temporary files from /tmp directory ---
        try {
            if (tempLocalOriginalPath && fs.existsSync(tempLocalOriginalPath)) {
                fs.unlinkSync(tempLocalOriginalPath);
                functions.logger.info(`${funcName} Cleaned up temporary original file: ${tempLocalOriginalPath}`);
            }
            if (tempLocalThumbPath && fs.existsSync(tempLocalThumbPath)) {
                fs.unlinkSync(tempLocalThumbPath);
                functions.logger.info(`${funcName} Cleaned up temporary thumbnail file: ${tempLocalThumbPath}`);
            }
        } catch (cleanupError) {
            functions.logger.error(`${funcName} Error during temporary file cleanup:`, cleanupError);
        }
    }
});

// --- NEW Cloud Function: Upload Property Image ---
exports.uploadPropertyImage = functions.region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB' }) // Adjust resources if needed
    .https.onRequest((req, res) => {
    const funcName = '[uploadPropertyImage]';
    if (handleCors(req, res)) { // Call CORS helper
         functions.logger.info(`${funcName} Responding to OPTIONS preflight request.`);
         return;
    }

    if (req.method !== 'POST') {
        functions.logger.warn(`${funcName} Received non-POST request (${req.method}).`);
        return res.status(405).send('Method Not Allowed');
    }

    // Use Busboy to handle multipart/form-data
    const busboy = Busboy({ headers: req.headers });
    const tmpdir = os.tmpdir();

    // This object will accumulate all the fields, keyed by their name
    const fields = {};
    // This object will accumulate all the uploaded files, keyed by their name.
    const uploads = {};
    // This object will accumulate all the promises of file writes.
    const fileWrites = [];

    // Process non-file fields.
    busboy.on('field', (fieldname, val) => {
        functions.logger.info(`${funcName} Processed field ${fieldname}: ${val}.`);
        fields[fieldname] = val;
    });

    // Process file uploads.
    busboy.on('file', (fieldname, file, fileinfo) => {
        const { filename, encoding, mimeType } = fileinfo;
        functions.logger.info(`${funcName} Processing file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
        const filepath = path.join(tmpdir, `${uuidv4()}_${filename}`); // Use UUID for unique temp name
        uploads[fieldname] = filepath;

        const writeStream = fs.createWriteStream(filepath);
        file.pipe(writeStream);

        // File was processed by Busboy; wait for it to be written to disk.
        const promise = new Promise((resolve, reject) => {
            file.on('end', () => { writeStream.end(); });
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        fileWrites.push(promise);
    });

    // Triggered once all uploaded files are processed by Busboy.
    busboy.on('finish', async () => {
        functions.logger.info(`${funcName} Busboy finished parsing form.`);
        try {
            await Promise.all(fileWrites); // Wait for all file writes to complete
            functions.logger.info(`${funcName} File writes complete. Fields:`, fields);
            functions.logger.info(`${funcName} Uploads:`, uploads);


            const { roomId, category, labels } = fields; // Get roomId and optional fields
            const imageFileField = 'imageFile'; // Assume frontend sends file with name 'imageFile'

            if (!roomId) throw new Error('Missing roomId field in form data.');
            if (!uploads[imageFileField]) throw new Error('Missing imageFile field in form data.');

            const localFilePath = uploads[imageFileField];
            const fileExt = path.extname(localFilePath); // Get original extension if needed
            const contentType = req.headers['content-type'] ? req.headers['content-type'].split(';')[0] : 'application/octet-stream'; // Get mimetype or default


            // --- Upload to Cloud Storage ---
            const uniqueFilename = `${uuidv4()}${fileExt}`; // Create unique name
            const gcsPath = `rooms/${roomId}/${uniqueFilename}`; // Example storage path
            const defaultBucket = storage.bucket(admin.app().options.storageBucket || `${process.env.GCLOUD_PROJECT}.appspot.com`); // Get default bucket
            functions.logger.info(`${funcName} Uploading ${localFilePath} to gs://${defaultBucket.name}/${gcsPath}`);

            const [uploadedFile] = await defaultBucket.upload(localFilePath, {
                destination: gcsPath,
                metadata: { contentType: contentType, cacheControl: 'public, max-age=31536000' },
            });

            // Make public if needed (adjust permissions)
            try { await uploadedFile.makePublic(); } catch (e) { functions.logger.error("Failed to make uploaded image public", e); }
            const publicUrl = `https://storage.googleapis.com/${defaultBucket.name}/${gcsPath}`;
            functions.logger.info(`${funcName} Upload successful. Public URL: ${publicUrl}`);

            // --- Update Firestore ---
            const roomRef = db.collection('rooms').doc(roomId);
            const newImageObject = {
                url: publicUrl,
                category: category || null, // Use provided category or null
                labels: labels ? labels.split(',').map(l => l.trim()) : [], // Split labels string or empty array
                isCover: false, // New uploads are not cover by default
                uploadedAt: admin.firestore.FieldValue.serverTimestamp() // Optional timestamp
            };

            functions.logger.info(`${funcName} Updating Firestore for room ${roomId}...`);
            await roomRef.update({
                // Atomically add the new image object to the array
                imageUrls: admin.firestore.FieldValue.arrayUnion(newImageObject)
            });
            functions.logger.info(`${funcName} Firestore updated successfully.`);

            // Clean up local temp file
            fs.unlinkSync(localFilePath);

            res.status(200).json({ status: 'success', message: 'Image uploaded successfully', newImage: newImageObject });

        } catch (error) {
            functions.logger.error(`${funcName} Error during finish handler:`, error);
            // Clean up temp files on error too
            Object.values(uploads).forEach(filePath => { try { fs.unlinkSync(filePath); } catch(e){} });
            res.status(500).json({ status: 'error', message: `Upload failed: ${error.message}` });
        }
    });

    // Pass the request stream to Busboy
    if (req.rawBody) {
        busboy.end(req.rawBody);
    } else {
        req.pipe(busboy);
    }
});

// --- NEW Cloud Function: Delete Property Image ---
exports.deletePropertyImage = functions.region('us-central1')
     .runWith({ timeoutSeconds: 60, memory: '256MB' })
     .https.onRequest(async (req, res) => {
     const funcName = '[deletePropertyImage]';
     if (handleCors(req, res)) { // Call CORS helper
         functions.logger.info(`${funcName} Responding to OPTIONS preflight request.`);
         return;
     }

     // Use POST for simplicity, could use DELETE method too
     if (req.method !== 'POST') {
         functions.logger.warn(`${funcName} Received non-POST request (${req.method}).`);
         return res.status(405).send('Method Not Allowed');
     }

     const { roomId, imageUrlToDelete } = req.body;
     functions.logger.info(`${funcName} Request received:`, { roomId, imageUrlToDelete: imageUrlToDelete ? '*** URL Present ***' : '!!! URL MISSING !!!' });

     if (!roomId || !imageUrlToDelete) {
         functions.logger.error(`${funcName} Missing roomId or imageUrlToDelete in request body.`);
         return res.status(400).json({ status: 'error', message: 'Missing required parameters: roomId, imageUrlToDelete' });
     }

     const roomRef = db.collection('rooms').doc(roomId);
     let wasCover = false;
     let thumbnailGcsPathToDelete = null; // Store path if needed

     try {
         // --- Delete from Storage FIRST ---
         const parsedUrl = getBucketAndPath(imageUrlToDelete);
         if (!parsedUrl) {
             throw new Error(`Could not parse GCS URL for deletion: ${imageUrlToDelete}`);
         }
         const { bucketName, filePath } = parsedUrl;
         const bucket = storage.bucket(bucketName);
         const fileToDelete = bucket.file(filePath);

         functions.logger.info(`${funcName} Attempting to delete GCS file: gs://${bucketName}/${filePath}`);
         try {
             await fileToDelete.delete();
             functions.logger.info(`${funcName} GCS file deleted successfully.`);
             // Construct potential thumbnail path to delete later
             thumbnailGcsPathToDelete = `${path.dirname(filePath)}/${path.parse(filePath).name}_thumb_300.webp`;
         } catch (storageError) {
             // Check if it's just a "Not Found" error (maybe already deleted)
             if (storageError.code === 404) {
                 functions.logger.warn(`${funcName} GCS file not found (gs://${bucketName}/${filePath}), possibly already deleted. Proceeding with Firestore update.`);
                 // Still try to construct thumbnail path in case it exists
                  thumbnailGcsPathToDelete = `${path.dirname(filePath)}/${path.parse(filePath).name}_thumb_300.webp`;
             } else {
                 // Rethrow other storage errors
                 throw new Error(`Failed to delete image from Cloud Storage: ${storageError.message}`);
             }
         }

          // --- Attempt to delete thumbnail ---
          if (thumbnailGcsPathToDelete) {
              functions.logger.info(`${funcName} Attempting to delete GCS thumbnail: gs://${bucketName}/${thumbnailGcsPathToDelete}`);
              try {
                  await bucket.file(thumbnailGcsPathToDelete).delete();
                  functions.logger.info(`${funcName} GCS thumbnail deleted successfully.`);
              } catch (thumbError) {
                   if (thumbError.code === 404) {
                       functions.logger.warn(`${funcName} GCS thumbnail not found (gs://${bucketName}/${thumbnailGcsPathToDelete}), possibly already deleted or never existed.`);
                   } else {
                       functions.logger.error(`${funcName} Failed to delete thumbnail from Cloud Storage:`, thumbError);
                       // Don't necessarily fail the whole operation, just log it
                   }
              }
          }


         // --- Update Firestore ---
         functions.logger.info(`${funcName} Updating Firestore for room ${roomId} to remove image URL...`);
         const roomDoc = await roomRef.get();
         if (!roomDoc.exists) throw new Error(`Room ${roomId} not found for Firestore update.`);

         let currentImageUrls = roomDoc.data().imageUrls;
         if (!Array.isArray(currentImageUrls)) currentImageUrls = [];

         // Find the exact object to remove
         const imageObjectToRemove = currentImageUrls.find(img => img.url === imageUrlToDelete);

         if (!imageObjectToRemove) {
             functions.logger.warn(`${funcName} Image URL not found in Firestore array for room ${roomId}, perhaps already removed.`);
             // If the object isn't found, we might still proceed if storage delete was okay
             // but we can't use arrayRemove. Maybe just return success?
             // Let's proceed assuming storage deletion is the main goal if Firestore is inconsistent
         } else {
             if(imageObjectToRemove.isCover) {
                 wasCover = true;
             }
             // Use arrayRemove to atomically remove the matching object
             await roomRef.update({
                 imageUrls: admin.firestore.FieldValue.arrayRemove(imageObjectToRemove)
             });
             functions.logger.info(`${funcName} Firestore imageUrls array updated via arrayRemove.`);
         }

          // If the deleted image was the cover, clear the thumbnail field
          if (wasCover) {
              functions.logger.info(`${funcName} Deleted image was the cover. Clearing thumbnailImageUrl field.`);
               await roomRef.update({
                    thumbnailImageUrl: admin.firestore.FieldValue.delete() // Remove the field
               });
          }

         functions.logger.info(`${funcName} Firestore update successful for room ${roomId}.`);
         res.status(200).json({ status: 'success', message: 'Image deleted successfully.' });

     } catch (error) {
         functions.logger.error(`${funcName} Operation Failed for room ${roomId}:`, error);
         res.status(500).json({ status: 'error', message: `Delete failed: ${error.message}` });
     }
});