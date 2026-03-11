// src/components/ImageManager.jsx

import React, { useState, useRef } from 'react'; // useRef for the hidden file input
import axios from 'axios';
import ImageThumbnail from './imageThumbnail';   // Assuming it's in the same folder
// We don't need to import UploadModal here if we embed its logic or use a simpler approach for upload first

// Import function URL for uploading
import { UPLOAD_IMAGE_FUNCTION_URL } from '../config'; // Assuming config.js is in ../src/
import { logActivity } from '../utils/logger';

/**
 * Component to display and manage images for a selected room.
 * Allows designating a cover image via ImageThumbnail and uploading new images.
 */
function ImageManager({ room, onUpdate }) {
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false); // General processing state
    const [showSettingsModal, setShowSettingsModal] = useState(false); // --- Upload Configuration Modal State ---
    const [generateLabels, setGenerateLabels] = useState(true); // Toggle for AI Labels

    // Ref for the hidden file input
    const fileInputRef = useRef(null);

    // If no room is selected, display a placeholder message
    if (!room) {
        return <p style={{ fontStyle: 'italic', color: '#555', padding: '20px' }}>Select a room from the list to manage its images.</p>;
    }

    // Generic success handler for operations from ImageThumbnail or this component
    const handleOperationSuccess = (updatedRoomId, message = 'Operation successful.') => {
        setSuccessMessage(`${message} Room: ${updatedRoomId}. Refreshing data...`);
        setError('');
        if (onUpdate) {
            onUpdate(updatedRoomId); // Trigger parent to refresh room data
        }
        setTimeout(() => setSuccessMessage(''), 7000); // Clear success message after a delay
    };

    // Generic error handler
    const handleOperationError = (errorMessage) => {
        setError(`Operation failed: ${errorMessage}`);
        setSuccessMessage('');
    };

    // --- Upload Configuration Modal State ---
    // (Moved to top of component to satisfy Rules of Hooks)

    // --- File Upload Logic ---
    const handleFileSelected = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0 && room?.id) {
            setShowSettingsModal(false); // Close modal on selection
            setIsProcessing(true);
            setSuccessMessage(`Uploading ${files.length} images...`);

            logActivity('BULK_UPLOAD_STARTED', {
                roomId: room.id,
                count: files.length,
                filenames: files.map(f => f.name)
            });

            let successCount = 0;
            let failCount = 0;

            for (const file of files) {
                try {
                    await uploadFile(file);
                    successCount++;
                } catch (e) {
                    console.error(e);
                    failCount++;
                }
            }

            setIsProcessing(false);

            logActivity('BULK_UPLOAD_FINISHED', {
                roomId: room.id,
                successCount: successCount,
                failCount: failCount
            });

            if (failCount === 0) {
                handleOperationSuccess(room.id, `Successfully uploaded ${successCount} images.`);
            } else {
                setError(`Uploaded ${successCount} images. Failed to upload ${failCount} images.`);
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const uploadFile = async (file) => {
        // Individual upload logic (removed internal state setters to avoid flickering loops)
        // We rely on the parent loop for status updates, or we can update a progress log if we wanted.
        const formData = new FormData();
        formData.append('roomId', room.id);
        formData.append('imageFile', file);
        formData.append('generateLabels', generateLabels); // Pass the toggle value
        // Backend handles resizing and AI labeling now.

        console.log(`Uploading ${file.name} for room ${room.id} to ${UPLOAD_IMAGE_FUNCTION_URL}`);

        const response = await axios.post(UPLOAD_IMAGE_FUNCTION_URL, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data?.status !== 'success') {
            throw new Error(response.data?.message || 'Unknown upload error');
        }
    };
    // --- END: File Upload Logic ---

    // Ensure imageUrls is an array, default to empty if not present
    const images = Array.isArray(room.imageUrls) ? room.imageUrls : [];

    return (
        <div style={{ border: '1px solid #aaa', padding: '10px', marginTop: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9', position: 'relative' }}>
            {/* Header with Room ID/Name and Upload Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>
                    Images for Room: {room.id} ({room.name || 'No Name'})
                </h3>
                {/* Hidden file input, triggered by the modal action */}
                <input
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileSelected}
                    id={`imageUploadInput-${room.id}`}
                    multiple // ENABLE MULTIPLE UPLOADS
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <a
                        href={`https://vacprop.com/viewer/index.html?id=${room.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            padding: '8px 15px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        View Property
                    </a>
                    <button onClick={() => setShowSettingsModal(true)} disabled={isProcessing || !room}>
                        {isProcessing ? 'Uploading...' : 'Upload New Images'}
                    </button>
                </div>
            </div>

            {/* Display Error or Success Messages */}
            {error && <p style={{ color: 'red', backgroundColor: '#fee', padding: '5px', borderRadius: '3px' }}>{error}</p>}
            {successMessage && <p style={{ color: 'green', backgroundColor: '#efe', padding: '5px', borderRadius: '3px' }}>{successMessage}</p>}

            {/* Handle case where there are no images */}
            {images.length === 0 && <p>No images found for this room. Use "Upload New Image" to add some.</p>}

            {/* Container for the image thumbnails */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {images.map((img, index) => (
                    <ImageThumbnail
                        key={img.url || `img-${room.id}-${index}`} // More unique key
                        image={img}
                        roomId={room.id}
                        isCover={img.isCover === true}
                        onSetCoverSuccess={(updatedRoomId) => handleOperationSuccess(updatedRoomId, "Cover image updated.")}
                        onDeleteSuccess={(updatedRoomId) => handleOperationSuccess(updatedRoomId, "Image deleted.")}
                        onRotateSuccess={(updatedRoomId) => handleOperationSuccess(updatedRoomId, "Image rotated.")}
                        onError={handleOperationError}
                        isProcessing={isProcessing} // Pass processing state to disable buttons in thumbnail
                    />
                ))}
            </div>

            {/* --- UPLOAD SETTINGS MODAL --- */}
            {showSettingsModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    color: '#333'
                }}>
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'left' }}>
                        <h3 style={{ marginTop: 0, color: 'black' }}>Upload Configuration</h3>
                        <p style={{ fontSize: '0.9em', color: '#666' }}>The following actions will be performed automatically:</p>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', color: '#888' }}>
                                <input type="checkbox" checked disabled style={{ marginRight: '10px' }} />
                                <span>Upload to GCS (Processing...)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', color: '#888' }}>
                                <input type="checkbox" checked disabled style={{ marginRight: '10px' }} />
                                <span>Link to Room in Firestore</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', marginBottom: '8px', padding: '8px',
                                    cursor: 'pointer', backgroundColor: '#e6f7ff', borderRadius: '4px', border: '1px solid #1890ff'
                                }}
                                onClick={() => setGenerateLabels(!generateLabels)}
                            >
                                <input
                                    type="checkbox"
                                    checked={generateLabels}
                                    readOnly
                                    style={{ marginRight: '10px', cursor: 'pointer', transform: 'scale(1.2)' }}
                                />
                                <span style={{ fontWeight: 'bold', color: 'black' }}>Create Labels (AI Auto-Gen)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <input type="checkbox" checked disabled style={{ marginRight: '10px' }} />
                                <span><strong>Resize Image</strong> (Max 1600px width)</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowSettingsModal(false)} style={{ backgroundColor: '#e0e0e0', color: '#333', border: '1px solid #ccc', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Select Files & Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ImageManager;