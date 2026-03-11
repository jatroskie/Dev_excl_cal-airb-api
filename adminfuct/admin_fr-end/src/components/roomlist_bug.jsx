// src/components/RoomList.jsx (Make sure it's .jsx)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config'; // Assuming config.js is in ../src/

Youfunction RoomList({ selectedDestination, onRoomSelect, selectedRoomId }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') {'re right, my previous suggestion reversed the colors! Apologies for that.

Let's swap the colors in the `RoomList.jsx` component to make rooms **WITH** thumbnails **grey** and those **WITHOUT** thumbnails **white** (or the default text color, which is likely black or near-black depending on your base CSS).

**Modify
             // Clear rooms and show appropriate message if "All" or nothing is selected
             setRooms([]);
             setError(!selectedDestination ? '' : 'Please select a specific destination.');
             return;
        };

        setLoading(true); `src/components/RoomList.jsx`:**

Find the `itemStyle` definition within the `rooms.map`
        setError('');
        setRooms([]);

        console.log(`Fetching rooms for destination: ${selectedDestination}`);
        axios.get(`${API_BASE_URL}/admin/rooms`, { params: { destinationName: selectedDestination } })
            .then(response => {
                const sortedRooms = response.data.sort((a, b) function and **swap the colors** in the ternary operator for the `color` property:

```jsx
// src/components/RoomList.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
 => (a.id || '').localeCompare(b.id || ''));
                setRooms(sortedRooms);
                if (response.data.length === 0) {
                    setError('No rooms found for this destination.');
                import { API_BASE_URL } from '../config';

function RoomList({ selectedDestination, onRoomSelect, selectedRoomId }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if}
            })
            .catch(err => {
                console.error(`Error fetching rooms for ${selectedDestination}:`, err);
                setError('Failed to load rooms.');
                setRooms([]);
            })
            .finally(() => {
                setLoading(false);
            });

    }, [selectedDestination]);

    return (
 (!selectedDestination) {
            setRooms([]);
            setError('');
            return;
        };
        setLoading(true);
        setError('');
        setRooms([]);
        console.log(`Fetching rooms for destination: ${selectedDestination}`);        <div style={{
            flexGrow: 1,
            overflowY: 'auto',
            borderTop: '1px solid #eee',
            padding: '0 5px'
        }}>
            
        axios.get(`${API_BASE_URL}/admin/rooms`, { params: { destinationName: selectedDestination } })
            .then(response => {
                const sortedRooms = response.data.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
                setRooms(<h3 style={{ marginTop: '10px', marginBottom: '5px', paddingLeft: '8pxsortedRooms);
                if (response.data.length === 0) {
                    setError('No rooms found for this destination.');
                }
            })
            .catch(err => {
                console.error(`' }}>Rooms</h3>
            {loading && <p style={{ paddingLeft: '8px' }}>Loading rooms...</p>}
            {error && <p style={{ color: 'orange', paddingLeft: '8px' }}>{error}</p>}
            {!loading && !error && rooms.length === 0 && selectedDestination && selectedDestination.toLowerCase() !== 'all destinations' &&
                <p style={{ paddingLeft: '8px', fontStyle: 'Error fetching rooms for ${selectedDestination}:`, err);
                setError('Failed to load rooms.');
                setRooms([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedDestination]);

    return (
        <div style={{ flexGrow: 1, overflowY: 'auto', borderitalic', color: '#555' }}>No rooms found.</p>
            }
            {!loading && !error && rooms.length === 0 && (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') &&
Top: '1px solid #eee', padding: '0 5px' }}>
            <h3 style={{ marginTop: '10px', marginBottom: '5px', paddingLeft: '8px' }}>Rooms</h3>
            {loading && <p style={{ paddingLeft: '8px' }}>Loading rooms...</p>}
            {error &&                <p style={{ paddingLeft: '8px', fontStyle: 'italic', color: '#555' }}>Select a specific destination.</p>
            }

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {rooms.map(room => {
                    // Check if thumbnail exists and is not an empty string
                    const hasThumbnail = room.thumbnailImageUrl && typeof room.thumbnailImageUrl === <p style={{ color: 'orange', paddingLeft: '8px' }}>{error}</p>}
            {!loading && !error && rooms.length === 0 && selectedDestination && selectedDestination.toLowerCase() !== 'all destinations' &&
                <p style={{ paddingLeft: '8px', fontStyle: 'italic', color: '#5 'string' && room.thumbnailImageUrl.trim() !== '';

                    // --- SWAPPED COLORS HERE ---
                    const itemStyle = {
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: room.id ===55' }}>No rooms found for this destination.</p>
            }
             {!loading && !error && rooms.length === 0 && (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') &&
                <p style={{ paddingLeft: '8px', fontStyle: 'italic', color: '#555' selectedRoomId ? '#d1e7fd' : 'transparent', // Selected BG
                        borderBottom: '1px dashed #ccc',
                        color: hasThumbnail ? '#757575' : '#FFFFFF', // <-- Grey if thumbnail EXISTS, White if MISSING
                        fontWeight: room.id === selectedRoomId ? 'bold' : ' }}>Select a specific destination to see rooms.</p>
            }
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {rooms.map(room => {
                    const hasThumbnail = room.thumbnailImageUrl && typeof room.thumbnailImageUrl === 'string' && room.thumbnailImageUrl.trim() !==normal',
                    };
                    // --- END SWAP ---

                    return (
                        <li
                            key={room.id}
                            onClick={() => onRoomSelect(room)}
                            style={itemStyle}
                            title={hasThumbnail ? 'Thumbnail exists' : 'Thumbnail missing'}
                        >
                            {room.id} ({room.name || 'No Name'})
                            {/* Optional indicator icon */}
                            {hasThumbnail && < '';

                    // --- Define styles based on thumbnail presence and selection ---
                    const itemStyle = {
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: room.id === selectedRoomId ? '#d1e7fd' : 'transparent',
                        borderBottom: '1px dashed #ccc',
                        // *** SWAP THE COLORS HERE ***
                        color: hasThumbnail ? '#757575' : '#000span style={{ color: 'limegreen', marginLeft: '5px', fontSize: '0.8em' }}>✓</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default RoomList000', // Grey text if thumbnail exists, black otherwise
                        // *** END SWAP ***
                        fontWeight: room.id === selectedRoomId ? 'bold' : 'normal',
                    };
                    // --------------------------------------------------------------;
