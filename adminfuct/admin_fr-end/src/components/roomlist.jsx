// src/components/RoomList.jsx (or wherever you have it)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config'; // Assuming config.js is in ../src/

function RoomList({ selectedDestination, onRoomSelect, selectedRoomId, refreshTrigger }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Don't fetch if no destination is selected or "All" is selected
        if (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') {
            setRooms([]);
            setError(!selectedDestination ? '' : 'Please select a specific destination.');
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

    }, [selectedDestination, refreshTrigger]); // Dependency array - refetch when destination changes

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
                    // Check if thumbnail exists and is not an empty string
                    const hasThumbnail = room.thumbnailImageUrl && typeof room.thumbnailImageUrl === 'string' && room.thumbnailImageUrl.trim() !== '';

                    // --- Define styles based on thumbnail presence and selection ---
                    const itemStyle = {
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: room.id === selectedRoomId ? '#d1e7fd' : 'transparent', // Selected BG
                        borderBottom: '1px dashed #ccc',
                        color: hasThumbnail ? '#757575' : '#FFFFFF', // Grey if thumb EXISTS, White if MISSING (adjust #FFFFFF if needed)
                        fontWeight: room.id === selectedRoomId ? 'bold' : 'normal',
                    };
                    // --------------------------------------------------------------

                    const handleArchive = async (e, roomId) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to archive room ${roomId}? This will move it to the archived collection.`)) {
                            try {
                                const response = await axios.post(`${API_BASE_URL}/archiveRoom`, { roomId });
                                if (response.data.status === 'success') {
                                    alert(`Room ${roomId} archived.`);
                                    // Trigger refresh
                                    if (refreshTrigger !== undefined) {
                                        // In Dashboard.jsx, refreshTrigger is a state, we can't update it from here directly 
                                        // unless passed as a setter. But wait, RoomList depends on refreshTrigger.
                                        // We should probably just call a reload or window.location.reload() for simplicity 
                                        // if we don't have a better way to communicate UP.
                                        window.location.reload();
                                    }
                                }
                            } catch (err) {
                                console.error("Archive failed:", err);
                                alert("Failed to archive room: " + (err.response?.data?.message || err.message));
                            }
                        }
                    };

                    return (
                        <li
                            key={room.id}
                            onClick={() => onRoomSelect(room)}
                            style={itemStyle} // Apply the dynamic style
                            title={hasThumbnail ? 'Thumbnail exists' : 'Thumbnail missing'} // Add a tooltip
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    {room.id} ({room.title || room.name || 'No Name'})
                                    {hasThumbnail && <span style={{ color: 'limegreen', marginLeft: '5px', fontSize: '0.8em' }}>✓</span>}
                                </span>
                                <button
                                    onClick={(e) => handleArchive(e, room.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '1.2em',
                                        padding: '2px 5px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.background = 'rgba(255,0,0,0.1)'}
                                    onMouseOut={(e) => e.target.style.background = 'transparent'}
                                    title="Archive Room"
                                >
                                    🗑️
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default RoomList;