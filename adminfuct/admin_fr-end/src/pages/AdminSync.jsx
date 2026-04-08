import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AdminSync = () => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [testingRoomId, setTestingRoomId] = useState(null);
    const [showGallery, setShowGallery] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        name: '',
        address: {
            line1: '',
            city: '',
            country: '',
            lat: '',
            lng: ''
        },
        amenities: [],
        imageUrls: [],
        imageCategories: [],
        coverImageUrl: ''
    });

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'rooms'), (snapshot) => {
            const fetchedRooms = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRooms(fetchedRooms.sort((a, b) => (a.hotelCode || '').localeCompare(b.hotelCode || '')));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Body scroll lock
    useEffect(() => {
        if (isEditModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isEditModalOpen]);

    const handleEditRoom = (room) => {
        setSelectedRoom(room);
        setEditForm({
            title: room.title || '',
            name: room.name || '',
            address: {
                line1: room.address?.line1 || '',
                city: room.address?.city || '',
                country: room.address?.country || '',
                lat: room.address?.lat || '',
                lng: room.address?.lng || ''
            },
            amenities: room.amenities || [],
            imageUrls: room.imageUrls || [],
            imageCategories: room.imageCategories || [],
            coverImageUrl: room.coverImageUrl || ''
        });
        setShowGallery(false);
        setIsEditModalOpen(true);
    };

    const handleAmenityChange = (index, value) => {
        const newAmenities = [...editForm.amenities];
        newAmenities[index] = value;
        setEditForm({ ...editForm, amenities: newAmenities });
    };

    const handleRemoveAmenity = (index) => {
        const newAmenities = editForm.amenities.filter((_, i) => i !== index);
        setEditForm({ ...editForm, amenities: newAmenities });
    };

    const handleAddAmenity = () => {
        setEditForm({ ...editForm, amenities: [...editForm.amenities, ''] });
    };

    const handleSaveProperty = async () => {
        if (!selectedRoom) return;
        
        try {
            const roomRef = doc(db, 'rooms', selectedRoom.id);
            await updateDoc(roomRef, {
                title: editForm.title || null,
                name: editForm.name || null,
                address: editForm.address,
                amenities: editForm.amenities,
                imageUrls: editForm.imageUrls,
                imageCategories: editForm.imageCategories,
                coverImageUrl: editForm.coverImageUrl
            });
            setIsEditModalOpen(false);
            alert('Property updated successfully!');
        } catch (error) {
            console.error('Error updating property:', error);
            alert('Failed to update property.');
        }
    };

    const runTest = async (room) => {
        setTestingRoomId(room.id);
        try {
            const res = await axios.post(`${API_BASE_URL}/bnb/test-rate`, {
                hotelCode: room.hotelCode,
                propRate: room.propRate,
                actType: room.actType
            });
            alert(`Test Results: ${res.data.status || 'Success'}\nPrice: ${res.data.price}`);
        } catch (error) {
            console.error('Test failed:', error);
            alert('Test failed. Check console.');
        } finally {
            setTestingRoomId(null);
        }
    };

    const syncRoom = async (room) => {
        if (!window.confirm(`Sync content for ${room.hotelCode}-${room.roomNumber} with Airbnb?`)) return;
        try {
            await axios.post(`${API_BASE_URL}/bnb/sync-room`, { roomId: room.id });
            alert('Sync initiated!');
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Sync failed.');
        }
    };

    const renderRoomsTable = () => {
        return (
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 text-left">
                            <th className="p-4 font-medium text-white/50">LOCAL ROOM</th>
                            <th className="p-4 font-medium text-white/50">AIRBNB LISTING ID</th>
                            <th className="p-4 font-medium text-white/50">SYNC STATUS</th>
                            <th className="p-4 font-medium text-right text-white/50">CERTIFICATION ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map(room => (
                            <tr key={room.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                        {room.hotelCode} - {room.roomNumber}
                                    </div>
                                    <div className="text-xs opacity-60">
                                        {room.id} - {room.title || 'Untitled'}
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-sm opacity-70">
                                    {room.airbnbListingId || 'Not Mapped'}
                                </td>
                                <td className="p-4 text-xs">
                                    <span className={`px-2 py-1 rounded-full ${room.airbnbListingId ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                        {room.airbnbListingId ? 'Mapped' : 'Unmapped'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all"
                                            onClick={() => handleEditRoom(room)}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm transition-all disabled:opacity-50"
                                            onClick={() => runTest(room)}
                                            disabled={testingRoomId === room.id}
                                        >
                                            {testingRoomId === room.id ? 'Testing...' : 'Test Rate'}
                                        </button>
                                        <button 
                                            className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-sm transition-all"
                                            onClick={() => syncRoom(room)}
                                        >
                                            Sync Content
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderModal = () => {
        if (!isEditModalOpen) return null;

        return createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 md:p-8 bg-[#0f1115]/95 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="bg-[#1a1c24] border border-white/10 w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] rounded-none md:rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col relative z-10">
                    <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">Edit Room Properties</h3>
                            <p className="text-sm text-white/40">{selectedRoom?.hotelCode}-{selectedRoom?.roomNumber} • {selectedRoom?.id}</p>
                        </div>
                        <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/50 text-2xl transition-all">&times;</button>
                    </div>

                    <div className="p-8 overflow-y-auto flex-1 space-y-10 custom-scrollbar bg-[#1a1c24]">
                        {/* Basic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-blue-400/80 uppercase tracking-widest pl-1">Primary Address</label>
                                <input 
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all text-white placeholder-white/20"
                                    placeholder="Enter street address..."
                                    value={editForm.address.line1}
                                    onChange={(e) => setEditForm({...editForm, address: {...editForm.address, line1: e.target.value}})}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-blue-400/80 uppercase tracking-widest pl-1">City / Suburb</label>
                                <input 
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all text-white placeholder-white/20"
                                    placeholder="e.g. Cape Town"
                                    value={editForm.address.city}
                                    onChange={(e) => setEditForm({...editForm, address: {...editForm.address, city: e.target.value}})}
                                />
                            </div>
                        </div>

                        {/* Images Folder View */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <h4 className="text-lg font-bold text-white/90">Property Assets</h4>
                                <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] uppercase font-black text-white/50 tracking-tighter">{editForm.imageUrls.length} FILES TOTAL</span>
                            </div>
                            
                            {!showGallery ? (
                                <div className="p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/5 rounded-[1.5rem] hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer group flex items-center gap-8 shadow-inner" onClick={() => setShowGallery(true)}>
                                    <div className="flex -space-x-4 overflow-hidden">
                                        {editForm.imageUrls.slice(0, 4).map((url, i) => (
                                            <div key={i} className="inline-block h-20 w-20 rounded-2xl ring-8 ring-[#1a1c24] overflow-hidden shadow-2xl transition-transform group-hover:scale-105 group-hover:-translate-y-2" style={{ transitionDelay: `${i * 50}ms` }}>
                                                <img src={url} className="h-full w-full object-cover" alt="Preview"/>
                                            </div>
                                        ))}
                                        {editForm.imageUrls.length > 4 && (
                                            <div className="flex items-center justify-center h-20 w-20 rounded-2xl ring-8 ring-[#1a1c24] bg-blue-600/20 backdrop-blur-md text-sm font-black text-blue-400 shadow-2xl">
                                                +{editForm.imageUrls.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors mb-1">Image Folder</div>
                                        <div className="text-sm text-white/40 font-medium">Click to manage and categorize property photos</div>
                                    </div>
                                    <div className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all">Open Folder</div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => setShowGallery(false)} className="text-xs text-blue-400 font-black tracking-widest hover:text-white transition-colors flex items-center gap-2 uppercase">
                                            <span>← Back to Folder View</span>
                                        </button>
                                        <span className="text-[10px] text-white/30 uppercase font-bold">Scroll to browse all images</span>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                                        {editForm.imageUrls.map((url, idx) => (
                                            <div key={idx} className={`bg-white/5 rounded-2xl p-3 border transition-all group relative ${editForm.coverImageUrl === url ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/5'}`}>
                                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/40 shadow-xl">
                                                    <img src={url} alt={`Photo ${idx}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                    {editForm.coverImageUrl === url && (
                                                        <div className="absolute top-2 left-2 px-3 py-1.5 bg-blue-600 text-[10px] font-black text-white rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.5)] flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                            FEATURED COVER
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 mt-3 px-1">
                                                    <span className="text-[10px] text-white/30 truncate uppercase font-bold tracking-tighter">CATEGORY</span>
                                                    <span className="text-sm text-white/90 truncate font-semibold">{editForm.imageCategories?.[idx] || 'Room View'}</span>
                                                </div>
                                                <div className="flex gap-2 mt-4">
                                                    <button 
                                                        className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter ${editForm.coverImageUrl === url ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-blue-600/20 hover:text-blue-400'}`} 
                                                        onClick={() => setEditForm({...editForm, coverImageUrl: url})}
                                                    >
                                                        {editForm.coverImageUrl === url ? 'Current Cover' : 'Set as Cover'}
                                                    </button>
                                                    <button className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 text-[10px] rounded-lg transition-all">&times;</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Amenities UI */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <h4 className="text-lg font-bold text-white/90">Amenities & Features</h4>
                                <button onClick={handleAddAmenity} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all">+ Add New</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {editForm.amenities.map((amenity, idx) => (
                                    <div key={idx} className="flex gap-3 items-center bg-white/5 p-1 px-4 rounded-2xl border border-white/5 focus-within:border-blue-500/50 focus-within:bg-white/10 shadow-sm transition-all group">
                                        <div className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors" />
                                        <input 
                                            type="text"
                                            className="flex-1 bg-transparent border-none outline-none text-white text-sm py-4 font-medium"
                                            value={amenity}
                                            onChange={(e) => handleAmenityChange(idx, e.target.value)}
                                        />
                                        <button 
                                            onClick={() => handleRemoveAmenity(idx)}
                                            className="p-2 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-t border-white/10 bg-white/5 flex justify-end gap-4 shadow-2xl">
                        <button onClick={() => setIsEditModalOpen(false)} className="px-8 py-4 text-white/40 hover:text-white font-bold uppercase tracking-widest transition-all">Cancel Changes</button>
                        <button onClick={handleSaveProperty} className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-1 active:scale-95">Update Property</button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#0f1115]">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6" />
            <div className="text-xl font-black text-white uppercase tracking-[0.2em] animate-pulse">Initializing Data Map</div>
            <div className="text-sm text-white/20 mt-2 font-medium">Fetching rooms from Firestore...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1115] text-white/90 selection:bg-blue-500/30">
            <div className="p-8 max-w-[1400px] mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Connection Header */}
                <div className="relative overflow-hidden p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center bg-[#1a1c24] border border-white/5 shadow-2xl">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white text-3xl shadow-2xl shadow-red-500/30">
                            A
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-black text-white tracking-tight">Airbnb Hub</h2>
                                <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-[10px] font-black tracking-widest uppercase border border-green-500/20">Active Link</div>
                            </div>
                            <p className="text-white/40 font-medium">Global Account: <span className="text-white/60">jatroskie • 753719566</span></p>
                        </div>
                    </div>
                    <div className="relative z-10 mt-6 md:mt-0 flex gap-4">
                        <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-[1.25rem] font-bold text-sm transition-all flex items-center gap-2">
                           View Documentation
                        </button>
                        <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.25rem] font-black text-sm shadow-xl shadow-blue-500/20 transition-all">
                            Reconnect API
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-[#1a1c24] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-br from-white/5 to-transparent">
                        <div>
                            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Listings & Sync Map</h3>
                            <p className="text-white/40 font-medium max-w-md">Orchestrate and verify pricing data synchronization between local inventory and the Airbnb platform.</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => window.location.reload()} className="w-14 h-14 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-2xl border border-white/10 transition-all">
                                ↺
                            </button>
                            <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20">
                                + Map Global Unit
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-2">
                        {renderRoomsTable()}
                    </div>
                </div>
            </div>

            {/* Render the Portal-based Modal */}
            {renderModal()}
        </div>
    );
};

export default AdminSync;
