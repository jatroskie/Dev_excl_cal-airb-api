// src/components/ImageThumbnail.jsx

import React, { useState } from 'react';
import axios from 'axios';
// Import all relevant URLs
import { SET_COVER_FUNCTION_URL, DELETE_IMAGE_FUNCTION_URL, ROTATE_IMAGE_FUNCTION_URL } from '../config'; // Assuming config.js is in ../src/
import { logActivity } from '../utils/logger';

// Represents ONE image with its controls
function ImageThumbnail({
    image,
    roomId,
    isCover,
    onSetCoverSuccess,
    onDeleteSuccess,
    onRotateSuccess,
    onError,
    isProcessing // <-- ADD THIS PROP TO RECEIVE IT
}) {
    // Local state to allow immediate UI updates (optimistic or result-driven)
    // Support both image objects { url: "..." } and raw strings from Firestore
    const imageUrl = (image && typeof image === 'object') ? image.url : image;
    const [localImageUrl, setLocalImageUrl] = useState(imageUrl);

    // Local state for individual button actions (cover set, delete)
    const [isSettingCover, setIsSettingCover] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRotating, setIsRotating] = useState(false);

    // Sync local state if prop changes (e.g. after parent refresh)
    React.useEffect(() => {
        setLocalImageUrl(imageUrl);
    }, [imageUrl]);

    const handleRotateClick = async () => {
        setIsRotating(true);
        onError('');
        try {
            const response = await axios.post(ROTATE_IMAGE_FUNCTION_URL, {
                roomId: roomId,
                imageUrl: imageUrl, // Send the extracted url
                angle: 90
            });
            if (response.data?.status === 'success') {
                const newUrl = response.data.newUrl;
                if (newUrl) {
                    setLocalImageUrl(newUrl); // Immediate local update!
                }
                logActivity('ROTATE_IMAGE', { roomId: roomId, imageUrl: imageUrl });
                if (onRotateSuccess) onRotateSuccess(roomId); // Trigger full refresh
            } else {
                throw new Error(response.data?.message || 'Rotate failed');
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Failed to rotate.';
            if (onError) onError(errorMsg);
        } finally {
            setIsRotating(false);
        }
    };

    const handleMakeCoverClick = async () => {
        // Pre-flight check for missing data
        if (!imageUrl || !roomId) {
            console.error("[ImageThumbnail] FAILED: Missing required data.", { imageUrl, roomId, image_raw: image });
            alert("Error: Missing image data or Room ID. Cannot set cover.");
            return;
        }

        if (!window.confirm(`Make this image the cover for room ${roomId}? This will generate a new thumbnail.`)) {
            return;
        }
        
        setIsSettingCover(true);
        if (onError) onError(''); 

        console.log("[ImageThumbnail] Attempting to set cover:", { roomId, imageUrl });

        try {
            const response = await axios.post(SET_COVER_FUNCTION_URL, {
                roomId: roomId,
                selectedImageUrl: imageUrl,
                imageUrl: imageUrl // Fallback for backend parameter resilience
            });

            console.log("[ImageThumbnail] Server Response:", response.data);

            if (response.data?.status === 'success') {
                logActivity('SET_COVER_IMAGE', { roomId: roomId, imageUrl: imageUrl });
                if (onSetCoverSuccess) {
                    onSetCoverSuccess(roomId, imageUrl);
                }
            } else {
                throw new Error(response.data?.message || 'Unknown server error');
            }
        } catch (error) {
            const errorData = error.response?.data;
            console.error("[ImageThumbnail] API Error:", errorData || error.message);
            const errorMsg = errorData?.message || error.message || 'Failed to update cover image.';
            if (onError) onError(errorMsg);
        } finally {
            setIsSettingCover(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!window.confirm(`Are you sure you want to DELETE this image for room ${roomId}?\nURL: ${image.url}\nThis cannot be undone.`)) {
            return;
        }
        setIsDeleting(true); // Local loading state for this button
        onError('');

        try {
            const response = await axios.post(DELETE_IMAGE_FUNCTION_URL, {
                roomId: roomId,
                imageUrlToDelete: imageUrl,
                collectionName: (image && typeof image === 'object' ? image.collectionName : 'rooms')
            });

            if (response.data?.status === 'success') {
                logActivity('DELETE_IMAGE', { roomId: roomId, imageUrl: imageUrl });
                if (onDeleteSuccess) {
                    onDeleteSuccess(roomId, imageUrl); // Notify parent component
                }
            } else {
                throw new Error(response.data?.message || 'Unknown error from server deleting image.');
            }
        } catch (error) {
            console.error("Error calling deleteImage function:", error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to delete image.';
            if (onError) {
                onError(errorMsg);
            }
            // alert(`Error deleting: ${errorMsg}`); // Alert is now handled by parent
        } finally {
            setIsDeleting(false);
        }
    };

    // Determine if any action is currently processing for this thumbnail or the parent
    const currentlyProcessing = isProcessing || isSettingCover || isDeleting || isRotating;

    return (
        <div className={`image-thumbnail-container ${isCover ? 'current-cover' : ''} ${currentlyProcessing ? 'processing' : ''}`}>
            <img
                src={localImageUrl}
                alt={`Category: ${image.category || 'N/A'}`}
            />
            <div className="image-thumbnail-details">
                <small>Cat: {(image && typeof image === 'object' && image.category) || 'other'}</small>
                <small>Cover: {isCover ? 'Yes' : 'No'}</small>
            </div>

            <div className="image-thumbnail-actions">
                <button
                    onClick={handleRotateClick}
                    disabled={currentlyProcessing}
                    className="secondary-button"
                    title="Rotate Image"
                >
                    {isRotating ? '...' : '↻'}
                </button>
                <button
                    onClick={handleMakeCoverClick}
                    disabled={isCover || currentlyProcessing}
                    className={`make-cover-button ${isCover ? 'current-cover' : ''}`}
                >
                    {isSettingCover ? '...' : (isCover ? 'Cover' : 'Make Cover')}
                </button>
                <button
                    onClick={handleDeleteClick}
                    disabled={currentlyProcessing}
                    className="delete-button"
                    title="Delete Image"
                >
                    {isDeleting ? '...' : '🗑️'}
                </button>
            </div>
        </div>
    );
}

export default ImageThumbnail;