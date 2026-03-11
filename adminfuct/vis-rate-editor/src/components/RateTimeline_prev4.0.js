// src/components/RateTimeline.js

import React, { useState, useEffect } from 'react';
import {
  format,
  addMonths,
  eachMonthOfInterval,
  getDaysInMonth,
  differenceInDays,
  max,
  min,
} from 'date-fns';
import BoundaryHandle from './BoundaryHandle';

// Helper to convert Firestore Timestamp to JS Date
const toDate = (timestamp) => timestamp.toDate();

// Helper for calculating text color based on background brightness
function getBrightness(hexColor) {
    if (!hexColor || hexColor.length < 7) return 0;
    try {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    } catch (e) {
        return 0;
    }
}

// Color generation logic
const KEYWORD_COLORS = { 'superhigh': '#FFD700', 'high': '#FFA500', 'summer': '#FFC0CB', 'mid': '#90EE90', 'low': '#ADD8E6' };
const SUMMER_FALLBACK_PALETTE = ['#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#F78C6B'];
const WINTER_FALLBACK_PALETTE = ['#A94A4A', '#C9A136', '#05A67D', '#0E6C8A', '#D76C4B'];
const stringToColor = (seasonName, seasonStartDate) => {
    if (!seasonName) return '#4A5568';
    const lowerCaseName = seasonName.toLowerCase();
    for (const keyword in KEYWORD_COLORS) { if (lowerCaseName.includes(keyword)) { return KEYWORD_COLORS[keyword]; } }
    const month = seasonStartDate.getMonth();
    const isSummer = (month >= 9 || month <= 2);
    const palette = isSummer ? SUMMER_FALLBACK_PALETTE : WINTER_FALLBACK_PALETTE;
    let hash = 0;
    for (let i = 0; i < lowerCaseName.length; i++) { hash = lowerCaseName.charCodeAt(i) + ((hash << 5) - hash); }
    const index = Math.abs(hash % palette.length);
    return palette[index];
};

// Context Menu sub-component
const ContextMenu = ({ x, y, options, onClose }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);
  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <ul>{options.map(option => (<li key={option.label} onClick={option.action}>{option.label}</li>))}</ul>
    </div>
  );
};


