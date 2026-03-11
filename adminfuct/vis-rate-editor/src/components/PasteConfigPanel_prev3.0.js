// src/components/PasteConfigPanel.js

import React, { useState, useEffect, useMemo } from 'react';
import { getYear } from 'date-fns';

function PasteConfigPanel({ clipboard, targetUnitType, allRates, onConfirm, onClose }) {
  // --- STATE ---
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);
  const [adjustmentType, setAdjustmentType] = useState('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState(10); // Default to 10% increase
  const [updateNames, setUpdateNames] = useState(true);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // --- DERIVED STATE & MEMOS ---
  // Check if the target year already has seasons for this unit type.
  const targetHasExistingSeasons = useMemo(() => {
    const seasonsForTarget = allRates.filter(r => r.unitType === targetUnitType);
    return seasonsForTarget.some(s => {
      const startYear = getYear(s.startDate.toDate());
      const endYear = getYear(s.endDate.toDate());
      // Check if the season touches the target year at all.
      return startYear === targetYear || endYear === targetYear;
    });
  }, [allRates, targetUnitType, targetYear]);

  // --- HANDLERS ---
  const handleConfirmPaste = async (e) => {
    e.preventDefault();
    setIsPasting(true);

    const config = {
      targetUnitType,
      targetYear,
      adjustmentType,
      adjustmentValue: Number(adjustmentValue),
      updateNames,
      allowOverwrite,
      sourceData: clipboard
    };

    // onConfirm is the async function from RateEditor that does the batch write
    await onConfirm(config); 
    
    // No need to set isPasting(false) as the component will be unmounted on success.
  };
  
  // --- RENDER ---
  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Paste Rate Structure</h3>

        <div className="panel-info">
          <strong>Source:</strong> {clipboard.sourceUnitType} (Year {clipboard.sourceYear})<br/>
          <strong>Destination:</strong> {targetUnitType}
        </div>

        <form onSubmit={handleConfirmPaste}>
          <div className="form-group">
            <label>Target Year</label>
            <select value={targetYear} onChange={e => setTargetYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026, 2027, 2028, 2029].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          <div className="form-group date-range-group">
            <div>
                <label>Adjustment Type</label>
                <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount</option>
                </select>
            </div>
            <div>
                <label>Adjustment Value</label>
                <input type="number" step="any" value={adjustmentValue} onChange={e => setAdjustmentValue(e.target.value)} />
            </div>
          </div>

          <div className="form-group-checkbox">
            <input type="checkbox" id="updateNames" checked={updateNames} onChange={e => setUpdateNames(e.target.checked)} />
            <label htmlFor="updateNames">Automatically update season names (e.g., "2026/Name" to "2027/Name")</label>
          </div>
          
          {targetHasExistingSeasons && (
            <div className="warning-box">
              <p>⚠️ **Warning:** The target year already contains rate seasons. Pasting will delete them.</p>
              <div className="form-group-checkbox">
                <input type="checkbox" id="allowOverwrite" checked={allowOverwrite} onChange={e => setAllowOverwrite(e.target.checked)} />
                <label htmlFor="allowOverwrite">I understand and want to overwrite the existing seasons.</label>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="save-button" 
            disabled={isPasting || (targetHasExistingSeasons && !allowOverwrite)}
          >
            {isPasting ? 'Pasting...' : 'Confirm and Paste'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PasteConfigPanel;