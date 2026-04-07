import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function HotelSelector({ onDestinationSelect, selectedDestination }) {
    const [destinations, setDestinations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        axios.get(`${API_BASE_URL}/admin/destinations`)
            .then(response => {
                setDestinations(['All destinations', ...response.data]); // Add "All" option
            })
            .catch(err => {
                console.error("Error fetching destinations:", err);
                setError('Failed to load destinations.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleChange = (event) => {
        onDestinationSelect(event.target.value);
    };

    return (
        <div className="hotel-selector-container">
            <label htmlFor="destination-select">Select Destination</label>
            <select
                id="destination-select"
                className="glass-select"
                value={selectedDestination || 'All destinations'}
                onChange={handleChange}
                disabled={loading}
            >
                {loading && <option>Loading...</option>}
                {!loading && destinations.map(dest => (
                    <option key={dest} value={dest}>{dest}</option>
                ))}
            </select>
            {error && <p className="error-text">{error}</p>}
        </div>
    );
}

export default HotelSelector;