// Main RateTimeline component
function RateTimeline({ 
  unitTypes, 
  ratesByUnitType, 
  overridesByUnitType, 
  viewStartDate, 
  onSelectSeason, 
  onBoundaryDrag, 
  onSelectOverride,
  clipboard, 
  onCopySeasons, 
  onInitiatePaste,
  onAddSeason,
  onToggleSeasonSelect,
  selectedSeasons
}) {
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e, unitType, clickedSeason) => {
    e.preventDefault();
    e.stopPropagation();
    const allSeasonsForUnit = (ratesByUnitType[unitType] || []).sort((a,b) => a.startDate.toMillis() - b.startDate.toMillis());
    const options = [];

    if (clickedSeason) {
      const clickedIndex = allSeasonsForUnit.findIndex(s => s.id === clickedSeason.id);
      if (clickedIndex !== -1) {
        const seasonsToCopy = allSeasonsForUnit.slice(clickedIndex, clickedIndex + 4);
        options.push({
          label: `Copy Next ${seasonsToCopy.length} Seasons`,
          action: () => { onCopySeasons(seasonsToCopy, unitType, `Next ${seasonsToCopy.length}`); setContextMenu(null); }
        });
      }
    }
    
    const seasonsInView = allSeasonsForUnit.filter(s => {
      const sStart = s.startDate.toDate();
      const sEnd = s.endDate.toDate();
      return sStart < addMonths(viewStartDate, 13) && sEnd > viewStartDate;
    });
    if (seasonsInView.length > 0) {
      options.push({
        label: `Copy All ${seasonsInView.length} Seasons in View`,
        action: () => { onCopySeasons(seasonsInView, unitType, `${seasonsInView.length} in View`); setContextMenu(null); }
      });
    }

    if (clipboard) {
      options.push({ label: `Paste '${clipboard.modeLabel}' here`, action: () => { onInitiatePaste(unitType); setContextMenu(null); } });
    }
    
    if(options.length > 0) {
      setContextMenu({ x: e.pageX, y: e.pageY, options });
    }
  };

  if (!ratesByUnitType || !overridesByUnitType) return null;

  const viewEndDate = addMonths(viewStartDate, 13);
  const monthsInView = eachMonthOfInterval({ start: viewStartDate, end: addMonths(viewStartDate, 12) });
  const totalDaysInView = differenceInDays(viewEndDate, viewStartDate);
  const pixelsPerDay = (window.innerWidth * 0.98 * 0.8) / totalDaysInView;

  return (
    <div className="timeline-grid" onClick={() => setContextMenu(null)}>
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      <div className="timeline-row header">
        <div className="timeline-label">Unit Type</div>
        <div className="timeline-container">
          {monthsInView.map((month) => {
            const days = getDaysInMonth(month);
            const width = (days / totalDaysInView) * 100;
            return (<div key={format(month, 'yyyy-MM')} className="month-header" style={{ width: `${width}%` }}>{format(month, 'MMM yyyy')}</div>);
          })}
        </div>
      </div>

      {unitTypes.map((unitType) => {
        const seasons = ratesByUnitType[unitType] || [];
        const sortedSeasons = seasons.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
        const overrides = overridesByUnitType[unitType] || [];
        const isCopiedSource = clipboard?.sourceUnitType === unitType;
        const rowClassName = `timeline-row ${isCopiedSource ? 'copied-source' : ''}`;

        return (
          <div key={unitType} className={rowClassName} onContextMenu={(e) => handleContextMenu(e, unitType, null)}>
            <div className="timeline-label">{unitType}</div>
            <div className="timeline-container">

              {/* ==================================================================== */}
              {/* CHANGE START: Conditional Rendering for Empty State                 */}
              {/* ==================================================================== */}
              {sortedSeasons.length === 0 ? (
                <div className="empty-state-prompt" onClick={() => onAddSeason(unitType)}>
                  No seasons defined. Click to add the first season.
                </div>
              ) : (
                <>
                  {sortedSeasons.map((season) => {
                    const seasonStart = toDate(season.startDate);
                    const seasonEnd = toDate(season.endDate);
                    const effectiveStart = max([seasonStart, viewStartDate]);
                    const effectiveEnd = min([seasonEnd, viewEndDate]);
                    if (effectiveStart >= effectiveEnd) return null;
                    const offsetDays = differenceInDays(effectiveStart, viewStartDate);
                    const durationDays = differenceInDays(effectiveEnd, effectiveStart);
                    const offsetPercent = (offsetDays / totalDaysInView) * 100;
                    const widthPercent = (durationDays / totalDaysInView) * 100;
                    const backgroundColor = stringToColor(season.seasonName, seasonStart);
                    const textColor = getBrightness(backgroundColor) > 150 ? '#000000' : '#FFFFFF';
                    const isSelected = selectedSeasons.has(season.id);
                    const blockClassName = `rate-block ${isSelected ? 'selected' : ''}`;
                    const tooltip = `Season: ${season.seasonName || 'N/A'}\nDates: ${format(seasonStart, 'yyyy-MM-dd')} - ${format(seasonEnd, 'yyyy-MM-dd')}\nRate: ${season.weekdayRateAgent} / ${season.weekendRateAgent} ${season.currency}\nMin Stay: ${season.minStayNights}`;
                    return (
                      <div 
                        key={season.id} 
                        className="rate-block" 
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) { // Check for Ctrl or Cmd key
                            e.stopPropagation(); // Prevent opening edit panel
                            onToggleSeasonSelect(season.id);
                          } else {
                            onSelectSeason(season);
                          }
                        }}
                        style={{ left: `${offsetPercent}%`, width: `${widthPercent}%`, backgroundColor: backgroundColor, color: textColor }} 
                        title="Hold Ctrl/Cmd and click to multi-select"
                        onContextMenu={(e) => handleContextMenu(e, unitType, season)}
                      >
                        <span className="rate-block-label" style={{ textShadow: textColor === '#FFFFFF' ? '1px 1px 2px black' : 'none' }}>{season.seasonName}</span>
                      </div>
                    );
                  })}

                  {sortedSeasons.map((leftSeason, index) => {
                    if (index >= sortedSeasons.length - 1) return null;
                    const rightSeason = sortedSeasons[index + 1];
                    const boundaryDate = toDate(rightSeason.startDate);
                    if (boundaryDate < viewStartDate || boundaryDate > viewEndDate) return null;
                    const offsetDays = differenceInDays(boundaryDate, viewStartDate);
                    const offsetPercent = (offsetDays / totalDaysInView) * 100;
                    return (
                      <div key={`${leftSeason.id}-handle`} style={{ position: 'absolute', left: `${offsetPercent}%`, height: '100%' }}>
                        <BoundaryHandle
                          leftSeason={leftSeason}
                          rightSeason={rightSeason}
                          pixelsPerDay={pixelsPerDay}
                          onDragStop={onBoundaryDrag}
                        />
                      </div>
                    );
                  })}
                </>
              )}
              {/* ==================================================================== */}
              {/* CHANGE END                                                          */}
              {/* ==================================================================== */}
              
              {overrides.map((override) => {
                const overrideStart = toDate(override.startDate);
                const overrideEnd = toDate(override.endDate);
                const effectiveStart = max([overrideStart, viewStartDate]);
                const effectiveEnd = min([overrideEnd, viewEndDate]);
                if (effectiveStart >= effectiveEnd) return null;
                const offsetDays = differenceInDays(effectiveStart, viewStartDate);
                const durationDays = differenceInDays(effectiveEnd, effectiveStart);
                const offsetPercent = (offsetDays / totalDaysInView) * 100;
                const widthPercent = (durationDays / totalDaysInView) * 100;
                const overrideColor = override.adjustmentValue < 0 ? '#48BB78' : '#F56565';
                const tooltip = `OVERRIDE: ${override.label}\nAdjustment: ${override.adjustmentValue}${override.adjustmentType === 'percentage' ? '%' : ''}\nDates: ${format(overrideStart, 'yyyy-MM-dd')} - ${format(overrideEnd, 'yyyy-MM-dd')}`;
                return (
                  <div
                    key={override.id}
                    className="override-block"
                    style={{ left: `${offsetPercent}%`, width: `${widthPercent}%`, backgroundColor: overrideColor }}
                    title={tooltip}
                    onClick={() => onSelectOverride(override)}
                  >
                    <span className="override-block-label">{override.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RateTimeline;