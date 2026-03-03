// File: GridTable.js
import React, { useMemo } from 'react'; // Ensure React is imported
import {
    parseISO, differenceInDays, format, isBefore, isAfter, addDays,
    isValid as isDateValid, startOfDay, isEqual as areDatesEqual
} from 'date-fns';
import './GridTable.css'; // Ensure styles are imported

// --- Constants ---
const ROW_HEIGHT_PX = 38;
const CELL_WIDTH_PX = 60;

// --- Helper Functions ---
const isToday = (dateStr, todayDateStr) => dateStr === todayDateStr;

const getRoomNumberFromName = (name) => {
    if (!name || typeof name !== 'string') return 'N/A';
    const parts = name.split('-');
    // Robust check: Return first part if split works, otherwise original name or N/A
    return parts.length > 0 ? parts[0].trim() : (name || 'N/A');
};

// ==================================
// Base Cell Component
// (Displays status, handles interaction, and shows rateDisplay if available)
// ==================================
const BaseGridCell = ({
    room,
    dateStr,
    statusData, // Object like { status: '...', rateDisplay: '...', guestName: '...' }
    isToday,
    onClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    isDragging,
    dragStartRoomId,
    dragRangeStart, // Date object or null
    dragRangeEnd,   // Date object or null
    isStaffView,
    style // Grid positioning style from parent
}) => {
    let statusString = 'error';
    let cellContent = null; // Custom content like vertical text
    let reservationStatus = null; // Raw reservation status for tooltips etc.
    let rateDisplay = null; // Rate string from backend

    // Process statusData object safely
    if (typeof statusData === 'object' && statusData !== null) {
        statusString = statusData.status || 'error';
        reservationStatus = statusData.reservationStatus; // For staff tooltip

        // Check for rate display information if the cell is available
        if (statusString === 'available' && typeof statusData.rateDisplay === 'string' && statusData.rateDisplay.trim() !== '') {
            rateDisplay = statusData.rateDisplay;
        }

        // Handle specific display text overrides (e.g., vertical text)
        // Ensure room exists before accessing properties
        if (room && typeof statusData.display === 'string' && statusData.display.includes(`${room.roomNumber || ''}-URB`) ) {
             cellContent = <span className="base-cell-vertical-text">{statusData.display.replace(/-/g, '\n')}</span>;
        } else if (statusData.displayText) {
             cellContent = <span className="base-cell-text">{statusData.displayText}</span>;
        }
    } else if (typeof statusData === 'string') {
        // Handle legacy/simple status string if necessary (fallback)
        statusString = statusData;
    }

    const isAvailable = statusString === 'available';
    // Ensure callbacks exist before assigning handlers
    const isClickable = isAvailable && typeof onClick === 'function';
    const isDraggable = isAvailable && typeof onMouseDown === 'function';

    // --- Drag Range Highlighting ---
    let isInDragRange = false;
    if (isDragging && dragStartRoomId === room?.id && dragRangeStart instanceof Date && dragRangeEnd instanceof Date && isDateValid(dragRangeStart) && isDateValid(dragRangeEnd)) {
        try {
            const cellDate = startOfDay(parseISO(dateStr));
            if (isDateValid(cellDate)) {
                // Check if cellDate is within or equal to the drag range start/end
                if (
                    (areDatesEqual(cellDate, dragRangeStart) || isAfter(cellDate, dragRangeStart)) &&
                    (areDatesEqual(cellDate, dragRangeEnd) || isBefore(cellDate, dragRangeEnd))
                   ) {
                     isInDragRange = true;
                 }
            }
        } catch (e) { console.error(`Error checking drag range for date ${dateStr}:`, e); } // Handle parsing error
    }

    // --- CSS Classes ---
    const cellClass = `grid-cell base-cell cell-base-${statusString}${isToday ? ' is-today' : ''}${isInDragRange ? ' is-in-drag-range' : ''}`;

    // --- Tooltip (Title Attribute) ---
    let cellTitle = statusString.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Default title
     if (statusString.startsWith('occupied')) {
         if (isStaffView && typeof statusData === 'object') {
             cellTitle = `Occupied: ${statusData.guestName || 'N/A'}`;
             if (statusString === 'occupied_confirmed' || statusString === 'occupied') {
                 cellTitle += ` (#${statusData.confNum || 'N/A'})`;
             } else if (statusString === 'occupied_pending') {
                 cellTitle += ` (Pending Confirmation...)`;
             } else if (statusString === 'occupied_error') {
                  cellTitle += ` (Error: ${statusData.errorMessage || reservationStatus || 'Booking Failed'})`;
             }
             cellTitle += ` [${reservationStatus || statusData.status || 'Unknown'}]`; // Show raw status
         } else {
             cellTitle = 'Occupied'; // Non-staff view
         }
     } else if (isAvailable) {
         cellTitle = `Click or Drag to book ${room?.name || room?.id || 'N/A'} on ${dateStr || 'N/A'}`;
         if (rateDisplay) {
             cellTitle += ` (Rate: ${rateDisplay})`; // Add rate to tooltip
         } else if (statusData?.rateDisplay === null || statusData?.rateDisplay === undefined || statusData?.rateDisplay === '') {
             cellTitle += ` (Rate N/A)`; // Explicitly state if rate is not available
         }
     } else if (statusString === 'blocked' && typeof statusData === 'object') {
         cellTitle = `Blocked: ${statusData.reason || 'Reason N/A'}`;
     } else if (statusString === 'error') {
         cellTitle = `Error: ${statusData?.reason || 'Data unavailable'}`;
     }
     // Add more statuses as needed

    // --- Event Handlers ---
    // Prevent calling handlers if not applicable (e.g., on non-available cells)
    const handleClick = (event) => { if (isClickable) onClick(room, dateStr, event); };
    const handleMouseDown = (event) => { if (isDraggable) onMouseDown(room, dateStr, event); };
    // Pass through move/up events if handlers are provided (no availability check needed)
    const handleMouseMove = (event) => { if (typeof onMouseMove === 'function') onMouseMove(room, dateStr, event); };
    const handleMouseUp = (event) => { if (typeof onMouseUp === 'function') onMouseUp(room, dateStr, event); };

    const interactiveStyle = (isClickable || isDraggable) ? { cursor: 'pointer' } : {};

    return (
        <div
            className={cellClass}
            title={cellTitle}
            style={{ ...style, ...interactiveStyle, position: 'relative' }} // Added position relative for rate span
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            // Prevent native drag and drop which interferes
            onDragStart={(e) => e.preventDefault()}
        >
           {/* Display custom content OR rate OR default space */}
           {cellContent || (isAvailable && rateDisplay && <span className="daily-rate">{rateDisplay}</span>) || <> </>}
           {/* Render rate if available and no other content is set, otherwise non-breaking space */}
        </div>
    );
};


