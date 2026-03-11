import React, { useState, useEffect } from 'react';

const COMMON_DESTINATIONS = [
    "V&A Waterfront",
    "City Centre",
    "Lawhill Suites Waterfront",
    "De Waterkant",
    "Camps Bay",
    "Mouille Point"
];

const Step1_Location = ({ data, updateData, next }) => {
    // Local state for the inputs to manage control/validation before updating parent
    const [localData, setLocalData] = useState(data);
    const [isCustomDestination, setIsCustomDestination] = useState(false);

    useEffect(() => {
        // If the current destination is not in the common list and not empty, set custom mode
        if (data.destination && !COMMON_DESTINATIONS.includes(data.destination)) {
            setIsCustomDestination(true);
        }
    }, [data.destination]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalData(prev => ({ ...prev, [name]: value }));
    };

    const handleDestinationChange = (e) => {
        const val = e.target.value;
        if (val === 'CUSTOM') {
            setIsCustomDestination(true);
            setLocalData(prev => ({ ...prev, destination: '' }));
        } else {
            setIsCustomDestination(false);
            setLocalData(prev => ({ ...prev, destination: val }));
        }
    };

    const handleNext = () => {
        if (!localData.address) {
            alert("Please enter an address.");
            return;
        }
        if (!localData.destination) {
            alert("Please select or enter a destination.");
            return;
        }
        updateData(localData);
        next();
    };

    return (
        <div className="step-container">
            <div className="form-group">
                <label className="form-label" htmlFor="roomId">Property ID (Optional - e.g. MPA-103B)</label>
                <input
                    type="text"
                    id="roomId"
                    name="roomId"
                    className="form-input"
                    placeholder="e.g. MPA-103B"
                    value={localData.roomId || ''}
                    onChange={handleChange}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="address">Property Address</label>
                <input
                    type="text"
                    id="address"
                    name="address"
                    className="form-input"
                    placeholder="e.g. 24 Ocean View Drive"
                    value={localData.address}
                    onChange={handleChange}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="unitNumber">Unit Number (Optional)</label>
                <input
                    type="text"
                    id="unitNumber"
                    name="unitNumber"
                    className="form-input"
                    placeholder="e.g. Apt 4B"
                    value={localData.unitNumber}
                    onChange={handleChange}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="destination">Destination</label>
                {!isCustomDestination ? (
                    <select
                        id="destination"
                        className="form-select"
                        value={localData.destination}
                        onChange={handleDestinationChange}
                    >
                        <option value="">Select a destination...</option>
                        {COMMON_DESTINATIONS.map(dest => (
                            <option key={dest} value={dest}>{dest}</option>
                        ))}
                        <option value="CUSTOM">+ Add New Destination</option>
                    </select>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            name="destination"
                            className="form-input"
                            placeholder="Type new destination (e.g. Paarl Winelands)"
                            value={localData.destination}
                            onChange={handleChange}
                            autoFocus
                        />
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setIsCustomDestination(false);
                                setLocalData(prev => ({ ...prev, destination: '' }));
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    This helps us write a better description for you.
                </p>
            </div>

            <div className="btn-row">
                <button className="btn-primary" onClick={handleNext}>Next: Add Photos</button>
            </div>
        </div>
    );
};

export default Step1_Location;
