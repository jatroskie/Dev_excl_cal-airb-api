// src/components/BulkEditPanel.js

import React, { useState } from 'react';

function BulkEditPanel({ selectedCount, onBulkUpdate, onClose }) {
  const [adjustmentType, setAdjustmentType] = useState('percentage');
  const [weekdayValue, setWeekdayValue] = useState(0);
  const [weekendValue, setWeekendValue] = useState(0);
  const [minStay, setMinStay] = useState(''); // Empty string means no change

  const [isSaving, setIsSaving] = useState(false);

  const handleApplyChanges = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const updatePayload = {
      adjustmentType,
      weekdayValue: Number(weekdayValue),
      weekendValue: Number(weekendValue),
      minStay: minStay === '' ? null : Number(minStay), // Send null if no change
    };

    await onBulkUpdate(updatePayload);
    // The parent will handle closing the panel on success
    setIsSaving(false);
  };

  return (
    <div className="bulk-edit-bar">
      <div className="bulk-edit-info">
        <strong>{selectedCount}</strong> seasons selected
      </div>
      <form className="bulk-edit-form" onSubmit={handleApplyChanges}>
        <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)}>
          <option value="percentage">Adjust Rate by %</option>
          <option value="fixed_amount">Adjust Rate by Fixed Amount</option>
        </select>
        <input 
          type="number" 
          placeholder="Weekday" 
          value={weekdayValue}
          onChange={e => setWeekdayValue(e.target.value)}
        />
        <input 
          type="number" 
          placeholder="Weekend" 
          value={weekendValue}
          onChange={e => setWeekendValue(e.target.value)}
        />
        <input 
          type="number" 
          placeholder="Min Stay (optional)" 
          value={minStay}
          onChange={e => setMinStay(e.target.value)}
        />
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Applying...' : 'Apply Changes'}
        </button>
      </form>
      <button className="close-bulk-edit" onClick={onClose}>×</button>
    </div>
  );
}

export default BulkEditPanel;