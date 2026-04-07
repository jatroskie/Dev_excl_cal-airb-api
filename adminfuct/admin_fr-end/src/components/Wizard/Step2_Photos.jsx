import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { processImage } from '../../utils/imageProcessing';

const ROOM_TYPES = [
    'Living Room',
    'Kitchen',
    'Bedroom',
    'Bathroom',
    'Exterior',
    'View',
    'Dining Area',
    'Balcony/Patio',
    'Other'
];

const Step2_Photos = ({ data, updateData, next, back }) => {
    const [photos, setPhotos] = useState(data.photos || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const onDrop = useCallback(async (acceptedFiles) => {
        setLoading(true);
        setError(null);
        const newPhotos = [];

        for (const file of acceptedFiles) {
            try {
                const processed = await processImage(file);
                // Assign a default ID and room type
                processed.id = Math.random().toString(36).substr(2, 9);
                processed.category = 'Other';
                processed.isCover = photos.length === 0 && newPhotos.length === 0; // First photo is cover
                newPhotos.push(processed);
            } catch (err) {
                console.error(err);
                // We could accumulate errors to show the user "File X failed: reason"
                alert(err.message);
            }
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        setLoading(false);
    }, [photos]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.webp']
        },
        multiple: true
    });

    const removePhoto = (id) => {
        setPhotos(prev => {
            const newState = prev.filter(p => p.id !== id);
            // If we removed the cover, set the new first image as cover
            if (prev.find(p => p.id === id)?.isCover && newState.length > 0) {
                newState[0].isCover = true;
            }
            return newState;
        });
    };

    const setCover = (id) => {
        setPhotos(prev => prev.map(p => ({
            ...p,
            isCover: p.id === id
        })));
    };

    const updateCategory = (id, newCategory) => {
        setPhotos(prev => prev.map(p =>
            p.id === id ? { ...p, category: newCategory } : p
        ));
    };

    const handleNext = () => {
        if (photos.length < 5) {
            if (!window.confirm("Properties with fewer than 5 photos perform poorly. Are you sure you want to continue?")) {
                return;
            }
        }
        updateData({ photos });
        next();
    };

    return (
        <div className="step-container">
            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`dropzone-container ${isDragActive ? 'active' : ''}`}
                style={{
                    padding: '3rem',
                    textAlign: 'center',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '1rem',
                    background: isDragActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isDragActive ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none'
                }}
            >
                <input {...getInputProps()} />
                {loading ? (
                    <p style={{ color: 'white' }}>Processing images... please wait.</p>
                ) : isDragActive ? (
                    <p style={{ color: 'var(--primary-accent)', fontWeight: '600' }}>Drop the files here ...</p>
                ) : (
                    <div>
                        <p style={{ color: 'white', fontWeight: '600', fontSize: '1.25rem' }}>Drag & drop photos here, or click to select files</p>
                        <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Supports JPG, PNG, WEBP (Min width 800px)</p>
                    </div>
                )}
            </div>

            {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}

            {/* Gallery Grid */}
            <div className="gallery-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    marginTop: '2.5rem'
                }}
            >
                {photos.map((photo, index) => (
                    <div key={photo.id} className="photo-card" 
                        style={{
                            position: 'relative',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ position: 'relative', aspectRatio: '16/9', background: 'rgba(0,0,0,0.2)' }}>
                            <img
                                src={photo.url}
                                alt="Preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {/* Remove Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                                style={{
                                    position: 'absolute', top: '8px', right: '8px',
                                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                    border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                                    cursor: 'pointer', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>

                            {/* Cover Label */}
                            {photo.isCover && (
                                <span style={{
                                    position: 'absolute', top: '8px', left: '8px',
                                    background: '#fbbf24', color: 'black', fontSize: '0.7rem', 
                                    padding: '2px 8px', borderRadius: '4px', fontWeight: '800',
                                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
                                }}>
                                    COVER
                                </span>
                            )}
                        </div>

                        <div style={{ padding: '12px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Room Type</label>
                                <select
                                    className="form-select"
                                    value={photo.category}
                                    onChange={(e) => updateCategory(photo.id, e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                                >
                                    {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {!photo.isCover && (
                                <button
                                    onClick={() => setCover(photo.id)}
                                    style={{ 
                                        background: 'transparent', border: 'none', 
                                        color: 'var(--primary-accent)', cursor: 'pointer', 
                                        fontSize: '0.8rem', fontWeight: '600',
                                        textAlign: 'center', width: '100%', textDecoration: 'underline' 
                                    }}
                                >
                                    Set as Cover
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="btn-row" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={back}>Back</button>
                <div className="text-sm text-gray-500 pt-2 flex items-center">
                    {photos.length} photo(s) selected
                </div>
                <button className={`btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleNext} disabled={loading}>
                    Next: Review & Generate
                </button>
            </div>
        </div>
    );
};

export default Step2_Photos;
