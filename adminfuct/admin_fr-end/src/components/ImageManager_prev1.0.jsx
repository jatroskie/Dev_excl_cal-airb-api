// Example path: src/components/ImageManager.js
// Or if directly in src: src/ImageManager.js

import React, { useState, useRef } from 'react'; // Add useRef here
import axios from 'axios'; // Make sure axios is imported
import ImageThumbnail from './ImageThumbnail.jsx'; // Assumes ImageThumbnail.js is in the same folder
import { UPLOAD_IMAGE_FUNCTION_URL } from '../config'; // Import new URL
import UploadModal from './UploadModal';  
/**
 * Component to display and manage images for a selected room.
 * Allows designating a cover image via the ImageThumbnail component.
 *
 * Props:
 *  - room: The full room object containing details and the `imageUrls` array.
 *          Expected structure for room.imageUrls:
 *          [ { url: "...", category: "...", labels: [...], isCover: true/false }, ... ]
 *  - onUpdate: (Optional) Callback function triggered after a successful cover image update.
 *              Receives the roomId as an argument.
 */
function ImageManager({ room, onUpdate }) {
    // State to hold potential error messages from child components or API calls
    const [error, setError] = useState('');
    // State to show temporary success feedback
    const [successMessage, setSuccessMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null); // Ref for file input
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // State for upload modal

    // If no room is selected, display a placeholder message
    if (!room) {
        return <p style={{ fontStyle: 'italic', color: '#555', padding: '20px' }}>Select a room from the list to manage its images.</p>;
    }

    // Callback passed to ImageThumbnail, triggered on successful API call
    const handleSuccess = (updatedRoomId, newCoverUrl) => {
        setSuccessMessage(`Cover image updated for ${updatedRoomId}. Thumbnail generated/updated. You might need to refresh the room list or details if this view doesn't automatically update.`);
        setError(''); // Clear any previous error
        // Optionally trigger a refetch or update logic in the parent component
        if (onUpdate) {
            onUpdate(updatedRoomId);
        }
        // Clear success message after a delay
        setTimeout(() => setSuccessMessage(''), 5000); // Clear after 5 seconds
    }

    // Callback passed to ImageThumbnail to handle errors during the update process
    const handleError = (errorMessage) => {
        setError(`Update failed: ${errorMessage}`);
        setSuccessMessage(''); // Clear any previous success message
    }

// --- NEW: File Upload Logic ---
const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && room?.id) {
        handleUpload(file);
    }
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
};

const handleUpload = async (file) => {
    setIsUploading(true);
    setError('');
    setSuccessMessage('');

    const formData = new FormData();
    formData.append('roomId', room.id);
    formData.append('imageFile', file); // Backend expects 'imageFile'
    // Optional: Add category/labels if you have inputs for them
    // formData.append('category', 'some_category');
    // formData.append('labels', 'label1,label2');

    console.log(`Uploading ${file.name} for room ${room.id}`);

    try {
        const response = await axios.post(UPLOAD_IMAGE_FUNCTION_URL, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            // Optional: Add progress tracking if needed
            // onUploadProgress: progressEvent => { ... }
        });

        if (response.data?.status === 'success') {
            handleSuccess(room.id, `Image '${file.name}' uploaded.`);
        } else {
            throw new Error(response.data?.message || 'Unknown upload error.');
        }
    } catch (err) {
        console.error("Upload error:", err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to upload image.';
        handleError(errorMsg);
    } finally {
        setIsUploading(false);
    }
};
// --- END: File Upload Logic ---


    // Ensure imageUrls is an array, default to empty if not present
    const images = Array.isArray(room.imageUrls) ? room.imageUrls : [];

    return (
        <div style={{ border: '1px solid #aaa', padding: '10px', marginTop: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
            {/* Display Room ID and Name */}
            <h3 style={{ marginTop: '0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                Images for Room: {room.id} ({room.name || 'No Name'})
            </h3>

            {/* Display Error or Success Messages */}
            {error && <p style={{ color: 'red', backgroundColor: '#fee', padding: '5px', borderRadius: '3px' }}>{error}</p>}
            {successMessage && <p style={{ color: 'green', backgroundColor: '#efe', padding: '5px', borderRadius: '3px' }}>{successMessage}</p>}

         {/* --- NEW: Upload Section --- */}
         <div style={{ margin: '15px 0', padding: '10px', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                    <input
                        type="file"
                        accept="image/jpeg, image/png, image/webp" // Specify accepted types
                        onChange={handleFileChange}
                        style={{ display: 'none' }} // Hide default input
                        ref={fileInputRef}
                        id="imageUploadInput"
                    />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {isUploading ? 'Uploading...' : 'Upload New Image'}
                    </button>
                    {isUploading && <span style={{ marginLeft: '10px' }}>Uploading...</span>}
                </div>
                {/* --- END: Upload Section --- */}

            {/* Handle case where there are no images */}
            {images.length === 0 && <p>No images found for this room.</p>}

            {/* Container for the image thumbnails */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {/* Map over the images array and render an ImageThumbnail for each */}
                {images.map((img, index) => (
                    // Use the image URL as a key if available and likely unique, otherwise fallback to index
                    <ImageThumbnail
                        key={img.url || `img-${index}`}
                        image={img} // Pass the image object { url, category, labels, isCover }
                        roomId={room.id} // Pass the room ID
                        isCover={img.isCover === true} // Determine if this image is the current cover
                        onSetCoverSuccess={handleSuccess} // Pass success callback
                        onError={handleError} // Pass error callback
                    />
                ))}
            </div>
        </div>
    );
}

export default ImageManager;