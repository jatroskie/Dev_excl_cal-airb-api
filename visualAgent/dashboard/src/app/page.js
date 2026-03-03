"use client";
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from '../lib/firebase';
import ReservationCard from '../components/ReservationCard';
import TraceView from '../components/TraceView';

export default function Home() {
  const [reservations, setReservations] = useState([]);
  const [selectedResId, setSelectedResId] = useState(null);
  const [stats, setStats] = useState({ total: 0, conflict: 0, unallocated: 0 });

  useEffect(() => {
    // Listen to Reservations
    const q = query(collection(db, "reservations"), orderBy("created_at", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      let conflictCount = 0;
      let unallocatedCount = 0;

      snapshot.forEach((doc) => {
        const res = { id: doc.id, ...doc.data() };
        data.push(res);

        // Stats Logic
        if (!res.synced_to_opera && res.channel === 'Airbnb' && res.status === 'confirmed') conflictCount++;
        if (res.unallocated) unallocatedCount++;
      });

      setReservations(data);
      setStats({
        total: data.length,
        conflict: conflictCount,
        unallocated: unallocatedCount
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow p-4 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Flight Control <span className="text-sm font-normal text-gray-500">| Agentic PMS</span></h1>

          <div className="flex space-x-4 items-center">
            <a href="/knowledge-base" className="px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 font-bold">
              🤖 Agent Trainer
            </a>
            <div className="px-4 py-2 bg-blue-50 rounded text-center">
              <span className="block text-2xl font-bold text-blue-600">{stats.total}</span>
              <span className="text-xs text-blue-400">Total Bookings</span>
            </div>

            <div className={`px-4 py-2 rounded text-center ${stats.unallocated > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <span className={`block text-2xl font-bold ${stats.unallocated > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{stats.unallocated}</span>
              <span className="text-xs text-gray-500">Unallocated</span>
            </div>

            <div className={`px-4 py-2 rounded text-center ${stats.conflict > 0 ? 'bg-red-50 animate-pulse' : 'bg-green-50'}`}>
              <span className={`block text-2xl font-bold ${stats.conflict > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.conflict}</span>
              <span className="text-xs text-gray-500">Conflicts</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4">

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Column 1: Attention Required */}
          <div className="col-span-3 lg:col-span-3">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Live Feed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {reservations.map(res => (
                <ReservationCard
                  key={res.id}
                  reservation={res}
                  onClick={() => setSelectedResId(res.id)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Trace View Overlay */}
      {selectedResId && (
        <TraceView
          reservationId={selectedResId}
          onClose={() => setSelectedResId(null)}
        />
      )}
    </main>
  );
}
