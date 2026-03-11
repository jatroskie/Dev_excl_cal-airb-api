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
                <div className="p-4 bg-blue-50 text-blue-700 rounded mb-4 text-center">
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
                <span className="text-xs text-gray-500">{data.title.length}/50</span>
            </div>

            <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                    className="form-input"
                    rows={6}
                    value={data.description}
                    onChange={e => updateData({ description: e.target.value })}
                />
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
                <label className="form-label">Amenities</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {AMENITIES_COMMON.map(item => (
                        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={data.amenities.includes(item)}
                                onChange={() => toggleAmenity(item)}
                            />
                            {item}
                        </label>
                    ))}
                    {/* Add Essentials/Wifi explicitly if not in common list to show they are checked */}
                    {['Wifi', 'Essentials', 'Bed linens'].map(item => (
                        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={data.amenities.includes(item)}
                                onChange={() => toggleAmenity(item)}
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
