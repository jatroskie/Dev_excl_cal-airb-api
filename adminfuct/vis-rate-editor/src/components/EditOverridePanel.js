import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

function EditOverridePanel({ override, onSave, onClose }) {
  const [formData, setFormData] = useState({ ...override });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Convert Firestore Timestamps to YYYY-MM-DD format for the input fields
    const startDateStr = format(override.startDate.toDate(), 'yyyy-MM-dd');
    const endDateStr = format(override.endDate.toDate(), 'yyyy-MM-dd');
    setFormData({ ...override, startDate: startDateStr, endDate: endDateStr });
  }, [override]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'number' ? Number(value) : (type === 'checkbox' ? checked : value);
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const overrideRef = doc(db, "rateOverrides", override.id);
      
      const startTimestamp = Timestamp.fromDate(new Date(formData.startDate + 'T00:00:00Z'));
      const endTimestamp = Timestamp.fromDate(new Date(formData.endDate + 'T00:00:00Z'));

      await updateDoc(overrideRef, {
        label: formData.label,
        startDate: startTimestamp,
        endDate: endTimestamp,
        adjustmentType: formData.adjustmentType,
        adjustmentValue: Number(formData.adjustmentValue),
        overridesRestrictions: !!formData.overridesRestrictions,
        minStay: formData.overridesRestrictions ? Number(formData.minStay || 1) : null,
        maxStay: formData.overridesRestrictions ? Number(formData.maxStay || 30) : null,
        closedToArrival: formData.overridesRestrictions ? !!formData.closedToArrival : false,
        closedToDeparture: formData.overridesRestrictions ? !!formData.closedToDeparture : false
      });
      onSave();
    } catch (err) {
      setError('Failed to save changes.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete the override '${override.label}'?`)) {
      try {
        await deleteDoc(doc(db, "rateOverrides", override.id));
        onSave(); // Re-use onSave to trigger a refresh
      } catch (err) {
        setError('Failed to delete override.');
        console.error(err);
      }
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Edit Rate Override</h3>
        
        <div className="panel-info">
          <strong>Unit Type:</strong> {override.unitType}
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Label / Name</label>
            <input type="text" name="label" value={formData.label || ''} onChange={handleChange} required />
          </div>
          <div className="form-group date-range-group">
            <div>
              <label>Start Date</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
            </div>
            <div>
              <label>End Date (inclusive)</label>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Adjustment Type</label>
            <select name="adjustmentType" value={formData.adjustmentType} onChange={handleChange}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>
          <div className="form-group">
            <label>Adjustment Value</label>
            <input type="number" name="adjustmentValue" step="any" value={formData.adjustmentValue} onChange={handleChange} />
          </div>

          <div className="form-group" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" name="overridesRestrictions" checked={!!formData.overridesRestrictions} onChange={handleChange} id="overrideRestrEdit" />
              <label htmlFor="overrideRestrEdit" style={{ margin: 0, fontWeight: 'bold' }}>Override Yield Restrictions?</label>
            </div>
          </div>

          {formData.overridesRestrictions && (
            <>
              <div className="form-group date-range-group">
                <div>
                  <label>Min Stay (Nights)</label>
                  <input type="number" name="minStay" value={formData.minStay || 1} onChange={handleChange} />
                </div>
                <div>
                  <label>Max Stay (Nights)</label>
                  <input type="number" name="maxStay" value={formData.maxStay || 30} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group date-range-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                  <input type="checkbox" name="closedToArrival" checked={!!formData.closedToArrival} onChange={handleChange} id="ctaEditOverride" />
                  <label htmlFor="ctaEditOverride" style={{ margin: 0 }}>Closed to Arrival</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                  <input type="checkbox" name="closedToDeparture" checked={!!formData.closedToDeparture} onChange={handleChange} id="ctdEditOverride" />
                  <label htmlFor="ctdEditOverride" style={{ margin: 0 }}>Closed to Departure</label>
                </div>
              </div>
            </>
          )}

          <div className="button-group">
             <button type="button" className="delete-button" onClick={handleDelete}>Delete Override</button>
             <button type="submit" className="save-button" style={{gridColumn: '2 / -1'}} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
             </button>
          </div>
          
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default EditOverridePanel;