// src/components/EditRatePanel.js

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

const toDate = (timestamp) => timestamp.toDate();

// The entire component logic must be inside this single function definition.
function EditRatePanel({ season, onSave, onClose, onSplit, onDelete }) {
  const [formData, setFormData] = useState({ ...season });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // This hook ensures the form updates if a new season is selected.
  useEffect(() => {
    setFormData({ ...season });
  }, [season]);

  // This function handles changes to the form inputs.
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  // This function handles the "Save Changes" action.
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const seasonRef = doc(db, "apartmentSeasonRates", season.id);
      const dataToUpdate = {
        seasonName: formData.seasonName,
        weekdayRateAgent: formData.weekdayRateAgent,
        weekendRateAgent: formData.weekendRateAgent,
        minStayNights: formData.minStayNights
      };
      await updateDoc(seasonRef, dataToUpdate);
      onSave(); // Trigger a re-fetch in the parent component
    } catch (err) {
      setError('Failed to save changes.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // This function handles the "Delete" action.
  const handleDelete = () => {
    const seasonName = season.seasonName || 'this season';
    if (window.confirm(`Are you sure you want to delete '${seasonName}'? This will merge it with the previous season and cannot be undone.`)) {
      onDelete(season);
    }
  };

  // The return statement renders the UI.
  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Edit Rate Season</h3>
        
        <div className="panel-info">
          <strong>Unit Type:</strong> {season.unitType}<br/>
          <strong>Period:</strong> {format(toDate(season.startDate), 'MMM d, yyyy')} - {format(toDate(season.endDate), 'MMM d, yyyy')}
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Season Name</label>
            <input type="text" name="seasonName" value={formData.seasonName || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Weekday Rate ({season.currency})</label>
            <input type="number" name="weekdayRateAgent" value={formData.weekdayRateAgent || 0} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Weekend Rate ({season.currency})</label>
            <input type="number" name="weekendRateAgent" value={formData.weekendRateAgent || 0} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Min Stay (Nights)</label>
            <input type="number" name="minStayNights" value={formData.minStayNights || 1} onChange={handleChange} />
          </div>
          <div className="button-group">
            <button type="button" className="delete-button" onClick={handleDelete}>
                Delete and Merge
            </button>
            <button type="button" className="split-button" onClick={() => onSplit(season)}>
                Split Season
            </button>
          </div>
          <hr className="divider" /> 
          <button type="submit" className="save-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default EditRatePanel;