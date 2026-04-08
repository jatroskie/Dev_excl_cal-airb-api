// src/components/RateEditor.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  Timestamp,
  orderBy,
  writeBatch,
  doc,
  onSnapshot, // <-- Import the real-time listener
  getDocs // We still need this for the one-time rooms fetch
} from "firebase/firestore";
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';
import RateTimeline from './RateTimeline';
import { startOfMonth, getYear, getMonth, addDays, format } from 'date-fns';
import EditRatePanel from './EditRatePanel';
import SplitSeasonPanel from './SplitSeasonPanel';
import AddOverridePanel from './AddOverridePanel';
import PasteConfigPanel from './PasteConfigPanel';
import EditOverridePanel from './EditOverridePanel';
import AddSeasonPanel from './AddSeasonPanel';
import BulkEditPanel from './BulkEditPanel';
import TimelineSkeleton from './TimelineSkeleton';
import ChannelSettingsModal from './ChannelSettingsModal';

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

const updateSeasonNameWithDates = (originalName, newStartDate, newEndDate) => {
  if (!originalName) return '';
  const baseName = originalName.replace(/\s\([^)]+\)$/, '').trim();
  const formattedStart = format(newStartDate, 'MMM d');
  const formattedEnd = format(newEndDate, 'MMM d');
  return `${baseName} (${formattedStart}-${formattedEnd})`;
};

const isOverlap = (newStart, newEnd, seasons, excludeId = null) => {
  // Make sure we don't compare a season against itself when editing
  const otherSeasons = seasons.filter(s => s.id !== excludeId);
  
  for (const season of otherSeasons) {
    const existingStart = season.startDate.toDate();
    const existingEnd = season.endDate.toDate();
    // Overlap occurs if the new period starts before an existing one ends,
    // AND the new period ends after that same existing one starts.
    if (newStart < existingEnd && newEnd > existingStart) {
      return true; // Found an overlap
    }
  }
  return false; // No overlaps found
};