// ==================================
// Booking Block Component (Overlay)
// ==================================
const BookingBlock = ({
    reservation, gridInfo, isStaffView, onDoubleClick
}) => {
    // Destructure gridInfo safely
    const { datesMap, roomsMap, gridStartDate, currentRoomColumnWidth } = gridInfo || {};

    // Validate essential props
    if (!reservation || !gridInfo || !datesMap || !roomsMap || !gridStartDate) {
        console.warn("BookingBlock rendered with missing props:", { reservation, gridInfo });
        return null;
    }

    const blockHeightPercentage = 0.80;
    const blockHeight = ROW_HEIGHT_PX * blockHeightPercentage;
    const verticalMargin = ROW_HEIGHT_PX * (1 - blockHeightPercentage) / 2;

    let blockStartDate, blockEndDate;
    try {
        // Backend now sends dates as strings 'yyyy-MM-dd'
         blockStartDate = parseISO(reservation.checkInDate);
         blockEndDate = parseISO(reservation.checkOutDate); // This is EXCLUSIVE end date

         if (!isDateValid(blockStartDate) || !isDateValid(blockEndDate) || !isAfter(blockEndDate, blockStartDate)) {
             throw new Error(`Invalid parsed dates: Start=${blockStartDate}, End=${blockEndDate}`);
         }
    } catch(e) {
        console.error(`Error parsing reservation dates for block (ID: ${reservation.fbId}):`, e.message, reservation.checkInDate, reservation.checkOutDate);
        return null; // Don't render block if dates are invalid
    }

    // Determine grid view boundaries
    const gridViewStartDate = gridStartDate; // Date object
    // Calculate end date based on number of dates shown
    const gridViewEndDate = datesMap.size > 0 ? addDays(gridStartDate, datesMap.size) : gridStartDate; // Exclusive end date

    if (!isDateValid(gridViewStartDate) || !isDateValid(gridViewEndDate)) {
        console.error("BookingBlock: Invalid grid view dates calculated.");
        return null;
    }

    // --- Check if block is outside the current view ---
    const reservationStartDay = startOfDay(blockStartDate);
    const reservationEndDay = startOfDay(blockEndDate); // Compare start of days
    const viewStartDay = startOfDay(gridViewStartDate);
    const viewEndDay = startOfDay(gridViewEndDate); // Compare start of days

    // Block ends before view starts OR block starts on or after the day the view ends
    if (isBefore(reservationEndDay, viewStartDay) || !isBefore(reservationStartDay, viewEndDay)) {
        return null; // Reservation is entirely outside the date range
    }

    // Find row index
    const rowIndex = roomsMap.get(reservation.roomId);
    if (rowIndex === undefined) {
         // This might happen temporarily if rooms/reservations update separately
         // console.warn(`BookingBlock: Room ID ${reservation.roomId} not found in roomsMap for reservation ${reservation.fbId}.`);
         return null; // Room not visible in current grid
    }

    // Calculate vertical position
    const topPos = ((rowIndex + 1) * ROW_HEIGHT_PX) + verticalMargin; // +1 for header row

    // Calculate horizontal position and width
    let startPixel, endPixel;
    const startsBeforeView = isBefore(reservationStartDay, viewStartDay);
    // Ends after view means the check-out day is AFTER the last day shown in the grid
    const endsAfterView = isAfter(reservationEndDay, viewEndDay) || areDatesEqual(reservationEndDay, viewEndDay);


    const getColIndex = (date) => {
        // Check date object, format to string key for map lookup
        if (!(date instanceof Date && isDateValid(date))) return undefined;
        return datesMap.get(format(date, 'yyyy-MM-dd'));
    };

    // Determine start pixel
    if (startsBeforeView) {
        startPixel = 0; // Starts off-screen left
    } else {
        const startColIndex = getColIndex(blockStartDate);
        // Position starts in the middle of the check-in day cell
        startPixel = startColIndex === undefined ? 0 : (startColIndex * CELL_WIDTH_PX) + (CELL_WIDTH_PX / 2);
    }

    // Determine end pixel
    if (endsAfterView) {
        endPixel = datesMap.size * CELL_WIDTH_PX; // Ends off-screen right (fill to edge)
    } else {
        // The block ENDS *before* the checkOutDate. The last occupied day is checkOutDate - 1 day.
        const lastOccupiedDay = addDays(blockEndDate, -1);
        const endCellColIndex = getColIndex(lastOccupiedDay); // Get column index of the last day

        if (endCellColIndex === undefined) {
            // Fallback if last day not found (shouldn't happen often)
            console.warn(`BookingBlock: Could not find column index for last occupied day ${format(lastOccupiedDay, 'yyyy-MM-dd')}`);
            endPixel = startPixel + CELL_WIDTH_PX; // Default to one cell width
        } else {
             // Position ends in the middle of the cell AFTER the last occupied day
             endPixel = ((endCellColIndex + 1) * CELL_WIDTH_PX) + (CELL_WIDTH_PX / 2);
        }
    }

    const calculatedWidth = endPixel - startPixel;
    // Ensure minimum width (e.g., half a cell) to remain visible, prevent negative width
    const finalWidthPx = Math.max(CELL_WIDTH_PX / 2, calculatedWidth);

    if (finalWidthPx <= 0) {
        console.warn(`BookingBlock: Calculated zero or negative width for reservation ${reservation.fbId}.`);
        return null; // Avoid rendering zero-width blocks
    }

    const leftOffset = currentRoomColumnWidth || 0; // Width of the sticky room column, default to 0 if undefined
    const finalLeftPos = leftOffset + startPixel;

    const style = {
        position: 'absolute',
        top: `${topPos}px`,
        left: `${finalLeftPos}px`,
        width: `${finalWidthPx}px`,
        height: `${blockHeight}px`,
        zIndex: 5, // Ensure blocks are above base cells
    };

    // Determine styling and text based on status
    let blockClass = 'booking-block';
    let statusText = ''; // Additional text for staff view
    const reservationStatus = reservation.status || 'Unknown'; // Use status from reservation object

    if (reservationStatus === 'Confirmed' || reservationStatus === 'confirmed') {
        blockClass += ' booking-block-confirmed';
    } else if (reservationStatus === 'Pending Confirmation' || reservationStatus === 'pending') {
        blockClass += ' booking-block-pending';
        if(isStaffView) statusText = ' (Pending)';
    } else if (typeof reservationStatus === 'string' && reservationStatus.toLowerCase().startsWith('error')) {
        blockClass += ' booking-block-error';
        if(isStaffView) statusText = ' (Error)';
    } else {
         // Default to confirmed style if status is unknown or unexpected
         blockClass += ' booking-block-confirmed';
    }

    // Display text within the block
    const displayText = isStaffView ? `${reservation.guestName || 'Occupied'}${statusText}` : 'Occupied';

    // Tooltip for the block
    const originalNights = differenceInDays(blockEndDate, blockStartDate); // Use parsed date objects
    let blockTitle = `${reservation.guestName || 'Occupied'} (#${reservation.operaConfirmationNumber || reservation.fbId || 'N/A'})`;
    blockTitle += ` - In: ${format(blockStartDate, 'MMM d')} / Out: ${format(blockEndDate, 'MMM d')}`; // Show exclusive end date
    blockTitle += ` (${originalNights} night${originalNights !== 1 ? 's' : ''})`;
    if (isStaffView) {
        blockTitle += ` - Status: ${reservationStatus}`;
        if (reservation.errorMessage) { // Display error message if present
            blockTitle += ` - Details: ${reservation.errorMessage}`;
        }
    }

    const handleDoubleClickInternal = (e) => {
        e.stopPropagation(); // Prevent click from propagating to base cell
        if (typeof onDoubleClick === 'function') {
            onDoubleClick(reservation); // Pass the full reservation object
        }
    };

    return (
        <div
            className={blockClass}
            style={style}
            title={blockTitle}
            onDoubleClick={handleDoubleClickInternal} // Use internal handler
        >
            <span className="booking-text">{displayText}</span>
        </div>
    );
};


