import React, { useState, useCallback } from 'react';
import HotelSelector from './components/HotelSelector.jsx';
import RoomList from './components/RoomList.jsx';
import ImageManager from './components/ImageManager.jsx';
import './App.css'; // Add some basic CSS if needed

function App() {
    const [selectedDestination, setSelectedDestination] = useState(''); // Start with no selection or 'All destinations'
    const [selectedRoom, setSelectedRoom] = useState(null); // The whole room object

    const handleDestinationSelect = useCallback((destination) => {
        console.log("Destination selected:", destination);
        setSelectedDestination(destination);
        setSelectedRoom(null); // Clear selected room when destination changes
    }, []);

    const handleRoomSelect = useCallback((room) => {
        console.log("Room selected:", room.id);
        setSelectedRoom(room); // Set the full room object
    }, []);

    // Optional: Callback to refresh room list if needed after update
     const handleRoomUpdate = useCallback((roomId) => {
        console.log(`Room ${roomId} was updated, potentially refresh list or details`);
        // For simplicity, we don't automatically refetch here, but you could.
        // Could refetch the single room details if needed.
    }, []);


    return (
        <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <h1>Property Image Manager</h1>
            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>

                {/* Left Panel: Selection */}
                <div style={{ width: '300px', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <HotelSelector
                        onDestinationSelect={handleDestinationSelect}
                        selectedDestination={selectedDestination}
                    />
                    <RoomList
                        selectedDestination={selectedDestination}
                        onRoomSelect={handleRoomSelect}
                        selectedRoomId={selectedRoom?.id}
                    />
                </div>

                {/* Right Panel: Image Management */}
                <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
                    <ImageManager
                         room={selectedRoom}
                         onUpdate={handleRoomUpdate} // Pass callback
                    />
                </div>
            </div>
        </div>
    );
}

export default App;