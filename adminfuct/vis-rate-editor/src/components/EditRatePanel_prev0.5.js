import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

const toDate = (timestamp) => timestamp.toDate();

function EditRatePanel({ season, onSave, onClose, onSplit, onDelete }) {
  const [formData, setFormData] = useState({ ...season });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Update form data if a different season is selected
  useEffect(() => {
    setFormData({ ...season });
  }, [season]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    // Handle numbers separately
    const val = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleDelete = () => {
    // We'll add a confirmation dialog to prevent accidental deletion
    const seasonName = season.seasonName || 'this season';
    if (window.confirm(`Are you sure you want to delete '${seasonName}'? This will merge it with the previous season and cannot be undone.`)) {
      onDelete(season);
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        {/* ... existing close button and info div ... */}

        <form onSubmit={handleSave}>
          {/* ... all existing form groups ... */}
          
          <div className="button-group">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="split-button" onClick={() => onSplit(season)}>
              Split Season
            </button>
          </div>
          {/* Add a separator and the new delete button */}
          <hr className="divider" /> 
          <button type="button" className="delete-button" onClick={handleDelete}>
            Delete and Merge
          </button>

          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const seasonRef = doc(db, "apartmentSeasonRates", season.id);
      
      // We only want to update the fields that can be changed in this form
      const dataToUpdate = {
        seasonName: formData.seasonName,
        weekdayRateAgent: formData.weekdayRateAgent,
        weekendRateAgent: formData.weekendRateAgent,
        minStayNights: formData.minStayNights
      };

      await updateDoc(seasonRef, dataToUpdate);
      onSave({ ...season, ...dataToUpdate }); // Update the parent state immediately
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      console.error(err);
    } finally {
      setIsSaving(false);
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
          
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="split-button" onClick={() => onSplit(season)}>
              Split Season
            </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default EditRatePanel;