// ==================================
// Main GridTable Component
// ==================================
function GridTable({
    // Data Props
    rooms,
    dates,
    availability, // Includes rateDisplay from backend
    reservations,
    isStaffView,
    // Interaction Callbacks
    onCellClick,
    onCellMouseDown,
    onCellMouseMove,
    onCellMouseUp,
    onReservationDoubleClick,
    // Drag State Props
    isDragging,
    dragStartRoomId,
    dragRangeStart, // Date object or null
    dragRangeEnd,   // Date object or null
    // Mode Props
    roomColumnMode,
    onRoomHeaderClick,
    roomColumnWidthLocked,
    roomColumnWidthSmallLocked,
}) {

    // ======================== HOOKS CALLED AT TOP LEVEL ========================
    const datesMap = useMemo(() => {
        if (!Array.isArray(dates)) return new Map();
        return new Map(dates.map((date, index) => [date, index]));
    }, [dates]);

    const roomsMap = useMemo(() => {
        if (!Array.isArray(rooms)) return new Map();
        return new Map(rooms.map((room, index) => [room.id, index]));
    }, [rooms]);

    const gridStartDate = useMemo(() => {
        try {
            if (!Array.isArray(dates) || dates.length === 0) return null;
            const parsed = parseISO(dates[0]);
            return isDateValid(parsed) ? parsed : null;
        } catch (e) {
            console.error("Error parsing grid start date in useMemo:", e);
            return null;
         }
    }, [dates]);

    const currentRoomColumnWidth = useMemo(() => {
        switch(roomColumnMode) {
            case 'small-locked': return roomColumnWidthSmallLocked;
            case 'locked': return roomColumnWidthLocked;
            default: return roomColumnWidthLocked;
        }
    }, [roomColumnMode, roomColumnWidthLocked, roomColumnWidthSmallLocked]);

    const todayDateStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const gridInfo = useMemo(() => ({
        datesMap,
        roomsMap,
        gridStartDate,
        currentRoomColumnWidth
    }), [datesMap, roomsMap, gridStartDate, currentRoomColumnWidth]);
    // ======================== END OF HOOKS ========================


    // --- Data Validation (AFTER Hooks) ---
    if (!Array.isArray(rooms) || !Array.isArray(dates) || typeof availability !== 'object' || availability === null) {
        console.error("GridTable Rendering Error: Missing or invalid core data props (rooms, dates, availability).");
        return <div className="error">Grid Data Incomplete or Invalid.</div>;
    }
    if (!gridStartDate) {
        console.error("GridTable Rendering Error: Could not determine a valid grid start date.", dates);
        return <div className="error">Error initializing grid dates. Invalid format or empty date array.</div>;
    }
    if (rooms.length > 0 && dates.length === 0) {
          console.warn("GridTable: Rooms loaded, but no dates available yet.");
          return <div className="loading">Loading dates...</div>;
    }
    if (rooms.length === 0) {
         console.warn("GridTable: No room data provided.");
         return <div className="no-data">No room data available.</div>;
    }

    // --- Tooltip for Room Header ---
    let roomHeaderTitle = "Click to change Room column mode";
    if (roomColumnMode === 'locked') roomHeaderTitle += " (Current: Full Width)";
    else if (roomColumnMode === 'small-locked') roomHeaderTitle += " (Current: Small Width)";


    // --- Render Grid ---
    return (
        <div className="grid-scroll-container">
            <div
                className="grid-table"
                style={{
                    '--num-date-columns': dates.length,
                    '--cell-width': `${CELL_WIDTH_PX}px`,
                    '--row-height': `${ROW_HEIGHT_PX}px`,
                    '--room-column-width': `${currentRoomColumnWidth}px`
                 }}
             >

                {/* --- Sticky Headers --- */}
                 <div
                     className="grid-header grid-cell room-header-sticky"
                     style={{ gridColumn: 1, gridRow: 1, width: `${currentRoomColumnWidth}px`, cursor: 'pointer' }}
                     onClick={onRoomHeaderClick}
                     title={roomHeaderTitle}
                 >
                     Room #
                 </div>

                {dates.map((dateStr, dateIndex) => {
                    let formattedDate = '??-??';
                    let isHeaderToday = false;
                    try {
                        const parsedDate = parseISO(dateStr);
                        if (!isDateValid(parsedDate)) throw new Error("Invalid date");
                        formattedDate = format(parsedDate, 'dd-MM');
                        isHeaderToday = isToday(dateStr, todayDateStr);
                    } catch (e) { console.error(`Error formatting date header for ${dateStr}:`, e); }
                    const headerClass = `grid-header grid-cell date-header${isHeaderToday ? ' is-today' : ''}`;
                    const style = { gridColumn: dateIndex + 2, gridRow: 1 };
                    return <div key={`${dateStr}-header`} className={headerClass} style={style}>{formattedDate}</div>;
                })}

                 {rooms.map((room, rowIndex) => {
                    const roomName = room.name || room.id || 'N/A';
                    const displayContent = roomColumnMode === 'small-locked'
                        ? getRoomNumberFromName(roomName)
                        : roomName;
                    const roomCellStyle = {
                        gridColumn: 1,
                        gridRow: rowIndex + 2,
                        width: `${currentRoomColumnWidth}px`,
                        whiteSpace: roomColumnMode === 'small-locked' ? 'nowrap' : 'normal',
                        overflow: roomColumnMode === 'small-locked' ? 'hidden' : 'visible',
                        textOverflow: roomColumnMode === 'small-locked' ? 'ellipsis' : 'clip',
                    };
                    return (
                        <div
                            key={`${room.id}-room-name`}
                            className="grid-cell room-id-sticky"
                            style={roomCellStyle}
                            title={roomName}
                        >
                            {displayContent}
                        </div>
                    );
                 })}

                {/* --- Base Availability Cells --- */}
                {rooms.map((room, rowIndex) => (
                    dates.map((dateStr, dateIndex) => {
                        // Safely access availability data
                        const statusData = availability?.[room?.id]?.[dateStr] || { status: 'error', reason: 'Data missing' };
                        const cellIsToday = isToday(dateStr, todayDateStr);
                        const style = { gridRow: rowIndex + 2, gridColumn: dateIndex + 2 };

                        return (
                            <BaseGridCell
                                key={`${room.id}-${dateStr}-base`}
                                room={room}
                                dateStr={dateStr}
                                statusData={statusData}
                                isToday={cellIsToday}
                                onClick={onCellClick}
                                onMouseDown={onCellMouseDown}
                                onMouseMove={onCellMouseMove}
                                onMouseUp={onCellMouseUp}
                                isDragging={isDragging}
                                dragStartRoomId={dragStartRoomId}
                                dragRangeStart={dragRangeStart}
                                dragRangeEnd={dragRangeEnd}
                                isStaffView={isStaffView}
                                style={style}
                            />
                        );
                    })
                ))}

                {/* --- Booking Block Overlays --- */}
                 {(reservations || []) // Ensure reservations is an array
                    .filter(res => res?.roomId && roomsMap?.has(res.roomId)) // Safely filter
                    .map((res) => (
                        <BookingBlock
                             key={res.fbId || `res-${res.operaConfirmationNumber}-${res.roomId}-${res.checkInDate}`}
                             reservation={res}
                             gridInfo={gridInfo} // Pass memoized grid info
                             isStaffView={isStaffView}
                             onDoubleClick={onReservationDoubleClick}
                        />
                 ))}

            </div> {/* End .grid-table */}
        </div> // End .grid-scroll-container
    );
}

export default GridTable;