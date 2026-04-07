// src/components/ImageManager.jsx

import React, { useState, useRef } from 'react'; // useRef for the hidden file input
import axios from 'axios';
import ImageThumbnail from './ImageThumbnail';   // Corrected PascalCase
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
        <div className="image-manager-container">
            {/* Header with Room ID/Name and Upload Button */}
            <div className="image-manager-header">
                <h3 style={{ margin: 0 }}>
                    Images for Room: {room.id} ({room.title || room.name || 'No Name'})
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
                        className="secondary-button"
                        style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: '700',
                            fontSize: '1rem',
                            padding: '0.6em 1.2em',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'white'
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
            {error && <p className="error-text">{error}</p>}
            {successMessage && <p className="success-text">{successMessage}</p>}

            {/* Handle case where there are no images */}
            {images.length === 0 && <p className="status-text">No images found for this room. Use "Upload New Image" to add some.</p>}

            {/* Container for the image thumbnails */}
            <div className="image-thumbnails-grid">
                {images.map((img, index) => (
                    <ImageThumbnail
                        key={`${img.url || 'img'}-${index}`} // Guaranteed unique key
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
                <div className="glass-modal-overlay">
                    <div className="glass-modal-content">
                        <h3 style={{ marginTop: 0, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Upload Configuration</h3>
                        <p style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.6)' }}>The following actions will be performed automatically:</p>

                        <div className="modal-actions-list">
                            <div className="modal-action-item completed">
                                <input type="checkbox" checked disabled />
                                <span>Upload to GCS (Processing...)</span>
                            </div>
                            <div className="modal-action-item completed">
                                <input type="checkbox" checked disabled />
                                <span>Link to Room in Firestore</span>
                            </div>
                            <div
                                className={`modal-action-item toggle ${generateLabels ? 'active' : ''}`}
                                onClick={() => setGenerateLabels(!generateLabels)}
                            >
                                <input
                                    type="checkbox"
                                    checked={generateLabels}
                                    readOnly
                                />
                                <span className="label-text">Create Labels (AI Auto-Gen)</span>
                            </div>
                            <div className="modal-action-item completed">
                                <input type="checkbox" checked disabled />
                                <span><strong>Resize Image</strong> (Max 1600px)</span>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="secondary-button" onClick={() => setShowSettingsModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="primary-button"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Select & Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ImageManager;