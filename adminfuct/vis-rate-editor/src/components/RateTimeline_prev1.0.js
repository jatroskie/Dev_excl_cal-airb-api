import React from 'react';
import {
  format,
  addMonths,
  eachMonthOfInterval,
  getDaysInMonth,
  differenceInDays,
  max,
  min
} from 'date-fns';

const toDate = (timestamp) => timestamp.toDate();

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


// 3. The new color function
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
// Main Component
function RateTimeline({ unitTypes, ratesByUnitType, viewStartDate, onSelectSeason}) {
  const viewEndDate = addMonths(viewStartDate, 13);

  // Generate the 13 months for the header
  const monthsInView = eachMonthOfInterval({
    start: viewStartDate,
    end: addMonths(viewStartDate, 12),
  });

  const totalDaysInView = differenceInDays(viewEndDate, viewStartDate);

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

        return (
          <div key={unitType} className="timeline-row">
            <div className="timeline-label">{unitType}</div>
            <div className="timeline-container">
              {sortedSeasons.map((season) => {
                const seasonStart = toDate(season.startDate);
                const seasonEnd = toDate(season.endDate);

                // Clip the season dates to the view window
                const effectiveStart = max([seasonStart, viewStartDate]);
                const effectiveEnd = min([seasonEnd, viewEndDate]);
                
                if (effectiveStart >= effectiveEnd) return null; // Season is outside the view

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
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RateTimeline;