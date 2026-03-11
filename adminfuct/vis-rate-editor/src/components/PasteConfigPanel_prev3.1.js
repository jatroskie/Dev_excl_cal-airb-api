// src/components/PasteConfigPanel.js

import React, { useState, useMemo } from 'react';
import { getYear } from 'date-fns';

function PasteConfigPanel({ clipboard, targetUnitType, allRates, onConfirm, onClose }) {
  // --- NEW STATE for Relative Shift ---
  const [shiftValue, setShiftValue] = useState(1);
  const [shiftUnit, setShiftUnit] = useState('years');

  // --- Other state ---
  const [adjustmentType, setAdjustmentType] = useState('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState(10);
  const [updateNames, setUpdateNames] = useState(true);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // --- This logic is now handled inside RateEditor, but we keep the memo for the warning ---
  const targetHasExistingSeasons = useMemo(() => {
    // This is a simplified check for the warning. The real check is in RateEditor.
    return allRates.some(r => r.unitType === targetUnitType);
  }, [allRates, targetUnitType]);

  const handleConfirmPaste = async (e) => {
    e.preventDefault();
    setIsPasting(true);

    const config = {
      targetUnitType,
      shiftValue: Number(shiftValue),
      shiftUnit,
      adjustmentType,
      adjustmentValue: Number(adjustmentValue),
      updateNames,
      allowOverwrite,
      sourceData: clipboard
    };
    
    await onConfirm(config);
  };
  
  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Paste Rate Structure</h3>

        <div className="panel-info">
          <strong>Source:</strong> {clipboard.sourceUnitType} ({clipboard.modeLabel})<br/>
          <strong>Destination:</strong> {targetUnitType}
        </div>

        <form onSubmit={handleConfirmPaste}>
          {/* --- NEW Relative Shift Inputs --- */}
          <div className="form-group">
            <label>Paste Starting</label>
            <div className="multi-input-group">
              <input type="number" value={shiftValue} onChange={e => setShiftValue(e.target.value)} style={{flex: 1}} />
              <select value={shiftUnit} onChange={e => setShiftUnit(e.target.value)} style={{flex: 2}}>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
              <span> from original start date</span>
            </div>
          </div>
          
          <div className="form-group date-range-group">
             <label>Adjustment Type</label>
                <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount</option>
                </select>
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