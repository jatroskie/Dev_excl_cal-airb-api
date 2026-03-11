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
                className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                style={{
                    padding: '3rem',
                    textAlign: 'center',
                    border: '2px dashed #d1d5db',
                    borderRadius: '0.75rem',
                    backgroundColor: isDragActive ? '#eff6ff' : '#f9fafb',
                    cursor: 'pointer'
                }}
            >
                <input {...getInputProps()} />
                {loading ? (
                    <p>Processing images... please wait.</p>
                ) : isDragActive ? (
                    <p className="text-blue-500 font-medium">Drop the files here ...</p>
                ) : (
                    <div>
                        <p className="text-gray-700 font-medium text-lg">Drag & drop photos here, or click to select files</p>
                        <p className="text-gray-500 text-sm mt-2">Supports JPG, PNG, WEBP (Min width 800px)</p>
                    </div>
                )}
            </div>

            {error && <p className="text-red-500 mt-2">{error}</p>}

            {/* Gallery Grid */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginTop: '2rem'
                }}
            >
                {photos.map((photo, index) => (
                    <div key={photo.id} className="relative group border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="relative aspect-video bg-gray-100">
                            <img
                                src={photo.url}
                                alt="Preview"
                                style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                            />
                            {/* Remove Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-70 hover:opacity-100"
                                style={{
                                    position: 'absolute', top: '5px', right: '5px',
                                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                    border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                                    cursor: 'pointer'
                                }}
                            >
                                ×
                            </button>

                            {/* Cover Label */}
                            {photo.isCover && (
                                <span className="absolute top-1 left-1 bg-yellow-400 text-black text-xs px-2 py-0.5 rounded font-bold"
                                    style={{
                                        position: 'absolute', top: '5px', left: '5px',
                                        background: '#fbbf24', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px'
                                    }}
                                >
                                    COVER
                                </span>
                            )}
                        </div>

                        <div className="p-3">
                            <div className="mb-2">
                                <label className="block text-xs text-gray-500 mb-1">Room Type</label>
                                <select
                                    className="w-full text-sm border p-1 rounded"
                                    value={photo.category}
                                    onChange={(e) => updateCategory(photo.id, e.target.value)}
                                    style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                                >
                                    {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {!photo.isCover && (
                                <button
                                    onClick={() => setCover(photo.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline w-full text-center block"
                                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textAlign: 'center', width: '100%' }}
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
