import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config'; 
import archiveIcon from '../assets/archive-icon.png';

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
        <div className="room-list-container">
            <h3>Rooms</h3>
            {loading && <p className="status-text">Loading rooms...</p>}
            {error && <p className="error-text">{error}</p>}
            {!loading && !error && rooms.length === 0 && selectedDestination && selectedDestination.toLowerCase() !== 'all destinations' &&
                <p className="status-text italic">No rooms found for this destination.</p>
            }
            {!loading && !error && rooms.length === 0 && (!selectedDestination || selectedDestination.toLowerCase() === 'all destinations') &&
                <p className="status-text italic">Select a destination to see rooms.</p>
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
                            className={`room-list-item ${room.id === selectedRoomId ? 'selected' : ''}`}
                            title={hasThumbnail ? 'Thumbnail exists' : 'Thumbnail missing'}
                        >
                            <div className="room-item-content">
                                <span className="room-info">
                                    <span className="room-id">{room.id}</span>
                                    <span className="room-name">{room.title || room.name || 'No Name'}</span>
                                    {hasThumbnail && <span className="check-icon">✓</span>}
                                </span>
                                <button
                                    onClick={(e) => handleArchive(e, room.id)}
                                    className="archive-button"
                                    title="Archive Room"
                                >
                                    <img 
                                        src={archiveIcon} 
                                        alt="Archive" 
                                    />
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