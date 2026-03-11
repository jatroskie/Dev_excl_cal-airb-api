import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db, auth } from '../firebase';
import RateTimeline from './RateTimeline';
import { startOfMonth, addMonths, getYear, getMonth, addDays } from 'date-fns';
import EditRatePanel from './EditRatePanel';
import SplitSeasonPanel from './SplitSeasonPanel';
import AddOverridePanel from './AddOverridePanel';

// Helper function to calculate unitType based on the hotel group rules
const getUnitTypeForRoom = (roomData) => {
  const { hotelCode, propRate, actType } = roomData;
  if (!actType) return null;

  if (hotelCode === 'TBA' || hotelCode === 'TTBH') {
    if (!propRate) return null;
    const cleanActType = actType.replace(/[^a-zA-Z0-9]/g, '');
    return `${propRate}${cleanActType}`;
  } else {
    if (!hotelCode) return null;
    return `${hotelCode}-${actType}`;
  }
};

function RateEditor() {
  // State for data
  const [unitTypes, setUnitTypes] = useState([]);
  const [rates, setRates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [allHotelCodes, setAllHotelCodes] = useState([]);
  
  // State for UI controls
  const [selectedHotel, setSelectedHotel] = useState('');
  const [startDisplayDate, setStartDisplayDate] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for modals/panels
  const [editingSeason, setEditingSeason] = useState(null);
  const [splittingSeason, setSplittingSeason] = useState(null);
  const [isAddingOverride, setIsAddingOverride] = useState(false);


  // Hook 1: Fetch Initial Hotel and Unit Type Data (Runs once on mount)
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
          setSelectedHotel(sortedHotelCodes[0]);
        }
        setUnitTypes(Array.from(types).sort());
      } catch (err) {
        console.error("CRITICAL ERROR in fetchInitialData:", err);
        setError("Failed to load initial hotel data. Check console.");
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);


  // Hook 2: Fetch Rate and Override Data (Runs when hotel or date changes)
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
        
        // Fetch seasons and overrides in parallel
        const seasonsQuery = query(collection(db, "apartmentSeasonRates"), where("startDate", "<", Timestamp.fromDate(viewEndDate)), orderBy("startDate", "desc"));
        const overridesQuery = query(collection(db, "rateOverrides"), where("startDate", "<", Timestamp.fromDate(viewEndDate)));
        
        const [seasonsSnapshot, overridesSnapshot] = await Promise.all([getDocs(seasonsQuery), getDocs(overridesQuery)]);

        // Process Seasons (This part is correct)
        const fetchedSeasons = seasonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(rate => rate.endDate.toDate() > viewStartDate);
        setRates(fetchedSeasons);

        // Process Overrides (This part is now fixed)
        const allFetchedOverrides = overridesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(ov => ov.endDate.toDate() > viewStartDate);

        // Re-calculate which unit types are visible for the current hotel, just like in the useMemo hook.
        // This is the missing piece of logic.
        const visibleUnitTypes = unitTypes.filter(ut => {
            if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') {
                return ut.startsWith('sup') || ut.startsWith('std');
            }
            return ut.startsWith(selectedHotel + '-');
        });
        
        // Now, filter the fetched overrides to only include those for the visible unit types.
        const filteredOverrides = allFetchedOverrides.filter(ov => visibleUnitTypes.includes(ov.unitType));
        
        setOverrides(filteredOverrides);

      } catch (err) {
        console.error("CRITICAL ERROR in fetchAllData:", err);
        setError("A critical error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [selectedHotel, startDisplayDate, unitTypes]); // The dependency on 'unitTypes' is crucial here.


  // Memoized calculations to prevent re-computing on every render
  const ratesByUnitType = useMemo(() => {
    return rates.reduce((acc, rate) => {
      const { unitType } = rate;
      if (!acc[unitType]) acc[unitType] = [];
      acc[unitType].push(rate);
      return acc;
    }, {});
  }, [rates]);

  const overridesByUnitType = useMemo(() => {
    return overrides.reduce((acc, override) => {
      const { unitType } = override;
      if (!acc[unitType]) acc[unitType] = [];
      acc[unitType].push(override);
      return acc;
    }, {});
  }, [overrides]);

  const filteredUnitTypes = useMemo(() => {
    return unitTypes.filter(ut => {
      if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') {
        return ut.startsWith('sup') || ut.startsWith('std');
      }
      return ut.startsWith(selectedHotel + '-');
    });
  }, [selectedHotel, unitTypes]);


  // Handlers for UI actions
  const handleMonthChange = (e) => { setStartDisplayDate(d => { const n = new Date(d); n.setMonth(parseInt(e.target.value)); return startOfMonth(n); }); };
  const handleYearChange = (e) => { setStartDisplayDate(d => { const n = new Date(d); n.setFullYear(parseInt(e.target.value)); return startOfMonth(n); }); };
  const handleSelectSeason = (season) => setEditingSeason(season);
  const handleSeasonUpdate = () => { setEditingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleInitiateSplit = (season) => { setEditingSeason(null); setSplittingSeason(season); };
  const handleSplitSave = () => { setSplittingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  
  const handleSeasonDelete = async (seasonToDelete) => {
    const allSeasonsForUnitType = rates.filter(r => r.unitType === seasonToDelete.unitType).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
    const deleteIndex = allSeasonsForUnitType.findIndex(s => s.id === seasonToDelete.id);
    if (deleteIndex === 0) {
      alert("Cannot delete the first season of a timeline.");
      return;
    }
    if (deleteIndex < 0) {
      alert("Error: Could not find the season to delete.");
      return;
    }
    const previousSeason = allSeasonsForUnitType[deleteIndex - 1];
    try {
      const batch = writeBatch(db);
      const prevSeasonRef = doc(db, "apartmentSeasonRates", previousSeason.id);
      batch.update(prevSeasonRef, { endDate: seasonToDelete.endDate });
      const deletedSeasonRef = doc(db, "apartmentSeasonRates", seasonToDelete.id);
      batch.delete(deletedSeasonRef);
      await batch.commit();
      setEditingSeason(null);
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to delete/merge season:", err);
      alert("An error occurred while trying to merge the seasons.");
    }
  };

  const handleBoundaryDrag = async (leftSeason, rightSeason, daysMoved) => {
    const originalBoundary = rightSeason.startDate.toDate();
    const newBoundary = addDays(originalBoundary, daysMoved);
    if (newBoundary <= leftSeason.startDate.toDate() || newBoundary >= rightSeason.endDate.toDate()) {
      alert("Invalid drag. Boundary cannot move past an adjacent season's start or end.");
      return;
    }
    try {
      const batch = writeBatch(db);
      const leftSeasonRef = doc(db, "apartmentSeasonRates", leftSeason.id);
      batch.update(leftSeasonRef, { endDate: Timestamp.fromDate(newBoundary) });
      const rightSeasonRef = doc(db, "apartmentSeasonRates", rightSeason.id);
      batch.update(rightSeasonRef, { startDate: Timestamp.fromDate(newBoundary) });
      await batch.commit();
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to update boundary:", err);
      alert("An error occurred while updating the boundary.");
    }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="rate-editor-container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Visual Rate Editor</h1>
        <button onClick={() => auth.signOut()}>Sign Out</button>
      </div>
      <div className="filters">
        <label>Hotel: <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)}>{allHotelCodes.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>Start Month: <select value={getMonth(startDisplayDate)} onChange={handleMonthChange}>{months.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label>Year: <select value={getYear(startDisplayDate)} onChange={handleYearChange}>{[2024, 2025, 2026, 2027].map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <button className="add-override-button" onClick={() => setIsAddingOverride(true)}>+ Add Rate Override</button>
      </div>
      {loading && <p>Loading data...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <RateTimeline
          unitTypes={filteredUnitTypes}
          ratesByUnitType={ratesByUnitType}
          overridesByUnitType={overridesByUnitType}
          viewStartDate={startDisplayDate}
          onSelectSeason={handleSelectSeason}
          onBoundaryDrag={handleBoundaryDrag}
        />
      )}
      {isAddingOverride && <AddOverridePanel unitTypesForForm={filteredUnitTypes} onSave={() => { setIsAddingOverride(false); setStartDisplayDate(new Date(startDisplayDate)); }} onClose={() => setIsAddingOverride(false)} />}
      {editingSeason && <EditRatePanel season={editingSeason} onSave={handleSeasonUpdate} onClose={() => setEditingSeason(null)} onSplit={handleInitiateSplit} onDelete={handleSeasonDelete} />}
      {splittingSeason && <SplitSeasonPanel originalSeason={splittingSeason} onSave={handleSplitSave} onClose={() => setSplittingSeason(null)} />}
    </div>
  );
}

export default RateEditor;