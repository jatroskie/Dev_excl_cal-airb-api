import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Receive the new, pre-filtered prop 'unitTypesForForm'
function AddOverridePanel({ unitTypesForForm, onSave, onClose }) {
  
  // Initialize state using the first item from the *filtered* list.
  // This ensures the default selection is always correct for the current hotel.
  const [unitType, setUnitType] = useState(unitTypesForForm.length > 0 ? unitTypesForForm[0] : '');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [label, setLabel] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!unitType || !startDate || !endDate || !label) {
      setError('Please fill out all fields.');
      return;
    }

    const startTimestamp = Timestamp.fromDate(new Date(Date.UTC(...startDate.split('-').map((p, i) => i === 1 ? parseInt(p) - 1 : parseInt(p)))));
    const endParts = endDate.split('-').map((p, i) => i === 1 ? parseInt(p) - 1 : parseInt(p));
    const endDateObj = new Date(Date.UTC(endParts[0], endParts[1], endParts[2]));
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endTimestamp = Timestamp.fromDate(endDateObj);

    if (startTimestamp >= endTimestamp) {
        setError('End date must be after the start date.');
        return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, "rateOverrides"), {
        unitType, // This 'unitType' from state is now guaranteed to be correct
        startDate: startTimestamp,
        endDate: endTimestamp,
        adjustmentType,
        adjustmentValue: Number(adjustmentValue),
        label,
        createdAt: Timestamp.now()
      });
      onSave();
    } catch (err) {
      setError('Failed to save override. Please try again.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Add Rate Override</h3>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Unit Type</label>
            {/* The dropdown now correctly iterates over the filtered list */}
            <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
              {unitTypesForForm.map(ut => <option key={ut} value={ut}>{ut}</option>)}
            </select>
          </div>
          <div className="form-group date-range-group">
            <div>
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label>End Date (inclusive)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Label / Name</label>
            <input type="text" placeholder="e.g., Spring Sale" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Adjustment Type</label>
            <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>
          <div className="form-group">
            <label>Adjustment Value</label>
            <input type="number" step="any" placeholder="e.g., -15 for 15% off" value={adjustmentValue} onChange={(e) => setAdjustmentValue(e.target.value)} />
          </div>

          <button type="submit" className="save-button" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Override'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default AddOverridePanel;