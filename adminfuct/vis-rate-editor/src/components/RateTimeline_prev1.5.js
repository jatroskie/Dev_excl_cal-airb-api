import React from 'react';
import {
  format,
  addMonths,
  eachMonthOfInterval,
  getDaysInMonth,
  differenceInDays,
  max,
  min,
} from 'date-fns';

// Import the BoundaryHandle component
import BoundaryHandle from './BoundaryHandle';

// Helper to convert Firestore Timestamp to JS Date
const toDate = (timestamp) => timestamp.toDate();


// --- The Color Logic Section ---

// 1. Define specific colors for known season name keywords. Case-insensitive.
const KEYWORD_COLORS = {
  'superhigh': '#FFD700', // Bright Gold for SuperHigh
  'high':      '#FFA500', // Orange for High
  'summer':    '#FFC0CB', // A light Pink for Summer
  'mid':       '#90EE90', // Light Green for Mid
  'low':       '#ADD8E6', // Light Blue for Low
};

// 2. Define fallback palettes for any other season names.
const SUMMER_FALLBACK_PALETTE = [
  '#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#F78C6B'
];
const WINTER_FALLBACK_PALETTE = [
  '#A94A4A', '#C9A136', '#05A67D', '#0E6C8A', '#D76C4B'
];

// 3. The main color function for base seasons
const stringToColor = (seasonName, seasonStartDate) => {
  if (!seasonName) return '#4A5568'; // Neutral dark gray for unnamed seasons

  const lowerCaseName = seasonName.toLowerCase();
  
  // First, check for keywords
  for (const keyword in KEYWORD_COLORS) {
    if (lowerCaseName.includes(keyword)) {
      return KEYWORD_COLORS[keyword];
    }
  }

  // If no keyword is found, use the fallback palettes
  const month = seasonStartDate.getMonth(); // 0 = Jan, 11 = Dec
  const isSummer = (month >= 9 || month <= 2); // Oct-Mar
  const palette = isSummer ? SUMMER_FALLBACK_PALETTE : WINTER_FALLBACK_PALETTE;
  
  // Use a simple hash to pick from the fallback palette
  let hash = 0;
  for (let i = 0; i < lowerCaseName.length; i++) {
    hash = lowerCaseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % palette.length);
  
  return palette[index];
};


// --- The Main Component ---

// The function signature now accepts the 'overridesByUnitType' prop
function RateTimeline({ unitTypes, ratesByUnitType, overridesByUnitType, viewStartDate, onSelectSeason, onBoundaryDrag }) {
  const viewEndDate = addMonths(viewStartDate, 13);

  const monthsInView = eachMonthOfInterval({
    start: viewStartDate,
    end: addMonths(viewStartDate, 12),
  });

  const totalDaysInView = differenceInDays(viewEndDate, viewStartDate);

  // Approximate width calculation for pixels-per-day ratio
  const timelineContainerWidth = window.innerWidth * 0.98 * 0.8;
  const pixelsPerDay = timelineContainerWidth / totalDaysInView;

  return (
    <div className="timeline-grid">
      {/* Timeline Header */}
      <div className="timeline-row header">
        <div className="timeline-label">Unit Type</div>
        <div className="timeline-container">
          {monthsInView.map((month) => {
            const days = getDaysInMonth(month);
            const width = (days / totalDaysInView) * 100;
            return (
              <div key={format(month, 'yyyy-MM')} className="month-header" style={{ width: `${width}%` }}>
                {format(month, 'MMM yyyy')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Rows for each Unit Type */}
      {unitTypes.map((unitType) => {
        const seasons = ratesByUnitType[unitType] || [];
        const sortedSeasons = seasons.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());

        // Get the overrides for this specific unit type
        const overrides = overridesByUnitType[unitType] || [];

        return (
          <div key={unitType} className="timeline-row">
            <div className="timeline-label">{unitType}</div>
            <div className="timeline-container">
              
              {/* Render Rate Blocks */}
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

                const tooltip = `Season: ${season.seasonName || 'N/A'}\n` +
                                `Dates: ${format(seasonStart, 'yyyy-MM-dd')} - ${format(seasonEnd, 'yyyy-MM-dd')}\n` +
                                `Rate: ${season.weekdayRateAgent} / ${season.weekendRateAgent} ${season.currency}\n` +
                                `Min Stay: ${season.minStayNights}`;
                
                return (
                  <div
                    key={season.id}
                    className="rate-block"
                    onClick={() => onSelectSeason(season)}
                    style={{
                      left: `${offsetPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: stringToColor(season.seasonName, seasonStart),
                    }}
                    title={tooltip}
                  >
                    <span className="rate-block-label">{season.seasonName}</span>
                  </div>
                );
              })}

              {/* Render Boundary Handles */}
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

              {/* NEW: Render Override Bars */}
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
                
                const overrideColor = override.adjustmentValue < 0 ? '#48BB78' : '#F56565'; // Green for discount, Red for surcharge
                
                const tooltip = `OVERRIDE: ${override.label}\n` +
                                `Adjustment: ${override.adjustmentValue}${override.adjustmentType === 'percentage' ? '%' : ''}\n` +
                                `Dates: ${format(overrideStart, 'yyyy-MM-dd')} - ${format(overrideEnd, 'yyyy-MM-dd')}`;

                return (
                  <div
                    key={override.id}
                    className="override-block"
                    style={{
                      left: `${offsetPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: overrideColor,
                    }}
                    title={tooltip}
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