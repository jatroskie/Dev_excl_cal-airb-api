// src/components/RateEditor.js

import React, { useState, useEffect, useMemo } from 'react'; // <-- Includes useState
import { collection, getDocs, query, where, Timestamp, orderBy, writeBatch, doc } from "firebase/firestore";
import { db, auth } from '../firebase';
import RateTimeline from './RateTimeline';
import { startOfMonth, addMonths, getYear, getMonth, addDays } from 'date-fns';
import EditRatePanel from './EditRatePanel'; // <-- Import the new panel
import SplitSeasonPanel from './SplitSeasonPanel';
import AddOverridePanel from './AddOverridePanel';

// Helper function to calculate unitType based on the new rules
const getUnitTypeForRoom = (roomData) => {
  const { hotelCode, propRate, actType } = roomData;
  if (!actType) return null;

  if (hotelCode === 'TBA' || hotelCode === 'TTBH') {
    // Method B: propRate + actType (e.g., "sup1-BR")
    if (!propRate) return null;
    const cleanActType = actType.replace(/[^a-zA-Z0-9]/g, ''); // Removes hyphens, spaces, etc.
    return `${propRate}${cleanActType}`; // e.g. sup1BR, stdStudio
  } else {
    // Method A: hotelCode + actType (e.g., "WFV-1-BR")
    if (!hotelCode) return null;
    return `${hotelCode}-${actType}`;
  }
};

