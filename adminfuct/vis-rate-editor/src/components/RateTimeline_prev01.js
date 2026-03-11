import React, { useMemo } from 'react';
import { startOfYear, endOfYear, differenceInDays } from 'date-fns';

// A simple function to generate a color from a string
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

// Helper to convert Firestore Timestamp to JS Date
const toDate = (timestamp) => timestamp.toDate();

function RateTimeline({ unitType, seasons, year }) {

  const validationResult = useMemo(() => {
    if (seasons.length === 0) {
      return { isValid: false, message: "No rate seasons found for this year.", sortedSeasons: [] };
    }

    // Sort seasons by start date to ensure correct order
    const sortedSeasons = [...seasons].sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());

    // Check 1: The first season must start on Jan 1st
    const yearStart = startOfYear(new Date(year, 0, 1));
    if (toDate(sortedSeasons[0].startDate).getTime() !== yearStart.getTime()) {
      return { 
        isValid: false, 
        message: `Error: First season starts on ${toDate(sortedSeasons[0].startDate).toLocaleDateString()}, not Jan 1st.`,
        sortedSeasons
      };
    }
    
    // Check 2: Check for gaps or overlaps between seasons
    for (let i = 0; i < sortedSeasons.length - 1; i++) {
      const currentSeasonEnd = toDate(sortedSeasons[i].endDate);
      const nextSeasonStart = toDate(sortedSeasons[i+1].startDate);
      if (currentSeasonEnd.getTime() !== nextSeasonStart.getTime()) {
        return { 
          isValid: false, 
          message: `Error: Gap/Overlap found after '${sortedSeasons[i].seasonName}' ending ${currentSeasonEnd.toLocaleDateString()}.`,
          sortedSeasons
        };
      }
    }
    
    // Check 3: The last season must end on Jan 1st of the next year
    const nextYearStart = startOfYear(new Date(year + 1, 0, 1));
    const lastSeasonEnd = toDate(sortedSeasons[sortedSeasons.length - 1].endDate);
    if (lastSeasonEnd.getTime() !== nextYearStart.getTime()) {
      return { 
        isValid: false, 
        message: `Error: Last season ends on ${lastSeasonEnd.toLocaleDateString()}, not Jan 1st of next year.`,
        sortedSeasons
      };
    }

    return { isValid: true, message: "OK", sortedSeasons };
  }, [seasons, year]);
  
  const totalDaysInYear = differenceInDays(endOfYear(new Date(year, 0, 1)), startOfYear(new Date(year, 0, 1))) + 1;

  return (
    <div className="timeline-row">
      <div className="timeline-label">{unitType}</div>
      <div className="timeline-container">
        {!validationResult.isValid ? (
          <div className="validation-error">{validationResult.message}</div>
        ) : (
          validationResult.sortedSeasons.map(season => {
            const duration = differenceInDays(toDate(season.endDate), toDate(season.startDate));
            const flexGrow = duration / totalDaysInYear;
            const tooltip = `Season: ${season.seasonName}\n` +
                            `Dates: ${toDate(season.startDate).toLocaleDateString()} - ${toDate(season.endDate).toLocaleDateString()}\n` +
                            `Weekday: ${season.weekdayRateAgent} ${season.currency}\n` +
                            `Weekend: ${season.weekendRateAgent} ${season.currency}\n` +
                            `Min Stay: ${season.minStayNights} nights`;

            return (
              <div
                key={season.id}
                className="rate-block"
                style={{
                  flexGrow: flexGrow,
                  backgroundColor: stringToColor(season.seasonName || season.id),
                }}
                title={tooltip}
              >
                {season.seasonName}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RateTimeline;