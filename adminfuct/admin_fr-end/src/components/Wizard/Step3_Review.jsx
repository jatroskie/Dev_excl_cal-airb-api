import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UPLOAD_IMAGE_FUNCTION_URL, GENERATE_LISTING_CONTENT_URL, UPDATE_PROPERTY_DETAILS_URL } from '../../config';

const AMENITIES_COMMON = ["TV", "Air conditioning", "Kitchen", "Pool", "Hot tub", "Washer", "Dryer", "Balcony", "Ocean view", "Mountain view"];
const PARKING_OPTIONS = ["No Parking", "Free parking on premises", "Paid parking on premises", "Street parking"];

const Step3_Review = ({ data, updateData, back }) => {
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);

    // Auto-trigger AI if not already generated
    useEffect(() => {
        if (!generated && !generating && data.photos.length > 0 && data.address) {
            generateAIContent();
        }
    }, []);

    const generateAIContent = async () => {
        setGenerating(true);
        try {
            // Need a roomId to call the AI function (as per backend logic)
            // But we might be creating a NEW room here. 
            // For now, let's assume we create a temporary ID or the backend allows passing image URLs directly.
            // Wait, the backend logic REQUIRES roomId to fetch images from Firestore.
            // So we MUST have uploaded images to Firestore first.
            // Assumption: Step 2 upload logic should have uploaded them? 
            // Ah, Step 2 only client-compressed them. We haven't uploaded to GCS/Firestore yet.
            // We need to upload FIRST.

            // To fix this flow without rewriting Step 2 heavily:
            // 1. We create a Draft Room ID.
            // 2. Upload images.
            // 3. Then call AI.

            // This is complex. Let's simplfy:
            // We'll mock the AI call for now or skip it if we can't upload yet?
            // "The app identifies folder... uploads... links...".
            // Okay, let's do the UPLOAD here first.

            const draftRoomId = data.roomId || `DRAFT-${Date.now()}`; // Use existing if available (e.g. MPA-0101) or new
            console.log("Using Room ID:", draftRoomId);

            if (!data.roomId) {
                // Only upload if we haven't already done it for this session (basic check)
                // Actually, photos might have changed? For now assume valid session.

                // Upload Loop (Simplified)
                for (const photo of data.photos) {
                    // Check if already uploaded (has url starting with http)
                    if (photo.url && photo.url.startsWith('http')) continue;

                    const formData = new FormData();
                    formData.append('roomId', draftRoomId);
                    formData.append('category', photo.category || 'Other');
                    formData.append('imageFile', photo.file);
                    // Call uploadPropertyImage
                    await axios.post(UPLOAD_IMAGE_FUNCTION_URL, formData);
                }
            }

            // Now call AI
            const aiResponse = await axios.post(GENERATE_LISTING_CONTENT_URL, {
                roomId: draftRoomId,
                destinationName: data.destination
            });

            const { title, description, amenities } = aiResponse.data.data;

            updateData({ title, description, roomId: draftRoomId }); // Store draft ID

            // Merge amenities 
            // Ensure unique
            const current = data.amenities || [];
            const newAmenities = [...new Set([...current, ...amenities])];
            updateData({ amenities: newAmenities });

            setGenerated(true);

        } catch (e) {
            console.error(e);
            alert("AI Generation failed. You can fill details manually.");
        } finally {
            setGenerating(false);
        }
    };

    const toggleAmenity = (item) => {
        const current = data.amenities;
        if (current.includes(item)) {
            updateData({ amenities: current.filter(i => i !== item) });
        } else {
            updateData({ amenities: [...current, item] });
        }
    };

    const handlePublish = async () => {
        setLoading(true);
        try {
            if (!data.roomId) {
                throw new Error("No Draft Room ID found. Please wait for AI generation or try again.");
            }

            await axios.post(UPDATE_PROPERTY_DETAILS_URL, {
                roomId: data.roomId,
                title: data.title,
                description: data.description,
                amenities: data.amenities,
                address: data.address,
                unitNumber: data.unitNumber,
                destination: data.destination,
                parkingType: data.parkingType
            });

            alert("Property Published Successfully!");
            // Redirect or Reset?
            window.location.href = '/host';

        } catch (e) {
            console.error("Publish failed:", e);
            alert(`Publish failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="step-container">
            {generating && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                    fontWeight: '600'
                }}>
                    <span style={{ display: 'inline-block', animation: 'pulse 2s infinite', marginRight: '8px' }}>✨</span>
                    Generating stunning description and analyzing photos...
                </div>
            )}

            <div className="form-group">
                <label className="form-label">Title</label>
                <input
                    className="form-input"
                    value={data.title}
                    onChange={e => updateData({ title: e.target.value })}
                    maxLength={50}
                />
                <span style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
                    {data.title.length}/50
                </span>
            </div>

            <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                    className="form-input"
                    rows={6}
                    value={data.description}
                    onChange={e => updateData({ description: e.target.value })}
                    maxLength={500}
                />
                <span style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
                    {data.description.length}/500
                </span>
            </div>

            <div className="form-group">
                <label className="form-label">Parking</label>
                <select
                    className="form-select"
                    value={data.parkingType}
                    onChange={e => updateData({ parkingType: e.target.value })}
                >
                    {PARKING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>

            <div className="form-group">
                <label className="form-label" style={{ marginBottom: '1rem' }}>Amenities</label>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                    gap: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--glass-border)'
                }}>
                    {[...new Set([...AMENITIES_COMMON, ...['Wifi', 'Essentials', 'Bed linens']])].map(item => (
                        <label key={item} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px',
                            fontSize: '0.9rem',
                            color: data.amenities.includes(item) ? 'white' : 'rgba(255, 255, 255, 0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}>
                            <input
                                type="checkbox"
                                checked={data.amenities.includes(item)}
                                onChange={() => toggleAmenity(item)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: 'var(--primary-accent)'
                                }}
                            />
                            {item}
                        </label>
                    ))}
                </div>
            </div>

            <div className="btn-row">
                <button className="btn-secondary" onClick={back} disabled={generating}>Back</button>
                <button className="btn-primary" onClick={handlePublish} disabled={generating}>
                    Publish Listing
                </button>
            </div>
        </div>
    );
};

export default Step3_Review;
