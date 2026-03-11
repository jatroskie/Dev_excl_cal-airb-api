import React from 'react';
import './UploadModal.css'; // We'll create this CSS file

function UploadModal({ isOpen, onClose, onUpload }) {
    if (!isOpen) {
        return null;
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        const file = event.target.imageFile.files[0];
        if (file) {
            onUpload(file); // Call parent's upload handler
        }
    };

    return (
        // Modal overlay (optional, can be removed if you don't want to dim background)
        <div className="modal-overlay-partial">
            <div className="modal-content-partial">
                <h3>Upload New Image</h3>
                <form onSubmit={handleSubmit}>
                    <input type="file" name="imageFile" accept="image/*" required />
                    {/* Add inputs for category, labels if needed */}
                    <div className="modal-actions">
                        <button type="submit">Upload</button>
                        <button type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UploadModal;