// src/components/EditRatePanel.js

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

const toDate = (timestamp) => timestamp.toDate();

function EditRatePanel({ season, onSave, onClose, onSplit, onDelete }) {
  const [formData, setFormData] = useState({ ...season });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData({ ...season });
  }, [season]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

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
      onSave();
    } catch (err) {
      setError('Failed to save changes.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    const seasonName = season.seasonName || 'this season';
    if (window.confirm(`Are you sure you want to delete '${seasonName}'? This will merge it with the previous season and cannot be undone.`)) {
      onDelete(season);
    }
  };

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
          
          {/* --- NEW Button Group Layout --- */}
          <div className="button-group">
            <button type="button" className="delete-button" onClick={handleDelete}>
                Delete and Merge
            </button>
            <button type="button" className="split-button" onClick={() => onSplit(season)}>
                Split Season
            </button>
            <button type="submit" className="save-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default EditRatePanel;