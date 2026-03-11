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
    const [localImageUrl, setLocalImageUrl] = useState(image.url);

    // Local state for individual button actions (cover set, delete)
    const [isSettingCover, setIsSettingCover] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRotating, setIsRotating] = useState(false);

    // Sync local state if prop changes (e.g. after parent refresh)
    React.useEffect(() => {
        setLocalImageUrl(image.url);
    }, [image.url]);

    const handleRotateClick = async () => {
        setIsRotating(true);
        onError('');
        try {
            const response = await axios.post(ROTATE_IMAGE_FUNCTION_URL, {
                roomId: roomId,
                imageUrl: image.url, // Send the CURRENT url
                angle: 90
            });
            if (response.data?.status === 'success') {
                const newUrl = response.data.newUrl;
                if (newUrl) {
                    setLocalImageUrl(newUrl); // Immediate local update!
                }
                logActivity('ROTATE_IMAGE', { roomId: roomId, imageUrl: image.url });
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
        if (!window.confirm(`Make this image the cover for room ${roomId}? This will generate a new thumbnail.`)) {
            return;
        }
        setIsSettingCover(true); // Local loading state for this button
        onError(''); // Clear previous errors from parent

        try {
            const response = await axios.post(SET_COVER_FUNCTION_URL, {
                roomId: roomId,
                selectedImageUrl: image.url
            });

            if (response.data?.status === 'success') {
                logActivity('SET_COVER_IMAGE', { roomId: roomId, imageUrl: image.url });
                if (onSetCoverSuccess) {
                    onSetCoverSuccess(roomId, image.url); // Notify parent
                }
            } else {
                throw new Error(response.data?.message || 'Unknown error from server setting cover.');
            }
        } catch (error) {
            console.error("Error calling setCoverImage function:", error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to update cover image.';
            if (onError) {
                onError(errorMsg); // Pass error to parent
            }
            // alert(`Error setting cover: ${errorMsg}`); // Alert is now handled by parent
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
                imageUrlToDelete: image.url,
                collectionName: image.collectionName || 'rooms' // Pass collection if known
            });

            if (response.data?.status === 'success') {
                logActivity('DELETE_IMAGE', { roomId: roomId, imageUrl: image.url });
                if (onDeleteSuccess) {
                    onDeleteSuccess(roomId, image.url); // Notify parent component
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
        <div style={{
            border: isCover ? '3px solid limegreen' : '1px solid #ccc',
            padding: '5px',
            margin: '5px',
            display: 'inline-block',
            textAlign: 'center',
            background: '#fff',
            borderRadius: '4px',
            minWidth: '170px', // Slightly wider to accommodate buttons
            color: '#333' // Fix contrast against white background
        }}>
            <img
                src={localImageUrl} // USE LOCAL STATE URL
                alt={`Category: ${image.category || 'N/A'}`}
                style={{ maxWidth: '150px', maxHeight: '150px', height: 'auto', display: 'block', margin: '0 auto 5px auto' }}
            />
            <small>Cat: {image.category || 'N/A'}</small><br />
            {/* <small>Labels: {(image.labels || []).join(', ')}</small><br/> */}
            <small>Cover: {image.isCover ? 'Yes' : 'No'}</small><br />

            <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-around', gap: '5px' }}>
                <button
                    onClick={handleRotateClick}
                    disabled={currentlyProcessing}
                    style={{ fontSize: '0.8em', padding: '3px 6px', minWidth: '50px' }}
                >
                    {isRotating ? '...' : '↻'}
                </button>
                <button
                    onClick={handleMakeCoverClick}
                    disabled={isCover || currentlyProcessing} // Use combined processing state
                    style={{ fontSize: '0.8em', padding: '3px 6px', minWidth: '80px' }}
                >
                    {isSettingCover ? 'Saving...' : (isCover ? 'Cover' : 'Make Cover')}
                </button>
                <button
                    onClick={handleDeleteClick}
                    disabled={currentlyProcessing} // Use combined processing state
                    style={{ fontSize: '0.8em', padding: '3px 6px', backgroundColor: '#f44336', color: 'white', border: 'none', minWidth: '60px' }}
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    );
}

export default ImageThumbnail;