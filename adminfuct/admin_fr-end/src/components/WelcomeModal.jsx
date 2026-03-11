import React from 'react';

/**
 * WelcomeModal component to display instructional information to the user after login.
 */
function WelcomeModal({ onClose }) {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '30px',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
                position: 'relative'
            }}>
                <h2 style={{ marginTop: 0, color: '#007bff' }}>Quick Guide: Hosting Portal</h2>
                <p style={{ color: '#555', lineHeight: '1.6' }}>
                    Welcome! Here’s how to manage your properties efficiently:
                </p>
                <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#333' }}>
                    <li><strong>Upload Photos:</strong> Use the "Upload New Images" button to bulk upload photos for a specific room.</li>
                    <li><strong>Rotate & Edit:</strong> Correct image orientation using the rotate button.</li>
                    <li><strong>Set Cover:</strong> Select a cover page. The system will automatically create a thumbnail for website searching.</li>
                    <li><strong>AI Content:</strong> Once images are uploaded, click "Generate Title and Description" with AI.</li>
                    <li><strong>Google Cloud:</strong> As you add photos, they are uploaded to Google Cloud Services.</li>
                    <li><strong>View Output:</strong> You can view the output at <a href="https://vacprop.com/viewer/index.html?id=TBA-0402" target="_blank" rel="noreferrer" style={{ color: '#007bff', wordBreak: 'break-all' }}>https://vacprop.com/viewer/index.html?id=TBA-0402</a> (replace the ID with your property ID).</li>
                    <li><strong>Remember to Save:</strong> Always save your changes before moving to the next property.</li>
                </ul>
                <div style={{ textAlign: 'right', marginTop: '25px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 25px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px'
                        }}
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WelcomeModal;
