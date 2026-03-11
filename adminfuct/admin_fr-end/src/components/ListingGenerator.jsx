import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GENERATE_LISTING_CONTENT_URL, UPDATE_PROPERTY_DETAILS_URL } from '../config';

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
            } else {
                setError('Generation returned unexpected status.');
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
                if (onUpdate) onUpdate(room.id);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setError('Save failed.');
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
        <div style={{ padding: '20px', borderTop: '1px solid #eee', marginTop: '20px' }}>
            <h3>Listing Content (AI Enhanced)</h3>

            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
            {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}

            <div style={{ marginBottom: '15px' }}>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isSaving}
                    style={{ ...buttonStyle, backgroundColor: isGenerating ? '#aaa' : '#6f42c1' }}
                >
                    {isGenerating ? 'Analyzing Images...' : 'Generate from AI'}
                </button>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Title (Title / Description50)</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                    placeholder="Enter catchy title..."
                    maxLength={50}
                />
                <small>{title.length}/50 chars</small>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Marketing Description</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ ...inputStyle, minHeight: '100px' }}
                    placeholder="Enter full description..."
                />
                <small>{description.length} chars (Target: 200-500)</small>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Amenities (Comma separated)</label>
                <textarea
                    value={amenities}
                    onChange={(e) => setAmenities(e.target.value)}
                    style={{ ...inputStyle, minHeight: '60px' }}
                    placeholder="Wifi, Pool, Balcony..."
                />
            </div>

            <button
                onClick={handleSave}
                disabled={isSaving || isGenerating}
                style={{ ...buttonStyle, backgroundColor: '#28a745' }}
            >
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}

export default ListingGenerator;