function RateEditor() {
  const [unitTypes, setUnitTypes] = useState([]);
  const [rates, setRates] = useState([]);
  const [allHotelCodes, setAllHotelCodes] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [startDisplayDate, setStartDisplayDate] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New state for the editing panel
  const [editingSeason, setEditingSeason] = useState(null);
  const [splittingSeason, setSplittingSeason] = useState(null);
  const [isAddingOverride, setIsAddingOverride] = useState(false);
  const [overrides, setOverrides] = useState([]);

   // --- NEW HOOK 1: Fetch Initial Hotel and Unit Type Data (Runs once) ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError('');
      try {
        const roomsSnapshot = await getDocs(collection(db, "rooms"));
        const hotelCodes = new Set();
        const types = new Set();

        roomsSnapshot.forEach(doc => {
          const roomData = doc.data();
          if (roomData.hotelCode) hotelCodes.add(roomData.hotelCode);
          
          const unitType = getUnitTypeForRoom(roomData);
          if (unitType) types.add(unitType);
        });
        
        const sortedHotelCodes = Array.from(hotelCodes).sort();
        setAllHotelCodes(sortedHotelCodes);
        if (sortedHotelCodes.length > 0) {
          // This is the key: we set the first hotel, which will trigger the second hook.
          setSelectedHotel(sortedHotelCodes[0]);
        }
        
        setUnitTypes(Array.from(types).sort());
      } catch (err) {
        console.error("CRITICAL ERROR in fetchInitialData:", err);
        setError("Failed to load initial hotel data. Check console.");
      }
      // Do not set loading to false here, let the next hook do it.
    };
    fetchInitialData();
  }, []); // Empty dependency array means this runs only once on mount.


  // --- NEW HOOK 2: Fetch Rate Data (Runs when hotel or date changes) ---
   useEffect(() => {
    if (!selectedHotel) {
      setLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setLoading(true);
      setError('');
      try {
        const viewStartDate = startDisplayDate;
        const viewEndDate = addMonths(viewStartDate, 13);
        
        // --- PROMISE.ALL TO FETCH IN PARALLEL ---
        
        // Promise 1: Fetch Base Seasons (existing logic)
        const seasonsQuery = query(
          collection(db, "apartmentSeasonRates"),
          where("startDate", "<", Timestamp.fromDate(viewEndDate)),
          orderBy("startDate", "desc")
        );
        const seasonsPromise = getDocs(seasonsQuery);

        // Promise 2: Fetch Rate Overrides
        const overridesQuery = query(
          collection(db, "rateOverrides"),
          where("startDate", "<", Timestamp.fromDate(viewEndDate))
        );
        const overridesPromise = getDocs(overridesQuery);

        // Await both queries at the same time
        const [seasonsSnapshot, overridesSnapshot] = await Promise.all([seasonsPromise, overridesPromise]);

        // Process Seasons (existing logic)
        const fetchedSeasons = seasonsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(rate => rate.endDate.toDate() > viewStartDate);
        setRates(fetchedSeasons);

         // 1. Get ALL potentially relevant overrides
        const fetchedOverrides = overridesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(ov => ov.endDate.toDate() > viewStartDate);
       

        // 2. Determine which unit types are visible for the current hotel
        const visibleUnitTypes = unitTypes.filter(ut => {
            if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') {
                return ut.startsWith('sup') || ut.startsWith('std');
            }
            return ut.startsWith(selectedHotel + '-');
        });
        // 3. Filter the overrides to only include those for visible unit types
        const filteredOverrides = allFetchedOverrides.filter(ov => visibleUnitTypes.includes(ov.unitType));
        
        setOverrides(filteredOverrides); // Set the correctly filtered overrides

      } catch (err) {
        console.error("CRITICAL ERROR in fetchAllData:", err);
        setError("A critical error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedHotel, startDisplayDate, unitTypes]);

  // We also need to group overrides by unitType, just like we did for rates
  const overridesByUnitType = useMemo(() => {
    return overrides.reduce((acc, override) => {
      const { unitType } = override;
      if (!acc[unitType]) acc[unitType] = [];
      acc[unitType].push(override);
      return acc;
    }, {});
  }, [overrides]);

  const ratesByUnitType = useMemo(() => {
    return rates.reduce((acc, rate) => {
      const { unitType } = rate;
      if (!acc[unitType]) acc[unitType] = [];
      acc[unitType].push(rate);
      return acc;
    }, {});
  }, [rates]);
  
  const filteredUnitTypes = useMemo(() => {
    return unitTypes.filter(ut => {
        if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') {
            return ut.startsWith('sup') || ut.startsWith('std');
        }
        return ut.startsWith(selectedHotel + '-');
    });
  }, [selectedHotel, unitTypes]);

  const handleMonthChange = (e) => {
    const newDate = new Date(startDisplayDate);
    newDate.setMonth(parseInt(e.target.value));
    setStartDisplayDate(startOfMonth(newDate));
  };

  const handleYearChange = (e) => {
    const newDate = new Date(startDisplayDate);
    newDate.setFullYear(parseInt(e.target.value));
    setStartDisplayDate(startOfMonth(newDate));
  };

  // Handlers for the edit panel
  const handleSelectSeason = (season) => {
    setEditingSeason(season);
  };

  const handleSeasonUpdate = () => {
    setEditingSeason(null);
    // This forces the useEffect hook for fetching data to run again
    setStartDisplayDate(new Date(startDisplayDate));
  }
  
  // This function will be called from the Edit Panel's new button
  const handleInitiateSplit = (season) => {
    setEditingSeason(null); // Close the edit panel
    setSplittingSeason(season); // Open the split panel
  };

  // This function forces a full re-fetch after the split is successful
  const handleSplitSave = () => {
    setSplittingSeason(null);
    // Trigger the useEffect hook to re-fetch all rates
    setStartDisplayDate(new Date(startDisplayDate)); 
  };

  const handleSeasonDelete = async (seasonToDelete) => {
    // 1. Find all seasons for this unit type from our local state
    const allSeasonsForUnitType = rates.filter(r => r.unitType === seasonToDelete.unitType)
                                      .sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());

    // 2. Find the index of the season we're deleting
    const deleteIndex = allSeasonsForUnitType.findIndex(s => s.id === seasonToDelete.id);

    // 3. Handle edge case: cannot delete the first season in the timeline
    if (deleteIndex === 0) {
      alert("Cannot delete the first season of a timeline. To remove it, extend the next season backwards over it (feature coming soon).");
      return;
    }
    if (deleteIndex < 0) {
      alert("Error: Could not find the season to delete.");
      return;
    }

    // 4. Identify the two seasons involved in the merge
    const previousSeason = allSeasonsForUnitType[deleteIndex - 1];
    
    // 5. Perform the atomic write
    try {
      const batch = writeBatch(db);

      // Action A: Update the previous season's end date to match the deleted season's end date
      const prevSeasonRef = doc(db, "apartmentSeasonRates", previousSeason.id);
      batch.update(prevSeasonRef, { endDate: seasonToDelete.endDate });

      // Action B: Delete the selected season
      const deletedSeasonRef = doc(db, "apartmentSeasonRates", seasonToDelete.id);
      batch.delete(deletedSeasonRef);

      await batch.commit();

      // 6. Force a re-fetch to show the updated, correct state
      setEditingSeason(null); // Close the panel
      setStartDisplayDate(new Date(startDisplayDate));
      
    } catch (err) {
      console.error("Failed to delete/merge season:", err);
      alert("An error occurred while trying to merge the seasons. Please check the console.");
    }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


   // Handler for when a boundary drag action is completed
  const handleBoundaryDrag = async (leftSeason, rightSeason, daysMoved) => {
    const originalBoundary = rightSeason.startDate.toDate();
    const newBoundary = addDays(originalBoundary, daysMoved);

    // Basic validation to prevent dragging boundaries past each other
    if (newBoundary <= leftSeason.startDate.toDate() || newBoundary >= rightSeason.endDate.toDate()) {
      alert("Invalid drag. The boundary cannot move past the start or end of an adjacent season.");
      return;
    }
    
    try {
      const batch = writeBatch(db);

      // 1. Update the left season's end date
      const leftSeasonRef = doc(db, "apartmentSeasonRates", leftSeason.id);
      batch.update(leftSeasonRef, { endDate: Timestamp.fromDate(newBoundary) });
      
      // 2. Update the right season's start date
      const rightSeasonRef = doc(db, "apartmentSeasonRates", rightSeason.id);
      batch.update(rightSeasonRef, { startDate: Timestamp.fromDate(newBoundary) });

      await batch.commit();

      // Force a re-fetch to show the correct new state
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to update boundary:", err);
      alert("An error occurred while updating the boundary.");
    }
  };


  return (
    <div className="rate-editor-container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Visual Rate Editor</h1>
        <button onClick={() => auth.signOut()}>Sign Out</button>
      </div>

      <div className="filters">
        <label>Hotel:
          <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)}>
            {allHotelCodes.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label>Start Month:
          <select value={getMonth(startDisplayDate)} onChange={handleMonthChange}>
            {months.map((month, index) => <option key={month} value={index}>{month}</option>)}
          </select>
        </label>
        <label>Year:
          <select value={getYear(startDisplayDate)} onChange={handleYearChange}>
            {[2024, 2025, 2026, 2027].map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
         <button className="add-override-button" onClick={() => setIsAddingOverride(true)}>
          + Add Rate Override
        </button>
      </div>

      {loading && <p>Loading data...</p>}
      {error && <p className="error">{error}</p>}
      
      {!loading && !error && (
        <RateTimeline
          unitTypes={filteredUnitTypes}
          ratesByUnitType={ratesByUnitType}
          overridesByUnitType={overridesByUnitType} 
          viewStartDate={startDisplayDate}
          onSelectSeason={handleSelectSeason} // Pass the handler
          onBoundaryDrag={handleBoundaryDrag}
        />
      )}
      {isAddingOverride && (
        <AddOverridePanel
          allUnitTypes={unitTypes}
          onSave={() => {
            setIsAddingOverride(false);
            // Force a re-fetch to show the new override (we'll visualize it later)
            setStartDisplayDate(new Date(startDisplayDate)); 
          }}
          onClose={() => setIsAddingOverride(false)}
        />
      )}

      {/* Render the panel if a season is being edited */}
      {editingSeason && (
        <EditRatePanel
          season={editingSeason}
          onSave={handleSeasonUpdate}
          onClose={() => setEditingSeason(null)}
          onSplit={handleInitiateSplit} 
          onDelete={handleSeasonDelete}
        />
      )}

      {splittingSeason && (
        <SplitSeasonPanel
          originalSeason={splittingSeason}
          onSave={handleSplitSave}
          onClose={() => setSplittingSeason(null)}
        />
      )}
    </div>

  );
}

// The crucial export statement that was missing or incorrect
export default RateEditor; 