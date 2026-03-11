// src/components/RoomList.jsx (Make sure it's .jsx)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config'; // Assuming config.js is in ../src/

function RoomList({ selectedDestination, onRoomSelect, selectedRoomId }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Don't fetch if no destination is selected
        if (!selectedDestination) {
            setRooms([]);
            setError(''); // Clear error when destination is cleared
            return;
        };

        setLoading(true);
        setError('');
        setRooms([]); // Clear previous rooms before fetching new ones

        console.log(`Fetching rooms for destination: ${selectedDestination}`);
        axios.get(`${API_BASE_URL}/admin/rooms`, { params: { destinationName: selectedDestination } })
            .then(response => {
                // Sort rooms perhaps? Optional. e.g., by ID or name
                const sortedRooms = response.data.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
                setRooms(sortedRooms);

                if (response.data.length === 0) {
                    setError('No rooms found for this destination.');
                }
            })
            .catch(err => {
                console.error(`Error fetching rooms for ${selectedDestination}:`, err);
                setError('Failed to load rooms.');
                setRooms([]);
            })
            .finally(() => {
                setLoading(false);
            });

    }, [selectedDestination]); // Dependency array - refetch when destination changes

    return (
        // Apply some basic styling for better presentation
        <div style={{
            flexGrow: 1, // Allow list to take available space
            overflowY: 'auto', // Make the list scrollable vertically
            borderTop: '1px solid #eee',
            padding: '0 5px' // Add slight horizontal padding
        }}>
            <h3 style={{ marginTop: '10px', marginBottom: '5px', paddingLeft: '8px' }}>Rooms</h3>
            {loading && <p style={{ paddingLeft: '8px' }}>Loading rooms...</p>}
            {error && <p style={{ color: 'orange', paddingLeft: '8px' }}>{error}</p>}
            {!loading && !error && rooms.length === 0 && selectedDestination && selectedDestination.toLowerCase() !== 'all destinations' &&
                <p style={{ paddingLeft: '8px', fontStyle: 'italic', color: '#555' }}>No rooms found for this destination.</p>
            }
             {!loading && !error && rooms.length === 0 && (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') &&
                <p style={{ paddingLeft: '8px', fontStyle: 'italic', color: '#555' }}>Select a specific destination to see rooms.</p>
            }

            {/* Use <ul> for semantic list */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {rooms.map(room => {
                    // --- Check if thumbnail exists and is not an empty string ---
                    const hasThumbnail = room.thumbnailImageUrl && typeof room.thumbnailImageUrl === 'string' && room.thumbnailImageUrl.trim() !== '';
                    // -------------------------------------------------------------

                    // --- Define styles based on thumbnail presence and selection ---
                    const itemStyle = {
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: room.id === selectedRoomId ? '#d1e7fd' : 'transparent', // Blueish background if selected
                        borderBottom: '1px dashed #ccc',
                        color: hasThumbnail ? '#757575' : '#000000', // Grey text if thumbnail exists, black otherwise
                        fontWeight: room.id === selectedRoomId ? 'bold' : 'normal', // Bold if selected
                    };
                    // --------------------------------------------------------------

                    return (
                        <li
                            key={room.id}
                            onClick={() => onRoomSelect(room)}
                            style={itemStyle} // Apply the dynamic style
                            title={hasThumbnail ? 'Thumbnail exists' : 'Thumbnail missing'} // Add a tooltip
                        >
                            {/* Display Room Info */}
                            {room.id} ({room.name || 'No Name'})
                            {/* Optional: Add a small indicator icon */}
                            {hasThumbnail && <span style={{ color: 'green', marginLeft: '5px', fontSize: '0.8em' }}>✓</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default RoomList;