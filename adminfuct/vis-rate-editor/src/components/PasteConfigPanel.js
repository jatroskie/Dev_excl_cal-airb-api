// src/components/PasteConfigPanel.js

import React, { useState, useMemo } from 'react';

function PasteConfigPanel({ clipboard, targetUnitType, allRates, onConfirm, onClose }) {
  // --- UPDATED STATE: Replaced shiftUnit with a simpler concept ---
  const [shiftValue, setShiftValue] = useState(clipboard.seasons.length); // Default to shifting by the number of seasons copied

  const [adjustmentType, setAdjustmentType] = useState('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState(10);
  const [updateNames, setUpdateNames] = useState(true);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const targetHasExistingSeasons = useMemo(() => {
    return allRates.some(r => r.unitType === targetUnitType);
  }, [allRates, targetUnitType]);

  const handleConfirmPaste = async (e) => {
    e.preventDefault();
    setIsPasting(true);

    const config = {
      targetUnitType,
      shiftBySeasons: Number(shiftValue), // Pass the number of seasons to shift by
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
          {/* --- NEW SIMPLIFIED "Paste Starting" Input --- */}
          <div className="form-group">
            <label>Paste After</label>
            <div className="multi-input-group">
              <input type="number" value={shiftValue} onChange={e => setShiftValue(e.target.value)} style={{flex: 1}} />
              <span style={{flex: 3}}>Rate Seasons from original start date</span>
            </div>
          </div>
          
          <div className="form-group date-range-group">
            <label>Adjustment Type</label>
            <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
            <label>Adjustment Value</label>
            <input type="number" step="any" placeholder="e.g., -15" value={adjustmentValue} onChange={(e) => setAdjustmentValue(e.target.value)} />
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