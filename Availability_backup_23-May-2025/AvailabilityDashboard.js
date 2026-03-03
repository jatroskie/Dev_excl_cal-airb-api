// File: AvailabilityDashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    format, addDays, subDays, parseISO, isBefore, isEqual as areDatesEqual,
    isValid as isDateValid, isAfter, startOfDay
} from 'date-fns'; // Core date functions needed

// Import Child Components
import GridTable from './GridTable';
import BookingModal from './BookingModal'; // Ensure BookingModal is imported
import ReservationInfoModal from './ReservationInfoModal';

// Import CSS
import './AvailabilityGrid.css';
import './BookingModal.css';
import './ReservationInfoModal.css';

// Constants
const GET_AVAILABILITY_URL = 'https://api-yzrm33bhsq-uc.a.run.app/getAvailability';
const ROOM_COLUMN_MODES = ['locked', 'small-locked'];
const ROOM_COLUMN_WIDTH_LOCKED = 120; // px
const ROOM_COLUMN_WIDTH_SMALL_LOCKED = 60; // px

function AvailabilityDashboard() {
    // --- State ---
    const [roomColumnMode, setRoomColumnMode] = useState(ROOM_COLUMN_MODES[0]);
    const [gridData, setGridData] = useState({
        rooms: [],
        dates: [],
        availability: {}, // This now holds { roomId: { dateStr: { status, rateDisplay }}}
        reservations: [],
        isStaffView: false,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [numberOfDays, setNumberOfDays] = useState(14);
    const defaultStartDate = subDays(new Date(), 2);
    const [startDateStr, setStartDateStr] = useState(format(defaultStartDate, 'yyyy-MM-dd'));
    const [propertyId, setPropertyId] = useState('TBA'); // Default or load dynamically

    // Modal States
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    // Updated bookingModalProps to include availabilityData
    const [bookingModalProps, setBookingModalProps] = useState({
         room: null,
         startDate: null,
         endDate: null,
         availabilityData: null // Initialize availabilityData prop
    });
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [selectedReservationInfo, setSelectedReservationInfo] = useState(null);

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const dragStartInfo = useRef(null);
    const [dragCurrentDateStr, setDragCurrentDateStr] = useState(null);

    // Ref for scroll container
    const scrollContainerRef = useRef(null);

    console.log("AvailabilityDashboard rendering/re-rendering...");

    // --- Helper Functions ---
    const calculateEndDateStr = useCallback((startStr, days) => {
        try {
            const start = parseISO(startStr);
            if (!isDateValid(start)) {
                throw new Error(`Invalid start date string: ${startStr}`);
            }
            const validDays = Math.max(1, days);
            const end = addDays(start, validDays - 1);
            return format(end, 'yyyy-MM-dd');
        } catch (e) {
            console.error("Error calculating end date:", e);
            setError(`Date calculation error: ${e.message}`);
            return null;
        }
    }, []);

    // --- Data Fetching ---
    const fetchData = useCallback(async (isInitialLoad = false) => {
        console.log(">>> fetchData triggered <<<");
        setError(null);

        const currentEndDateStr = calculateEndDateStr(startDateStr, numberOfDays);
        if (!currentEndDateStr) {
            console.error("fetchData aborted: Could not calculate end date.");
            return;
        }

        try {
            const start = parseISO(startDateStr);
            const end = parseISO(currentEndDateStr);
            if (!isDateValid(start) || !isDateValid(end) || isBefore(end, start)) {
                throw new Error(`Invalid date range: ${startDateStr} to ${currentEndDateStr}`);
            }
        } catch (validationError) {
            console.error("Date validation failed before fetch:", validationError);
            setError(`Invalid date range selected: ${validationError.message}`);
            setIsLoading(false);
            setGridData({ rooms: [], dates: [], availability: {}, reservations: [], isStaffView: false });
            return;
        }

        const fullUrl = `${GET_AVAILABILITY_URL}?propertyId=${propertyId}&startDate=${startDateStr}&endDate=${currentEndDateStr}`;
        console.log(`Fetching: ${fullUrl}`);
        if (isInitialLoad || !gridData.rooms.length || gridData.dates.length === 0) {
            setIsLoading(true);
        }

        try {
            const response = await axios.get(GET_AVAILABILITY_URL, {
                params: { propertyId, startDate: startDateStr, endDate: currentEndDateStr },
                timeout: 20000,
            });
            console.log("API Response Status:", response.status);

            if (response.data &&
                Array.isArray(response.data.rooms) &&
                Array.isArray(response.data.dates) &&
                typeof response.data.availability === 'object' &&
                response.data.availability !== null &&
                Array.isArray(response.data.reservations))
            {
                const processedReservations = response.data.reservations.map(res => ({
                    ...res,
                    fbId: res.fbId || `generated_${Date.now()}_${Math.random()}`
                }));

                setGridData({
                    rooms: response.data.rooms,
                    dates: response.data.dates,
                    availability: response.data.availability, // Directly use the fetched availability
                    reservations: processedReservations,
                    isStaffView: response.data.isStaffView || false,
                });
            } else {
                throw new Error("Received incomplete or invalid data structure from server.");
            }
        } catch (err) {
            console.error(`fetchData error calling ${GET_AVAILABILITY_URL}:`, err);
            let errorMsg = `Request Error: ${err.message}`;

            if (err.response) {
                console.error("Server responded with error:", {
                    status: err.response.status, data: err.response.data
                });
                const responseBody = err.response.data;
                let detail = 'Failed.';
                if (typeof responseBody === 'string' && responseBody.trim() !== '') { detail = responseBody; }
                else if (typeof responseBody?.message === 'string' && responseBody.message.trim() !== '') { detail = responseBody.message; }
                errorMsg = `Error ${err.response.status}: ${detail}`;
            } else if (err.request) {
                errorMsg = 'Network Error: Could not reach server.';
                console.error("Network Error:", err.request);
            } else if (err.code === 'ECONNABORTED') {
                 errorMsg = 'Request timed out.';
            } else {
                errorMsg = `Error: ${err.message || 'An unknown error occurred.'}`;
            }
            setError(errorMsg);
            setGridData({ rooms: [], dates: [], availability: {}, reservations: [], isStaffView: false });
        } finally {
            console.log("fetchData finished");
            setIsLoading(false);
        }
    }, [startDateStr, numberOfDays, propertyId, calculateEndDateStr, gridData.rooms.length, gridData.dates.length]);

    // --- Effects ---
    useEffect(() => {
        console.log("useEffect triggered (core params change), calling initial fetchData");
        fetchData(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDateStr, numberOfDays, propertyId]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            console.log("Resetting scrollLeft due to mode change");
            scrollContainerRef.current.scrollLeft = 0;
        }
    }, [roomColumnMode]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                console.log('Global Mouse Up detected during drag - cancelling drag.');
                setIsDragging(false);
                setDragCurrentDateStr(null);
                if (document.body.style.userSelect === 'none') {
                    document.body.style.userSelect = '';
                }
                dragStartInfo.current = null;
            }
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            if (document.body.style.userSelect === 'none') {
                document.body.style.userSelect = '';
            }
        };
    }, [isDragging]);

    // --- Event Handlers ---

    // Date Navigation
    const handleDateChange = useCallback((newStartDateStr) => {
        try {
            if (typeof newStartDateStr !== 'string' || !newStartDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                throw new Error(`Invalid date format: ${newStartDateStr}`);
            }
            const newStart = parseISO(newStartDateStr);
            if (!isDateValid(newStart)) {
                throw new Error(`Invalid date value: ${newStartDateStr}`);
            }
            if (newStartDateStr !== startDateStr) {
                console.log(`Changing start date from ${startDateStr} to ${newStartDateStr}`);
                setStartDateStr(newStartDateStr);
            }
        } catch (e) {
            console.error("Error setting date:", e);
            setError(`Invalid date selected: ${e.message}`);
        }
    }, [startDateStr]);

    const handlePrev = useCallback(() => {
        try {
            const currentStart = parseISO(startDateStr);
            if (!isDateValid(currentStart)) throw new Error("Invalid current start date.");
            const newStart = subDays(currentStart, Math.max(1, numberOfDays));
            handleDateChange(format(newStart, 'yyyy-MM-dd'));
        } catch (e) { console.error("Error in handlePrev:", e); setError("Date calculation error."); }
    }, [startDateStr, numberOfDays, handleDateChange]);

    const handleNext = useCallback(() => {
        try {
            const currentStart = parseISO(startDateStr);
            if (!isDateValid(currentStart)) throw new Error("Invalid current start date.");
            const newStart = addDays(currentStart, Math.max(1, numberOfDays));
            handleDateChange(format(newStart, 'yyyy-MM-dd'));
        } catch (e) { console.error("Error in handleNext:", e); setError("Date calculation error."); }
    }, [startDateStr, numberOfDays, handleDateChange]);

    const handleGoToToday = useCallback(() => {
        const newStartDate = subDays(new Date(), 2);
        handleDateChange(format(newStartDate, 'yyyy-MM-dd'));
    }, [handleDateChange]);

    const handleViewChange = useCallback((event) => {
        const newDays = parseInt(event.target.value, 10);
        if (!isNaN(newDays) && newDays > 0 && newDays !== numberOfDays) {
            setNumberOfDays(newDays);
        }
    }, [numberOfDays]);

    // Drag Handlers
    const handleMouseDownOnCell = useCallback((room, dateStr) => {
        const availabilityStatus = gridData.availability?.[room?.id]?.[dateStr]?.status;
        if (availabilityStatus !== 'available') {
            console.log("Attempted drag start on non-available cell.");
            return;
        }
        try {
            const parsedDate = parseISO(dateStr);
            if (!isDateValid(parsedDate)) throw new Error("Invalid date on mouse down.");
            setIsDragging(true);
            setDragCurrentDateStr(dateStr);
            dragStartInfo.current = { room, date: parsedDate };
            document.body.style.userSelect = 'none';
        } catch (e) {
            console.error("Error initiating drag:", e);
            setError(`Drag start error: ${e.message}`);
            setIsDragging(false);
            dragStartInfo.current = null;
        }
    }, [gridData.availability]); // Depends on availability data

    const handleMouseMoveOnCell = useCallback((room, dateStr) => {
        if (isDragging && dragStartInfo.current && room?.id === dragStartInfo.current.room?.id) {
            if (dateStr !== dragCurrentDateStr) {
                setDragCurrentDateStr(dateStr);
            }
        }
    }, [isDragging, dragCurrentDateStr]);

    const handleMouseUpOnCell = useCallback((room, dateStr) => {
        if (!isDragging || !dragStartInfo.current || room?.id !== dragStartInfo.current.room?.id) {
            if(isDragging) setIsDragging(false);
            if(dragCurrentDateStr) setDragCurrentDateStr(null);
            if(document.body.style.userSelect === 'none') document.body.style.userSelect = '';
            return;
        }

        setIsDragging(false);
        setDragCurrentDateStr(null);
        if (document.body.style.userSelect === 'none') document.body.style.userSelect = '';


        try {
            const dragStartDate = dragStartInfo.current.date;
            const dragEndDate = parseISO(dateStr);
            if (!isDateValid(dragEndDate)) { throw new Error("Invalid end date for drag selection."); }

            const finalStartDate = isBefore(dragStartDate, dragEndDate) ? dragStartDate : dragEndDate;
            const finalRawEndDate = isBefore(dragStartDate, dragEndDate) ? dragEndDate : dragStartDate;
            const finalExclusiveEndDate = addDays(finalRawEndDate, 1);

            const roomInfoForModal = {
                 id: dragStartInfo.current.room.id,
                 name: dragStartInfo.current.room.name,
                 propertyId: propertyId,
                 actType: dragStartInfo.current.room.actType,
                 propRate: dragStartInfo.current.room.propRate,
             };

            // --- MODIFICATION HERE ---
            // Pass gridData.availability to the modal
            setBookingModalProps({
                room: roomInfoForModal,
                startDate: finalStartDate,
                endDate: finalExclusiveEndDate,
                availabilityData: gridData.availability // Pass the availability data object
            });
            // --- END MODIFICATION ---

            setIsBookingModalOpen(true);
            console.log("Booking Modal opening for DRAG SELECTION:", roomInfoForModal.id, format(finalStartDate, 'yyyy-MM-dd'), format(finalExclusiveEndDate, 'yyyy-MM-dd'));

        } catch (e) {
            console.error("Error processing drag end:", e);
            setError(`Date selection error: ${e.message}`);
        } finally {
             dragStartInfo.current = null;
        }
        // Dependencies updated to include gridData.availability
    }, [isDragging, propertyId, gridData.availability]);

    // Cell Click (Single Day Selection)
    const handleCellClick = useCallback((room, dateStr) => {
        const clickTimeout = setTimeout(() => {
            if (!isDragging && !dragStartInfo.current) {
                const availabilityStatus = gridData.availability?.[room?.id]?.[dateStr]?.status;
                if (availabilityStatus !== 'available') {
                    console.log("Click ignored on non-available cell.");
                    return;
                }
                console.log("Cell clicked (single day):", room.id, dateStr);
                try {
                    const clickedDate = parseISO(dateStr);
                    if (!isDateValid(clickedDate)) throw new Error(`Invalid date string on click: ${dateStr}`);

                    const roomInfoForModal = {
                        id: room.id, name: room.name, propertyId: propertyId,
                        actType: room.actType, propRate: room.propRate
                    };

                    // --- MODIFICATION HERE ---
                    // Pass gridData.availability to the modal
                    setBookingModalProps({
                        room: roomInfoForModal,
                        startDate: clickedDate,
                        endDate: addDays(clickedDate, 1), // Single night
                        availabilityData: gridData.availability // Pass the availability data object
                    });
                     // --- END MODIFICATION ---

                    setIsBookingModalOpen(true);
                } catch (e) {
                    console.error("Error setting single day selection:", e);
                    setError(`Date selection error: ${e.message}`);
                }
            } else {
                console.log("Click suppressed, likely end of drag action.");
                if(isDragging) setIsDragging(false);
                if(dragStartInfo.current) dragStartInfo.current = null;
                if(dragCurrentDateStr) setDragCurrentDateStr(null);
                if(document.body.style.userSelect === 'none') document.body.style.userSelect = '';
            }
        }, 50);

        return () => clearTimeout(clickTimeout);
        // Dependencies updated to include gridData.availability
    }, [isDragging, propertyId, gridData.availability, dragCurrentDateStr]);

    // Modal Handlers
    const handleCloseBookingModal = useCallback(() => {
        setIsBookingModalOpen(false);
        // Reset all props, including availabilityData
        setBookingModalProps({ room: null, startDate: null, endDate: null, availabilityData: null });
    }, []);

    const handleBookingSuccess = useCallback((bookingDetails) => {
        console.log("Booking request initiated:", bookingDetails); // { status: 'pending', pendingReservationId: '...' }
        handleCloseBookingModal();
        fetchData(); // Refresh data
    }, [fetchData, handleCloseBookingModal]);

    const handleCloseInfoModal = useCallback(() => {
        setIsInfoModalOpen(false);
        setSelectedReservationInfo(null);
    }, []);

    const handleBookingDeleted = useCallback((deletedReservationId) => {
        console.log(`Reservation ${deletedReservationId} deleted.`);
        handleCloseInfoModal();
        fetchData(); // Refresh data
    }, [fetchData, handleCloseInfoModal]);

    const handleReservationDoubleClick = useCallback((reservation) => {
        if (!reservation || !reservation.fbId) {
            console.error("Invalid reservation data for double click.");
            setError("Could not load reservation details (Invalid ID).");
            return;
        }
        console.log("Reservation double-clicked:", reservation.fbId);
        setSelectedReservationInfo(reservation);
        setIsInfoModalOpen(true);
    }, []);

    // Room Header Click (Mode Change)
    const handleRoomHeaderClick = useCallback(() => {
        setRoomColumnMode(prevMode => {
            const currentIndex = ROOM_COLUMN_MODES.indexOf(prevMode);
            const nextIndex = (currentIndex + 1) % ROOM_COLUMN_MODES.length;
            console.log(`Switching room column mode from ${prevMode} to ${ROOM_COLUMN_MODES[nextIndex]}`);
            return ROOM_COLUMN_MODES[nextIndex];
        });
    }, []);

    // --- Calculations for Rendering ---

    // Visual Drag Range
    let visualDragRangeStart = null;
    let visualDragRangeEnd = null;
    if (isDragging && dragStartInfo.current?.date && dragCurrentDateStr) {
        try {
            const startDate = dragStartInfo.current.date;
            const currentDate = parseISO(dragCurrentDateStr);
            if (isDateValid(startDate) && isDateValid(currentDate)) {
                const startDay = startOfDay(startDate);
                const currentDay = startOfDay(currentDate);
                visualDragRangeStart = isBefore(startDay, currentDay) ? startDay : currentDay;
                visualDragRangeEnd = isBefore(startDay, currentDay) ? currentDay : startDay;
            }
        } catch (e) { /* Ignore */ }
    }

    // Display Dates for Header
    let displayStartDate = null;
    let displayEndDate = null;
    try {
        displayStartDate = parseISO(startDateStr);
        const currentEndDateStr = calculateEndDateStr(startDateStr, numberOfDays);
        if (currentEndDateStr) {
            displayEndDate = parseISO(currentEndDateStr);
        }
        if (!isDateValid(displayStartDate) || !isDateValid(displayEndDate)) {
             throw new Error("Calculated invalid display dates.");
        }
    } catch (e) {
        displayStartDate = null; displayEndDate = null;
        console.error("Error calculating display dates:", e);
        if (!error) setError("Invalid date range selected for display.");
    }

    // --- Render ---
    return (
        <div className="availability-view">
            <h1>Room Availability</h1>

            {/* Header Controls */}
            <div className="availability-header">
                 <div className="header-info">
                    <span>Property: {propertyId}</span>
                    <span> Viewing: {displayStartDate ? format(displayStartDate, 'MMM d, yyyy') : '...'} - {displayEndDate ? format(displayEndDate, 'MMM d, yyyy') : '...'} ({numberOfDays} days)</span>
                </div>
                <div className="date-controls">
                     <div className="date-navigation">
                        <button className="nav-button prev-button" onClick={handlePrev} disabled={isLoading} aria-label={`Previous ${numberOfDays} days`}> {'<'} </button>
                        <button className="nav-button today-button" onClick={handleGoToToday} disabled={isLoading}> Today </button>
                        <button className="nav-button next-button" onClick={handleNext} disabled={isLoading} aria-label={`Next ${numberOfDays} days`}> {'>'} </button>
                    </div>
                    <div className="view-selector">
                        <label htmlFor="view-select">View:</label>
                        <select id="view-select" value={numberOfDays} onChange={handleViewChange} disabled={isLoading}>
                            <option value="7">7 Days</option>
                            <option value="14">14 Days</option>
                            <option value="30">30 Days</option>
                            <option value="60">60 Days</option>
                            <option value="90">90 Days</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading / Error / No Data States */}
            {isLoading && <div className="loading">Loading...</div>}
            {error && <div className="error">Error: {error} <button onClick={() => {setError(null); fetchData(true);}} style={{marginLeft: '10px'}}>Retry</button></div>}
            {!isLoading && !error && gridData.rooms.length === 0 && <div className="no-data">No rooms found or data unavailable for this property/period.</div>}
            {!isLoading && !error && gridData.rooms.length > 0 && gridData.dates.length === 0 && <div className="loading">Loading date range...</div>}


            {/* Grid Table - Render only when data is ready */}
            {!isLoading && !error && gridData.rooms.length > 0 && gridData.dates.length > 0 && (
                <div ref={scrollContainerRef} className="availability-grid-container">
                    <GridTable
                        rooms={gridData.rooms}
                        dates={gridData.dates}
                        availability={gridData.availability} // Pass the full availability object
                        reservations={gridData.reservations}
                        isStaffView={gridData.isStaffView}
                        onCellClick={handleCellClick}
                        onCellMouseDown={handleMouseDownOnCell}
                        onCellMouseMove={handleMouseMoveOnCell}
                        onCellMouseUp={handleMouseUpOnCell}
                        onReservationDoubleClick={handleReservationDoubleClick}
                        isDragging={isDragging}
                        dragStartRoomId={dragStartInfo.current?.room?.id}
                        dragRangeStart={visualDragRangeStart}
                        dragRangeEnd={visualDragRangeEnd}
                        roomColumnMode={roomColumnMode}
                        onRoomHeaderClick={handleRoomHeaderClick}
                        roomColumnWidthLocked={ROOM_COLUMN_WIDTH_LOCKED}
                        roomColumnWidthSmallLocked={ROOM_COLUMN_WIDTH_SMALL_LOCKED}
                    />
                </div>
            )}

            {/* Modals - Conditionally render */}
            {/* Ensure all necessary props, including availabilityData, are passed */}
            {isBookingModalOpen && bookingModalProps.room && (
                 <BookingModal
                    isOpen={isBookingModalOpen}
                    onClose={handleCloseBookingModal}
                    room={bookingModalProps.room}
                    initialStartDate={bookingModalProps.startDate}
                    initialEndDate={bookingModalProps.endDate}
                    availabilityData={bookingModalProps.availabilityData} // Pass the data down
                    onBookingSuccess={handleBookingSuccess}
                />
            )}

            {isInfoModalOpen && selectedReservationInfo && (
                <ReservationInfoModal
                    isOpen={isInfoModalOpen}
                    onClose={handleCloseInfoModal}
                    reservation={selectedReservationInfo}
                    onBookingDeleted={handleBookingDeleted}
                    isStaffView={gridData.isStaffView}
                />
            )}
        </div>
    );
}

export default AvailabilityDashboard;