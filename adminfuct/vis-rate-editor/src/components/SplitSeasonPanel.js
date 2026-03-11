// src/components/SplitSeasonPanel.js

import React, { useState } from 'react';
import { doc, writeBatch, Timestamp, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

// This is the same helper function, local to this component for simplicity
const isOverlap = (newStart, newEnd, seasons, excludeId = null) => {
  const otherSeasons = seasons.filter(s => s.id !== excludeId);
  for (const season of otherSeasons) {
    const existingStart = season.startDate.toDate();
    const existingEnd = season.endDate.toDate();
    if (newStart < existingEnd && newEnd > existingStart) {
      return true;
    }
  }
  return false;
};

// Receive the new prop 'allSeasonsForUnit'
function SplitSeasonPanel({ originalSeason, allSeasonsForUnit, onSave, onClose }) {
  const [splitDate, setSplitDate] = useState('');
  
  const [newSeasonData, setNewSeasonData] = useState({
    seasonName: '',
    weekdayRateAgent: originalSeason.weekdayRateAgent || 0,
    weekendRateAgent: originalSeason.weekendRateAgent || 0,
    minStayNights: originalSeason.minStayNights || 1,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setNewSeasonData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSplit = async (e) => {
    e.preventDefault();
    setError('');
  
    if (!splitDate) {
      setError('Please enter a split date.');
      return;
    }

    const parsedSplitDate = new Date(splitDate + 'T00:00:00Z');
    const originalStartDate = originalSeason.startDate.toDate();
    const originalEndDate = originalSeason.endDate.toDate();

    if (parsedSplitDate <= originalStartDate || parsedSplitDate >= originalEndDate) {
      toast.error('Split date must be within the original season.');
      return;
    }

    // ====================================================================
    // THE FIX IS ON THIS LINE
    // The overlap check now correctly uses the 'allSeasonsForUnit' prop.
    // ====================================================================
    if (isOverlap(parsedSplitDate, originalEndDate, allSeasonsForUnit, originalSeason.id)) {
        toast.error("The new season created by this split would overlap with another existing season.");
        return;
    }
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      const originalSeasonRef = doc(db, "apartmentSeasonRates", originalSeason.id);
      batch.update(originalSeasonRef, { endDate: Timestamp.fromDate(parsedSplitDate) });

      const newSeasonRef = doc(collection(db, "apartmentSeasonRates"));
      
      const finalNewSeasonPayload = {
        ...originalSeason,
        ...newSeasonData,
        id: newSeasonRef.id,
        startDate: Timestamp.fromDate(parsedSplitDate),
        endDate: originalSeason.endDate,
        lastUpdatedAt: Timestamp.now(),
      };
      
      delete finalNewSeasonPayload.id; 

      batch.set(newSeasonRef, finalNewSeasonPayload);

      await batch.commit();
      toast.success("Season split successfully!");
      onSave();
    } catch (err) {
      setError('Failed to split season. Please try again.');
      toast.error('Failed to split season. Check console for details.');
      console.error("Split Season Error:", err);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Split Season: {originalSeason.seasonName}</h3>
        
        <p>This will end the current season on the selected date and start a new one.</p>

        <form onSubmit={handleSplit}>
          <div className="form-group">
            <label>New Season Start Date (Split Point)</label>
            <input type="date" value={splitDate} onChange={(e) => setSplitDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>New Season Name</label>
            <input type="text" name="seasonName" value={newSeasonData.seasonName} onChange={handleChange} required />
          </div>
          <div className="form-group date-range-group">
            <div>
              <label>New Weekday Rate</label>
              <input type="number" name="weekdayRateAgent" value={newSeasonData.weekdayRateAgent} onChange={handleChange} />
            </div>
            <div>
              <label>New Weekend Rate</label>
              <input type="number" name="weekendRateAgent" value={newSeasonData.weekendRateAgent} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>New Min Stay</label>
            <input type="number" name="minStayNights" value={newSeasonData.minStayNights} onChange={handleChange} />
          </div>
          
          <button type="submit" className="save-button" disabled={isSaving}>
            {isSaving ? 'Splitting...' : 'Confirm Split'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default SplitSeasonPanel;