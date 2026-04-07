import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GENERATE_LISTING_CONTENT_URL, UPDATE_PROPERTY_DETAILS_URL } from '../config';
import { logActivity } from '../utils/logger';

function ListingGenerator({ room, onUpdate }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [amenities, setAmenities] = useState('');

    // Status states
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (room) {
            setTitle(room.description50 || room.title || ''); // Use description50 if available as title preference
            setDescription(room.description500 || room.description || '');
            setAmenities(Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''));
            setMessage('');
            setError('');
        }
    }, [room]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError('');
        setMessage('Analysing images and generating content...');

        try {
            const response = await axios.post(GENERATE_LISTING_CONTENT_URL, {
                roomId: room.id,
                destinationName: room.destinationName || room.suburb || '' // Pass context if available
            });

            if (response.data && response.data.status === 'success') {
                const { title: newTitle, description: newDesc, amenities: newAmenities } = response.data.data;

                setTitle(newTitle || '');
                setDescription(newDesc || '');
                setAmenities(Array.isArray(newAmenities) ? newAmenities.join(', ') : '');
                setMessage('Content generated! Review and edit below.');
                
                logActivity('GENERATE_AI_CONTENT', {
                    roomId: room.id,
                    success: true
                });
            } else {
                setError(response.data?.message || 'Generation returned unexpected status.');
            }
        } catch (err) {
            console.error("Analysis failed:", err);
            setError(err.response?.data?.message || err.message || 'AI Generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        setMessage('Saving changes...');

        try {
            const amenitiesArray = amenities.split(',').map(s => s.trim()).filter(s => s.length > 0);

            const payload = {
                roomId: room.id,
                title: title,
                description: description,
                amenities: amenitiesArray
            };

            const response = await axios.post(UPDATE_PROPERTY_DETAILS_URL, payload);

            if (response.data && response.data.status === 'success') {
                setMessage('Saved successfully!');
                logActivity('SAVE_PROPERTY_DETAILS', {
                    roomId: room.id,
                    title: title,
                    hasDescription: !!description,
                    amenitiesCount: amenitiesArray.length
                });
                if (onUpdate) onUpdate(room.id);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setError(response.data?.message || 'Save failed.');
            }

        } catch (err) {
            console.error("Save failed:", err);
            setError(err.response?.data?.message || err.message || 'Save failed.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!room) return null;

    const inputStyle = {
        width: '100%',
        padding: '8px',
        marginBottom: '10px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        boxSizing: 'border-box'
    };

    const buttonStyle = {
        padding: '10px 15px',
        marginRight: '10px',
        borderRadius: '5px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 'bold',
        color: 'white',
        backgroundColor: '#007bff'
    };

    return (
        <div className="listing-generator-container">
            <h3>Listing Content (AI Enhanced)</h3>

            {error && <div className="error-text">{error}</div>}
            {message && <div className="success-text">{message}</div>}

            <div className="action-row">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isSaving}
                    className="primary-button ai-button"
                >
                    {isGenerating ? 'Analyzing Images...' : 'Generate from AI'}
                </button>
            </div>

            <div className="form-group">
                <label htmlFor="listing-title">Title (Max 50 chars)</label>
                <input
                    id="listing-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="glass-input"
                    placeholder="Enter catchy title..."
                    maxLength={50}
                />
                <small className="char-count">{title.length}/50</small>
            </div>

            <div className="form-group">
                <label htmlFor="listing-description">Marketing Description</label>
                <textarea
                    id="listing-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="glass-textarea"
                    placeholder="Enter full description..."
                    maxLength={500}
                />
                <small className="char-count">{description.length}/500</small>
            </div>

            <div className="form-group">
                <label htmlFor="listing-amenities">Amenities (Comma separated)</label>
                <textarea
                    id="listing-amenities"
                    value={amenities}
                    onChange={(e) => setAmenities(e.target.value)}
                    className="glass-textarea small"
                    placeholder="Wifi, Pool, Balcony..."
                />
            </div>

            <div className="action-row footer">
                <button
                    onClick={handleSave}
                    disabled={isSaving || isGenerating}
                    className="primary-button success"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

export default ListingGenerator;
