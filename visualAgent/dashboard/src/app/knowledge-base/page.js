"use client";
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, onSnapshot, query, orderBy, limit, addDoc } from "firebase/firestore";
import { db } from '../../lib/firebase';

export default function AgentTrainer() {
    const [hotels, setHotels] = useState([]);
    const [activeHotelId, setActiveHotelId] = useState("CBL");
    const [kbDocs, setKbDocs] = useState([]);
    const [trainingDocs, setTrainingDocs] = useState([]);
    const [queryInput, setQueryInput] = useState("");
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("facts"); // facts | history

    // New Fact State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFact, setNewFact] = useState({ id: "", category: "policy", content: "" });

    // 1. Fetch Hotels
    useEffect(() => {
        const fetchHotels = async () => {
            const snap = await getDocs(collection(db, "hotels"));
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setHotels(list);
        }
        fetchHotels();
    }, []);

    // 2. Fetch Knowledge Base & History when Hotel Changes
    useEffect(() => {
        if (!activeHotelId) return;

        // KB
        const kbUnsub = onSnapshot(collection(db, "hotels", activeHotelId, "knowledge_base"), (snap) => {
            const docs = [];
            snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
            setKbDocs(docs);
        });

        // History (Training Examples)
        const historyQ = query(collection(db, "hotels", activeHotelId, "training_examples"), orderBy("timestamp", "desc"), limit(20));
        const histUnsub = onSnapshot(historyQ, (snap) => {
            const docs = [];
            snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
            setTrainingDocs(docs);
        });

        return () => { kbUnsub(); histUnsub(); };
    }, [activeHotelId]);

    // Actions
    const handleUpdateFact = async (id, newContent) => {
        await updateDoc(doc(db, "hotels", activeHotelId, "knowledge_base", id), { content: newContent });
    }

    const handleCreateFact = async () => {
        if (!newFact.id || !newFact.content) return alert("Missing ID or Content");
        await setDoc(doc(db, "hotels", activeHotelId, "knowledge_base", newFact.id), {
            category: newFact.category,
            content: newFact.content,
            updated_at: new Date()
        });
        setShowAddModal(false);
        setNewFact({ id: "", category: "policy", content: "" });
    }

    const handleAskAgent = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8001/inquiry/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hotel_id: activeHotelId, guest_query: queryInput })
            });
            const data = await res.json();
            setResponse(data);
        } catch (e) {
            alert("Agent Service Offline");
        }
        setLoading(false);
    }

    const saveFeedback = async (rating) => {
        if (!response) return;
        await addDoc(collection(db, "hotels", activeHotelId, "training_examples"), {
            query: queryInput,
            response: response.response,
            rating: rating, // 'good' | 'bad'
            context_used: response.context_used,
            timestamp: new Date()
        });
        alert(`Feedback Saved (${rating})`);
        setResponse(null);
        setQueryInput("");
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
            {/* Header & Switcher */}
            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded shadow">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">The Agent Trainer</h1>
                    <p className="text-sm text-gray-500">Curate knowledge. Test responses. Improve accuracy.</p>
                </div>

                <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold text-gray-600">Active Property:</span>
                    <select
                        value={activeHotelId}
                        onChange={e => setActiveHotelId(e.target.value)}
                        className="p-2 border rounded bg-gray-50 font-mono text-blue-700 font-bold"
                    >
                        {hotels.map(h => <option key={h.id} value={h.id}>{h.name || h.id} ({h.id})</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Data (Fact Sheet or History) */}
                <div className="lg:col-span-7 bg-white p-6 rounded shadow flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div className="space-x-4">
                            <button
                                onClick={() => setActiveTab("facts")}
                                className={`font-bold pb-2 ${activeTab === "facts" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}
                            >
                                Knowledge Base
                            </button>
                            <button
                                onClick={() => setActiveTab("history")}
                                className={`font-bold pb-2 ${activeTab === "history" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}
                            >
                                History & Training
                            </button>
                        </div>
                        {activeTab === "facts" && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-bold hover:bg-green-200"
                            >
                                + Add Fact
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {activeTab === "facts" ? (
                            kbDocs.map(doc => (
                                <div key={doc.id} className="border p-4 rounded bg-gray-50 hover:bg-white transition">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-xs uppercase text-blue-500 tracking-wider">{doc.category}</span>
                                        <span className="font-mono text-xs text-gray-400">{doc.id}</span>
                                    </div>
                                    <textarea
                                        className="w-full p-2 border rounded text-sm text-gray-700 focus:ring-2 focus:ring-blue-200 outline-none"
                                        rows={2}
                                        defaultValue={doc.content}
                                        onBlur={(e) => {
                                            if (e.target.value !== doc.content) handleUpdateFact(doc.id, e.target.value)
                                        }}
                                    />
                                </div>
                            ))
                        ) : (
                            trainingDocs.map(doc => (
                                <div key={doc.id} className={`border-l-4 p-4 rounded bg-gray-50 ${doc.rating === 'good' ? 'border-green-400' : 'border-red-400'}`}>
                                    <p className="text-xs font-bold text-gray-500 mb-1">Q: {doc.query}</p>
                                    <p className="text-sm text-gray-800 italic">" {doc.response} "</p>
                                    <div className="mt-2 text-xs text-gray-400 flex justify-between">
                                        <span>{doc.timestamp?.toDate ? doc.timestamp.toDate().toLocaleString() : ''}</span>
                                        <span className={doc.rating === 'good' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                            {doc.rating === 'good' ? '👍 APPROVED' : '👎 REJECTED'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                        {activeTab === "history" && trainingDocs.length === 0 && <p className="text-gray-400 text-center mt-10">No history yet. Start testing!</p>}
                    </div>
                </div>

                {/* RIGHT COLUMN: Simulator */}
                <div className="lg:col-span-5 bg-purple-50 p-6 rounded shadow border border-purple-100 h-[600px] flex flex-col">
                    <h2 className="text-xl font-bold text-purple-800 mb-4">Agent Simulator</h2>

                    <div className="flex-1 flex flex-col">
                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase text-purple-400 mb-2">Guest Inquiry</label>
                            <textarea
                                className="w-full p-4 border rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                rows={4}
                                placeholder="e.g. Is the gym open 24/7?"
                                value={queryInput}
                                onChange={e => setQueryInput(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleAskAgent}
                            disabled={loading || !queryInput}
                            className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
                        >
                            {loading ? "Thinking..." : "Generate Response"}
                        </button>

                        {response && (
                            <div className="mt-6 flex-1 flex flex-col animate-fade-in-up">
                                <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-purple-500 mb-4">
                                    <p className="text-gray-800 text-lg leading-relaxed">{response.response}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-auto">
                                    <button onClick={() => saveFeedback('good')} className="bg-green-100 text-green-700 py-3 rounded-lg font-bold hover:bg-green-200 transition">
                                        👍 Good Answer
                                    </button>
                                    <button onClick={() => saveFeedback('bad')} className="bg-red-100 text-red-700 py-3 rounded-lg font-bold hover:bg-red-200 transition">
                                        👎 Needs Edit
                                    </button>
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-2">Saving feedback trains the model.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ADD FACT MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h3 className="font-bold text-lg mb-4">Add New Fact</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500">ID (Unique)</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., wifi_password"
                                    value={newFact.id}
                                    onChange={e => setNewFact({ ...newFact, id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500">Category</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newFact.category}
                                    onChange={e => setNewFact({ ...newFact, category: e.target.value })}
                                >
                                    <option value="policy">Policy</option>
                                    <option value="amenity">Amenity</option>
                                    <option value="logistics">Logistics</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500">Content</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    rows={3}
                                    placeholder="Fact details..."
                                    value={newFact.content}
                                    onChange={e => setNewFact({ ...newFact, content: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-2">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleCreateFact} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Save Fact</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
