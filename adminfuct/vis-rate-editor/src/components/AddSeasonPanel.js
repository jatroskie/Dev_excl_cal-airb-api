// src/components/AddSeasonPanel.js

import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

function AddSeasonPanel({ unitType, onSave, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [weekdayRate, setWeekdayRate] = useState(0);
  const [weekendRate, setWeekendRate] = useState(0);
  const [minStay, setMinStay] = useState(1);
  
  // FIX: Removed the unused 'setCurrency' function
  const [currency] = useState('ZAR'); 

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate || !seasonName) {
      setError('Please fill out start date, end date, and season name.');
      return;
    }
    
    const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00Z'));
    const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T00:00:00Z'));

    if (startTimestamp >= endTimestamp) {
      setError('End date must be after the start date.');
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, "apartmentSeasonRates"), {
        unitType,
        startDate: startTimestamp,
        endDate: endTimestamp,
        seasonName,
        weekdayRateAgent: Number(weekdayRate),
        weekendRateAgent: Number(weekendRate),
        minStayNights: Number(minStay),
        currency,
        lastUpdatedAt: Timestamp.now()
        // Add any other required default fields here
      });
      onSave();
    } catch (err) {
      setError('Failed to save new season. Please try again.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Add First Season for {unitType}</h3>

        <form onSubmit={handleSave}>
          <div className="form-group date-range-group">
            <div>
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Season Name</label>
            <input type="text" placeholder="e.g., 2025/Opening Season" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} required />
          </div>
          <div className="form-group date-range-group">
            <div>
                <label>Weekday Rate ({currency})</label>
                <input type="number" value={weekdayRate} onChange={(e) => setWeekdayRate(e.target.value)} />
            </div>
            <div>
                <label>Weekend Rate ({currency})</label>
                <input type="number" value={weekendRate} onChange={(e) => setWeekendRate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Min Stay (Nights)</label>
            <input type="number" value={minStay} onChange={(e) => setMinStay(e.target.value)} />
          </div>

          <button type="submit" className="save-button" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Season'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default AddSeasonPanel;