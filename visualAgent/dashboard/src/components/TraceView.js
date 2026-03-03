"use client";
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from '../lib/firebase';

export default function TraceView({ reservationId, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!reservationId) return;

        const q = query(
            collection(db, "reservations", reservationId, "audit_logs"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const logsData = [];
            querySnapshot.forEach((doc) => {
                logsData.push({ id: doc.id, ...doc.data() });
            });
            setLogs(logsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [reservationId]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end">
            <div className="bg-white w-1/3 h-full shadow-2xl p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Agent Trace</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕ Close</button>
                </div>

                {loading ? (
                    <p>Loading chain of thought...</p>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => (
                            <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span className="font-bold text-blue-700">{log.actor}</span>
                                    <span>{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Pending'}</span>
                                </div>
                                <p className="text-sm font-mono text-gray-800">{log.details}</p>
                            </div>
                        ))}

                        {logs.length === 0 && <p className="text-gray-400 italic">No traces found.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
