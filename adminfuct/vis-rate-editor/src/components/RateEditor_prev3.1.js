// src/components/RateEditor.js

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
import { startOfMonth, addMonths, getYear, getMonth, addDays, differenceInYears, format } from 'date-fns';
import EditRatePanel from './EditRatePanel';
import SplitSeasonPanel from './SplitSeasonPanel';
import AddOverridePanel from './AddOverridePanel';
import PasteConfigPanel from './PasteConfigPanel';

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

function RateEditor() {
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
  const [clipboard, setClipboard] = useState(null);
  const [pastingConfig, setPastingConfig] = useState(null);

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
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

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
        const seasonsQuery = query(collection(db, "apartmentSeasonRates"), where("startDate", "<", Timestamp.fromDate(viewEndDate)), orderBy("startDate", "desc"));
        const overridesQuery = query(collection(db, "rateOverrides"), where("startDate", "<", Timestamp.fromDate(viewEndDate)));
        const [seasonsSnapshot, overridesSnapshot] = await Promise.all([getDocs(seasonsQuery), getDocs(overridesQuery)]);
        const fetchedSeasons = seasonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(rate => rate.endDate.toDate() > viewStartDate);
        setRates(fetchedSeasons);
        const allFetchedOverrides = overridesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(ov => ov.endDate.toDate() > viewStartDate);
        const visibleUnitTypes = unitTypes.filter(ut => {
          if (selectedHotel === 'TBA' || selectedHotel === 'TTBH') { return ut.startsWith('sup') || ut.startsWith('std'); }
          return ut.startsWith(selectedHotel + '-');
        });
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
  }, [selectedHotel, startDisplayDate, unitTypes]);

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
  const handleSelectSeason = (season) => setEditingSeason(season);
  const handleSeasonUpdate = () => { setEditingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleInitiateSplit = (season) => { setEditingSeason(null); setSplittingSeason(season); };
  const handleSplitSave = () => { setSplittingSeason(null); setStartDisplayDate(new Date(startDisplayDate)); };
  const handleSeasonDelete = async (seasonToDelete) => {
    const allSeasonsForUnitType = rates.filter(r => r.unitType === seasonToDelete.unitType).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
    const deleteIndex = allSeasonsForUnitType.findIndex(s => s.id === seasonToDelete.id);
    if (deleteIndex < 1) { alert("Cannot delete the first season of a timeline."); return; }
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
  const handleCopyYear = (unitType, year) => {
    const seasonsToCopy = rates.filter(r => r.unitType === unitType && getYear(r.startDate.toDate()) === year);
    if (seasonsToCopy.length === 0) { alert("No seasons found in this year to copy."); return; }
    setClipboard({ mode: 'fullYear', sourceUnitType: unitType, sourceYear: year, seasons: seasonsToCopy });
  };
  const handleInitiatePaste = (targetUnitType) => {
    if (!clipboard) { alert("Clipboard is empty. Please copy a year's rates first."); return; }
    setPastingConfig({ targetUnitType, clipboard });
  };
  const handleExecutePaste = async (config) => {
    const { targetUnitType, targetYear, adjustmentType, adjustmentValue, updateNames, allowOverwrite, sourceData } = config;
    const seasonsInTargetYear = rates.filter(r => {
      if (r.unitType !== targetUnitType) return false;
      const startYear = getYear(r.startDate.toDate());
      const endYear = getYear(r.endDate.toDate());
      return startYear === targetYear || endYear === targetYear;
    });
    if (seasonsInTargetYear.length > 0 && !allowOverwrite) { alert("Error: Overwrite not confirmed."); return; }
    try {
      const batch = writeBatch(db);
      if (seasonsInTargetYear.length > 0 && allowOverwrite) {
        seasonsInTargetYear.forEach(season => {
          const seasonRef = doc(db, "apartmentSeasonRates", season.id);
          batch.delete(seasonRef);
        });
      }
      const yearDiff = targetYear - sourceData.sourceYear;
      sourceData.seasons.forEach(season => {
        const newSeasonRef = doc(collection(db, "apartmentSeasonRates"));
        const newStartDate = addDays(season.startDate.toDate(), yearDiff * 365.25);
        const newEndDate = addDays(season.endDate.toDate(), yearDiff * 365.25);
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
        const newSeasonData = { ...season, unitType: targetUnitType, startDate: Timestamp.fromDate(newStartDate), endDate: Timestamp.fromDate(newEndDate), weekdayRateAgent: newWeekdayRate, weekendRateAgent: newWeekendRate, seasonName: updateNames ? season.seasonName.replace(sourceData.sourceYear, targetYear) : season.seasonName, lastUpdatedAt: Timestamp.now() };
        delete newSeasonData.id;
        batch.set(newSeasonRef, newSeasonData);
      });
      await batch.commit();
      setPastingConfig(null);
      setClipboard(null);
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to execute paste operation:", err);
      alert("A critical error occurred during the paste operation.");
      setPastingConfig(null);
    }
  };
  const handleBoundaryDrag = async (leftSeason, rightSeason, daysMoved) => {
    const originalBoundary = rightSeason.startDate.toDate();
    const newBoundary = addDays(originalBoundary, daysMoved);
    const rightSeasonEndDate = rightSeason.endDate.toDate();
    const leftSeasonStartDate = leftSeason.startDate.toDate();
    if (newBoundary <= leftSeasonStartDate || newBoundary >= rightSeasonEndDate) { alert("Invalid drag."); return; }
    const newLeftSeasonName = updateSeasonNameWithDates(leftSeason.seasonName, leftSeasonStartDate, newBoundary);
    const newRightSeasonName = updateSeasonNameWithDates(rightSeason.seasonName, newBoundary, rightSeasonEndDate);
    try {
      const batch = writeBatch(db);
      const leftSeasonRef = doc(db, "apartmentSeasonRates", leftSeason.id);
      batch.update(leftSeasonRef, { endDate: Timestamp.fromDate(newBoundary), seasonName: newLeftSeasonName });
      const rightSeasonRef = doc(db, "apartmentSeasonRates", rightSeason.id);
      batch.update(rightSeasonRef, { startDate: Timestamp.fromDate(newBoundary), seasonName: newRightSeasonName });
      await batch.commit();
      setStartDisplayDate(new Date(startDisplayDate));
    } catch (err) {
      console.error("Failed to update boundary:", err);
      alert("An error occurred while updating the boundary.");
    }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ====================================================================
  // THIS IS THE CRITICAL BLOCK THAT WAS MISSING.
  // ====================================================================
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
        <button className="add-override-button" onClick={() => setIsAddingOverride(true)}>+ Add Rate Override</button>
      </div>
      {clipboard && (
        <div className="clipboard-info">
          Copied: {clipboard.sourceUnitType} (Year {clipboard.sourceYear}). Right-click a row to paste.
          <button onClick={() => setClipboard(null)}>Clear</button>
        </div>
      )}
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
          clipboard={clipboard}
          onCopyYear={handleCopyYear}
          onInitiatePaste={handleInitiatePaste}
        />
      )}
      {isAddingOverride && <AddOverridePanel unitTypesForForm={filteredUnitTypes} onSave={() => { setIsAddingOverride(false); setStartDisplayDate(new Date(startDisplayDate)); }} onClose={() => setIsAddingOverride(false)} />}
      {editingSeason && <EditRatePanel season={editingSeason} onSave={handleSeasonUpdate} onClose={() => setEditingSeason(null)} onSplit={handleInitiateSplit} onDelete={handleSeasonDelete} />}
      {splittingSeason && <SplitSeasonPanel originalSeason={splittingSeason} onSave={handleSplitSave} onClose={() => setSplittingSeason(null)} />}
      {pastingConfig && (
        <PasteConfigPanel
          clipboard={pastingConfig.clipboard}
          targetUnitType={pastingConfig.targetUnitType}
          allRates={rates}
          onConfirm={handleExecutePaste}
          onClose={() => setPastingConfig(null)}
        />
      )}
    </div>
  );
}

export default RateEditor;