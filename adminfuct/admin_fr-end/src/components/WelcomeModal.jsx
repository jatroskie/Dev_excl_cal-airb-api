import React from 'react';

/**
 * WelcomeModal component to display instructional information to the user after login.
 */
function WelcomeModal({ onClose }) {
    return (
        <div className="glass-modal-overlay">
            <div className="glass-modal-content welcome-modal">
                <h2>Quick Guide: Hosting Portal</h2>
                <p>
                    Welcome! Here’s how to manage your properties efficiently:
                </p>
                <ul className="instruction-list">
                    <li><strong>Upload Photos:</strong> Use the "Upload New Images" button to bulk upload photos.</li>
                    <li><strong>Rotate & Edit:</strong> Correct image orientation using the rotate button.</li>
                    <li><strong>Set Cover:</strong> Select a cover image to generate a searchable thumbnail.</li>
                    <li><strong>AI Content:</strong> Click "Generate Title and Description" with AI.</li>
                    <li><strong>Google Cloud:</strong> Photos are securely stored in Google Cloud Services.</li>
                    <li><strong>Verify:</strong> View your live property via the "View Property" link.</li>
                </ul>
                <div className="modal-footer">
                    <button
                        onClick={onClose}
                        className="primary-button Large"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WelcomeModal;