function RateEditor() {
  // --- All state variables are unchanged ---
  const [unitTypes, setUnitTypes] = useState([]);
  const [rates, setRates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [allHotelCodes, setAllHotelCodes] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [startDisplayDate, setStartDisplayDate] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSeason, setEditingSeason] = useState(null);
  const [splittingSeason, setSplittingSeason] = useState(null);
  const [isAddingOverride, setIsAddingOverride] = useState(false);
  const [addingSeasonFor, setAddingSeasonFor] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [pastingConfig, setPastingConfig] = useState(null);
  const [editingOverride, setEditingOverride] = useState(null);
  const [selectedSeasons, setSelectedSeasons] = useState(new Set());
  const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false);

  // --- This initial fetch for static data remains the same ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true); setError('');
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
        if (sortedHotelCodes.length > 0) { setSelectedHotel(sortedHotelCodes[0]); }
        setUnitTypes(Array.from(types).sort());
      } catch (err) {
        console.error("CRITICAL ERROR in fetchInitialData:", err);
        setError("Failed to load initial hotel data. Check console.");
      } finally { setLoading(false); }
    };
    fetchInitialData();
  }, []);

  // ====================================================================
  // CHANGE START: Refactored data fetching to use onSnapshot
  // ====================================================================
  useEffect(() => {
    if (!selectedHotel) {
      setLoading(false);
      return; // Don't fetch if no hotel is selected
    }
    
    setLoading(true);
    setError('');

    // Define the queries for seasons and overrides
    const seasonsQuery = query(collection(db, "apartmentSeasonRates"), orderBy("startDate", "asc"));
    const overridesQuery = query(collection(db, "rateOverrides"), orderBy("startDate", "asc"));

    // Set up the real-time listeners
    const unsubscribeSeasons = onSnapshot(seasonsQuery, (snapshot) => {
      const fetchedSeasons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRates(fetchedSeasons);
      setLoading(false); // Set loading to false after the first successful fetch
    }, (err) => {
      console.error("Firebase seasons listener error:", err);
      setError("Failed to listen for real-time season updates.");
      setLoading(false);
      toast.error("Connection to rate seasons lost.");
    });

    const unsubscribeOverrides = onSnapshot(overridesQuery, (snapshot) => {
      // Filter overrides based on the currently visible unit types
      const allFetchedOverrides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const visibleUnitTypes = unitTypes.filter(ut => {
          if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') { return ut.startsWith('sup') || ut.startsWith('std'); }
          return ut.startsWith(selectedHotel + '-');
      });
      const filteredOverrides = allFetchedOverrides.filter(ov => visibleUnitTypes.includes(ov.unitType));
      
      setOverrides(filteredOverrides);
    }, (err) => {
      console.error("Firebase overrides listener error:", err);
      setError("Failed to listen for real-time override updates.");
      toast.error("Connection to rate overrides lost.");
    });

    // This is the crucial cleanup function.
    // When the component unmounts or its dependencies change,
    // it unsubscribes from the listeners to prevent memory leaks.
    return () => {
      unsubscribeSeasons();
      unsubscribeOverrides();
    };
  }, [selectedHotel, unitTypes]); // Re-run when the hotel or unit types change

  // ====================================================================
  // CHANGE END
  // ====================================================================

  // --- All memoized calculations and handler functions remain unchanged ---
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

  const handleMonthChange = (e) => { setStartDisplayDate(d => { const n = new Date(d); n.setMonth(parseInt(e.target.value)); return startOfMonth(n); }); };
  const handleYearChange = (e) => { setStartDisplayDate(d => { const n = new Date(d); n.setFullYear(parseInt(e.target.value)); return startOfMonth(n); }); };
  const handleSelectSeason = (season) => { setSelectedSeasons(new Set()); setEditingSeason(season); };
  const handleSeasonUpdate = () => { setEditingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleInitiateSplit = (season) => { setEditingSeason(null); setSplittingSeason(season); };
  const handleSplitSave = () => { setSplittingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleSelectOverride = (override) => setEditingOverride(override);
  const handleOverrideUpdate = () => { setEditingOverride(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleAddSeason = (unitType) => { setAddingSeasonFor(unitType); };
  const handleNewSeasonSave = () => { setAddingSeasonFor(null); setStartDisplayDate(new Date(startDisplayDate)); };
  
  const handleSeasonDelete = async (seasonToDelete) => {
    const allSeasonsForUnitType = rates.filter(r => r.unitType === seasonToDelete.unitType).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
    const deleteIndex = allSeasonsForUnitType.findIndex(s => s.id === seasonToDelete.id);
    if (deleteIndex < 1) { toast.error("Cannot delete the first season of a timeline."); return; }
    const previousSeason = allSeasonsForUnitType[deleteIndex - 1];
    try {
      const batch = writeBatch(db);
      const prevSeasonRef = doc(db, "apartmentSeasonRates", previousSeason.id);
      batch.update(prevSeasonRef, { endDate: seasonToDelete.endDate });
      const deletedSeasonRef = doc(db, "apartmentSeasonRates", seasonToDelete.id);
      batch.delete(deletedSeasonRef);
      await batch.commit();
      setEditingSeason(null);
      toast.success("Season deleted and merged successfully!");
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to delete/merge season:", err);
      toast.error("An error occurred while trying to merge the seasons.");
    }
  };

  const handleBoundaryDrag = async (leftSeason, rightSeason, daysMoved) => {
    const originalBoundary = rightSeason.startDate.toDate();
    const newBoundary = addDays(originalBoundary, daysMoved);
    const rightSeasonEndDate = rightSeason.endDate.toDate();
    const leftSeasonStartDate = leftSeason.startDate.toDate();
    if (newBoundary <= leftSeasonStartDate || newBoundary >= rightSeasonEndDate) { toast.warn("Invalid drag."); return; }
    const newLeftSeasonName = updateSeasonNameWithDates(leftSeason.seasonName, leftSeasonStartDate, newBoundary);
    const newRightSeasonName = updateSeasonNameWithDates(rightSeason.seasonName, newBoundary, rightSeasonEndDate);
    try {
      const batch = writeBatch(db);
      const leftSeasonRef = doc(db, "apartmentSeasonRates", leftSeason.id);
      batch.update(leftSeasonRef, { endDate: Timestamp.fromDate(newBoundary), seasonName: newLeftSeasonName });
      const rightSeasonRef = doc(db, "apartmentSeasonRates", rightSeason.id);
      batch.update(rightSeasonRef, { startDate: Timestamp.fromDate(newBoundary), seasonName: newRightSeasonName });
      await batch.commit();
      toast.success("Boundary updated!");
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to update boundary:", err);
      toast.error("An error occurred while updating the boundary.");
    }
  };

  const handleCopySeasons = (seasonsToCopy, unitType, modeLabel) => {
    if (!seasonsToCopy || seasonsToCopy.length === 0) { toast.warn("No seasons found to copy for the selected action."); return; }
    setClipboard({ mode: 'custom', modeLabel: modeLabel, sourceUnitType: unitType, seasons: seasonsToCopy });
    toast.info(`Copied ${modeLabel} for ${unitType}.`);
  };

  const handleInitiatePaste = (targetUnitType) => {
    if (!clipboard) { toast.error("Clipboard is empty. Please perform a copy action first."); return; }
    setPastingConfig({ targetUnitType, clipboard });
  };
  
// In src/components/RateEditor.js

  const handleExecutePaste = async (config) => {
    const { targetUnitType, shiftBySeasons, adjustmentType, adjustmentValue, updateNames, allowOverwrite, sourceData } = config;
    
    // ====================================================================
    // THE FIX IS HERE: Correctly define allSourceSeasons and allTargetSeasons
    // ====================================================================
    
    // Get all seasons for the SOURCE unit type to calculate the correct shift
    const allSourceSeasons = rates.filter(r => r.unitType === sourceData.sourceUnitType).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
    
    // Get all seasons for the TARGET unit type to check for overlaps
    const allTargetSeasons = rates.filter(r => r.unitType === targetUnitType).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
    
    // Find the starting point from the source data
    const firstOriginalSeason = sourceData.seasons[0];
    const firstSeasonIndex = allSourceSeasons.findIndex(s => s.id === firstOriginalSeason.id);
    
    if (firstSeasonIndex === -1) {
      toast.error("Error: Could not find the source season in the database to calculate shift.");
      return;
    }
    
    const shiftFromIndex = firstSeasonIndex + shiftBySeasons - 1;
    if (shiftFromIndex >= allSourceSeasons.length || shiftFromIndex < 0) {
      toast.error(`Error: Cannot shift by ${shiftBySeasons} seasons. Not enough subsequent seasons exist.`);
      return;
    }

    const shiftFromDate = allSourceSeasons[shiftFromIndex].endDate.toDate();
    const timeDifference = shiftFromDate.getTime() - firstOriginalSeason.startDate.toDate().getTime();
    
    const firstNewDate = new Date(firstOriginalSeason.startDate.toDate().getTime() + timeDifference);
    const lastOriginalSeason = sourceData.seasons[sourceData.seasons.length - 1];
    const lastNewDate = new Date(lastOriginalSeason.endDate.toDate().getTime() + timeDifference);
    
    // Use the correctly filtered 'allTargetSeasons' for the overlap check
    if (isOverlap(firstNewDate, lastNewDate, allTargetSeasons)) {
      if (!allowOverwrite) {
        toast.error("Paste would overlap with existing seasons. Please check 'overwrite' to proceed.");
        return;
      }
    }

    try {
      const batch = writeBatch(db);
      if (allowOverwrite) {
        // If overwriting, filter the target seasons that fall within the new date range
        const seasonsInTargetRange = allTargetSeasons.filter(r => r.startDate.toDate() < lastNewDate && r.endDate.toDate() > firstNewDate);
        seasonsInTargetRange.forEach(season => { batch.delete(doc(db, "apartmentSeasonRates", season.id)); });
      }

      sourceData.seasons.forEach(season => {
        const newSeasonRef = doc(collection(db, "apartmentSeasonRates"));
        const newStartDate = new Date(season.startDate.toDate().getTime() + timeDifference);
        const newEndDate = new Date(season.endDate.toDate().getTime() + timeDifference);
        
        let newWeekdayRate = season.weekdayRateAgent;
        let newWeekendRate = season.weekendRateAgent;
        if (adjustmentType === 'percentage') {
          const multiplier = 1 + (adjustmentValue / 100);
          newWeekdayRate = Math.round(newWeekdayRate * multiplier * 100) / 100;
          newWeekendRate = Math.round(newWeekendRate * multiplier * 100) / 100;
        } else {
          newWeekdayRate += adjustmentValue;
          newWeekendRate += adjustmentValue;
        }
        
        const newName = updateNames 
          ? season.seasonName.replace(/\d{4}/g, () => getYear(newStartDate))
          : season.seasonName;

        const newSeasonData = { 
          ...season, 
          unitType: targetUnitType, 
          startDate: Timestamp.fromDate(newStartDate), 
          endDate: Timestamp.fromDate(newEndDate), 
          weekdayRateAgent: newWeekdayRate, 
          weekendRateAgent: newWeekendRate, 
          seasonName: newName, 
          lastUpdatedAt: Timestamp.now() 
        };
        delete newSeasonData.id;
        batch.set(newSeasonRef, newSeasonData);
      });

      await batch.commit();
      setPastingConfig(null);
      setClipboard(null);
      toast.success(`Pasted ${sourceData.seasons.length} seasons successfully!`);
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to execute paste operation:", err);
      toast.error("A critical error occurred during the paste operation.");
      setPastingConfig(null);
    }
  };

  // --- NEW HANDLERS for bulk editing ---
  const handleToggleSeasonSelect = (seasonId) => {
    setSelectedSeasons(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(seasonId)) {
        newSelected.delete(seasonId);
      } else {
        newSelected.add(seasonId);
      }
      return newSelected;
    });
  };

  const handleBulkUpdate = async (updatePayload) => {
    const { adjustmentType, weekdayValue, weekendValue, minStay } = updatePayload;
    if (selectedSeasons.size === 0) {
      toast.warn("No seasons selected for bulk update.");
      return;
    }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="rate-editor-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Visual Rate Editor</h1>
        <button onClick={() => auth.signOut()}>Sign Out</button>
      </div>
      <div className="filters">
        <label>Hotel: <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)}>{allHotelCodes.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>Start Month: <select value={getMonth(startDisplayDate)} onChange={handleMonthChange}>{months.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label>Year: <select value={getYear(startDisplayDate)} onChange={handleYearChange}>{[2024, 2025, 2026, 2027].map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <button className="add-override-button" style={{ backgroundColor: '#2c3e50', marginRight: '10px' }} onClick={() => setIsChannelSettingsOpen(true)}>⚙️ OTA Markups</button>
        <button className="add-override-button" onClick={() => setIsAddingOverride(true)}>+ Add Rate Override</button>
      </div>

      {clipboard && ( <div className="clipboard-info"> Copied: {clipboard.sourceUnitType} ({clipboard.modeLabel}). Right-click a row to paste. <button onClick={() => setClipboard(null)}>Clear</button> </div> )}
      
      {error && <p className="error">{error}</p>}  
      {loading ? (
        <TimelineSkeleton />
      ) : (
        <RateTimeline
          unitTypes={filteredUnitTypes}
          ratesByUnitType={ratesByUnitType}
          overridesByUnitType={overridesByUnitType}
          viewStartDate={startDisplayDate}
          onSelectSeason={handleSelectSeason}
          onBoundaryDrag={handleBoundaryDrag}
          onSelectOverride={handleSelectOverride}
          clipboard={clipboard}
          onCopySeasons={handleCopySeasons}
          onInitiatePaste={handleInitiatePaste}
          onAddSeason={handleAddSeason}
          onToggleSeasonSelect={handleToggleSeasonSelect}
          selectedSeasons={selectedSeasons}
        />
      )}

      {selectedSeasons.size > 0 && (
        <BulkEditPanel 
          selectedCount={selectedSeasons.size}
          onBulkUpdate={handleBulkUpdate}
          onClose={() => setSelectedSeasons(new Set())}
        />
      )}
      
      {isAddingOverride && <AddOverridePanel unitTypesForForm={filteredUnitTypes} onSave={() => { setIsAddingOverride(false); setStartDisplayDate(new Date(startDisplayDate)); }} onClose={() => setIsAddingOverride(false)} />}
      {editingSeason && <EditRatePanel season={editingSeason} onSave={handleSeasonUpdate} onClose={() => setEditingSeason(null)} onSplit={handleInitiateSplit} onDelete={handleSeasonDelete} />}
      {splittingSeason && <SplitSeasonPanel originalSeason={splittingSeason} onSave={handleSplitSave} onClose={() => setSplittingSeason(null)} />}
      {addingSeasonFor && <AddSeasonPanel unitType={addingSeasonFor} onSave={handleNewSeasonSave} onClose={() => setAddingSeasonFor(null)} />}
      {pastingConfig && <PasteConfigPanel clipboard={pastingConfig.clipboard} targetUnitType={pastingConfig.targetUnitType} allRates={rates} onConfirm={handleExecutePaste} onClose={() => setPastingConfig(null)} />}
      {editingOverride && <EditOverridePanel override={editingOverride} onSave={handleOverrideUpdate} onClose={() => setEditingOverride(null)} />}
      {isChannelSettingsOpen && <ChannelSettingsModal onClose={() => setIsChannelSettingsOpen(false)} />}
    </div>
  );
}

export default RateEditor;
