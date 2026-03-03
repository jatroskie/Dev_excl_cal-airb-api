"use client";
import React from 'react';

export default function ReservationCard({ reservation, onClick }) {
    const { guest_name, channel, status, start_date, unallocated, total_price, synced_to_opera } = reservation;

    // Logic for Visual Indicators
    const isConflict = !synced_to_opera && channel === 'Airbnb' && status === 'confirmed';
    const isUnallocated = unallocated;

    // Style classes
    let cardClass = "p-4 border rounded shadow-md cursor-pointer transition-all duration-300 ";

    if (isConflict) {
        cardClass += "bg-red-100 border-red-500 animate-pulse"; // Red/Pulsing for conflict
    } else if (isUnallocated) {
        cardClass += "bg-blue-100 border-blue-500"; // Blue for unallocated
    } else {
        cardClass += "bg-white border-gray-200 hover:shadow-lg";
    }

    return (
        <div className={cardClass} onClick={onClick}>
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{guest_name}</h3>
                <span className="text-xs font-mono bg-gray-200 px-1 rounded">{channel}</span>
            </div>

            <div className="text-sm text-gray-700">
                <p>In: {start_date}</p>
                <p>Status: {status}</p>
                {isConflict && <p className="text-red-600 font-bold mt-1">⚠ SYNC ERROR</p>}
                {isUnallocated && <p className="text-blue-600 font-bold mt-1">⚠ UNALLOCATED</p>}
            </div>
        </div>
    );
}
