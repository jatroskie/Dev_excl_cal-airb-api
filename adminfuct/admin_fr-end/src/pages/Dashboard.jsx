import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import HotelSelector from '../components/HotelSelector';
import RoomList from '../components/RoomList';
import ImageManager from '../components/ImageManager';
import ListingGenerator from '../components/ListingGenerator';
import { API_BASE_URL } from '../config';
import { logActivity } from '../utils/logger';
import '../App.css';

function Dashboard() {
    const [selectedDestination, setSelectedDestination] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Counter to trigger list refresh

    const handleDestinationSelect = useCallback((destination) => {
        if (destination) {
            logActivity('ACCESS_DESTINATION', { destination: destination });
        }
        setSelectedDestination(destination);
        setSelectedRoom(null);
    }, []);

    const handleRoomSelect = useCallback((room) => {
        if (room) {
            logActivity('ACCESS_PROPERTY', {
                roomId: room.id,
                roomName: room.name,
                destination: selectedDestination
            });
        }
        setSelectedRoom(room);
    }, [selectedDestination]);

    const handleRoomUpdate = useCallback(async (roomId) => {
        console.log(`Room ${roomId} was updated. Refreshing data...`);
        setRefreshTrigger(prev => prev + 1); // Trigger RoomList refresh

        // Also refresh the currently selected room immediately to update ImageManager
        try {
            // Note: Efficiently we should have a getRoom endpoint. For now we re-fetch list or implement a find.
            // Since we don't have a single-room endpoint confirmed, and RoomList fetches all, let's try to fetch all here too or rely on RoomList updating selectedRoom?
            // RoomList receives onRoomSelect... but it won't trigger it automatically on refresh.
            // So we MUST fetch here to be fast and correct.

            const response = await axios.get(`${API_BASE_URL}/admin/rooms`);
            // In a real app we would filter by destination here if the endpoint supports it to reduce payload
            const rooms = response.data;
            const updatedRoom = rooms.find(r => r.id === roomId);
            if (updatedRoom) {
                console.log("Updated selectedRoom with fresh data:", updatedRoom);
                setSelectedRoom(updatedRoom);
            }
        } catch (e) {
            console.error("Failed to refresh room data:", e);
        }

    }, []);

    return (
        <div className="dashboard-content">
            <h1 className="app-title">Property Image Manager</h1>
            <div className="main-content-area">
                <div className="left-panel">
                    <HotelSelector
                        onDestinationSelect={handleDestinationSelect}
                        selectedDestination={selectedDestination}
                    />
                    <RoomList
                        selectedDestination={selectedDestination}
                        onRoomSelect={handleRoomSelect}
                        selectedRoomId={selectedRoom?.id}
                        refreshTrigger={refreshTrigger} // Pass trigger
                    />
                </div>
                <div className="right-panel">
                    <ImageManager
                        room={selectedRoom}
                        onUpdate={handleRoomUpdate}
                    />
                    <ListingGenerator
                        room={selectedRoom}
                        onUpdate={handleRoomUpdate}
                    />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
