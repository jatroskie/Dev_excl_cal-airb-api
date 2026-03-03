// File: BookingModal.js
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Keep axios for the initial request
import {
    format, parseISO, differenceInDays, isValid as isDateValid,
    isBefore, addDays, startOfDay, isEqual as areDatesEqual
} from 'date-fns'; // Added startOfDay
import './BookingModal.css';

// Helper to format date for input type="date"
const formatDateForInput = (date) => {
    if (!date || !isDateValid(date)) return '';
    try {
        // Use startOfDay to potentially mitigate timezone issues affecting the date part
        return format(startOfDay(date), 'yyyy-MM-dd');
    } catch (e) {
        console.error("Error formatting date for input:", date, e);
        return '';
    }
};

// ========================================================================
// === CORRECT API Endpoint for INITIATING the Booking ===
// ========================================================================
const API_BASE_URL = 'https://api-yzrm33bhsq-uc.a.run.app'; // Replace with your actual API base URL
const INITIATE_BOOKING_URL = `${API_BASE_URL}/requestBooking`;
// ========================================================================


// ========================================================================
// === Placeholder Property Codes & Validation ===
// ========================================================================
const VALID_PROPERTY_CODES = {
    'TBA': 'The Barracks Apartments',
    'CRY': 'The Crystal',
    'TQA': 'The Quarter Apartments',
    'WFV': 'The Waterfront',
    'HES' : 'The Harbouredge Suites',
    'LAW' : 'The Lawhill Suites',
    'MPA' : 'Mouille Point Village',
    'TTBH' : 'The Trade Boutique Hotel',
    'NOTTPF' : 'Other Properties'
};

const validatePropertyCode = (code) => {
    return VALID_PROPERTY_CODES[code] ? code : 'UNKNOWN';
};
// ========================================================================


function BookingModal({
    isOpen,
    onClose,
    room, // { id, name, propertyId, actType, propRate } from parent
    initialStartDate, // Date object from parent
    initialEndDate, // Date object (exclusive) from parent
    availabilityData, // NEW PROP: Availability data { roomId: { dateStr: { status, rateDisplay }}}
    onBookingSuccess // Callback for parent to refresh grid
}) {
    // --- State ---
    // REMOVED dailyRate from initial formData state
    const [formData, setFormData] = useState({ surname: '', name: '', phone: '', discountCode: 'OTH', discountAmount: '0' });
    const [startDate, setStartDate] = useState(null); // Initialize as null
    const [endDate, setEndDate] = useState(null); // Initialize as null
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState({ message: '', type: '' });

    // NEW State for calculated costs and rate details
    const [calculatedSubtotal, setCalculatedSubtotal] = useState(0);
    const [rateDetails, setRateDetails] = useState([]); // Stores [{ date: 'yyyy-MM-dd', rate: number, error?: string }]
    const [rateCalculationError, setRateCalculationError] = useState(''); // State for rate calculation errors


    // --- Effects ---
    // Reset form when modal opens or relevant props change
    useEffect(() => {
        if (isOpen) {
            // Reset form fields to defaults or initial values
            setFormData({ surname: '', name: '', phone: '', discountCode: 'OTH', discountAmount: '0' });
            // Ensure initial dates are valid Date objects before setting
            setStartDate(initialStartDate && isDateValid(initialStartDate) ? startOfDay(initialStartDate) : null);
            setEndDate(initialEndDate && isDateValid(initialEndDate) ? startOfDay(initialEndDate) : null);
            setIsSubmitting(false);
            setSubmitResult({ message: '', type: '' });
            // Reset calculation state as well
            setCalculatedSubtotal(0);
            setRateDetails([]);
            setRateCalculationError('');
        }
    }, [isOpen, room, initialStartDate, initialEndDate]); // Dependencies that trigger reset


    // NEW Effect to calculate cost based on daily rates from availabilityData
    useEffect(() => {
        // Only calculate if we have valid dates, room, and availability data
        if (startDate && endDate && room?.id && availabilityData && isBefore(startDate, endDate)) {
            let currentSubtotal = 0;
            const details = [];
            let errorMsg = '';
            let calculationFailed = false;

            let currentDate = startOfDay(startDate); // Use startOfDay for reliable comparison
            const finalDate = startOfDay(endDate); // Exclusive end date

            while (isBefore(currentDate, finalDate)) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const roomAvailability = availabilityData[room.id];
                const dayData = roomAvailability ? roomAvailability[dateStr] : null;

                // Check if rate data is available for this specific day and room
                const rateStr = dayData?.status === 'available' ? dayData.rateDisplay : null;

                if (rateStr !== null && rateStr !== undefined && rateStr !== '') {
                    // Attempt to parse the rate string to a floating-point number
                    const numericString = rateStr.replace(/[^0-9.]/g, '');                   
                    const dailyRate = parseFloat(numericString);

                    if (!isNaN(dailyRate) && dailyRate >= 0) {
                        // Valid rate found
                        currentSubtotal += dailyRate;
                        details.push({ date: dateStr, rate: dailyRate });
                    } else {
                        // Rate string exists but is not a valid non-negative number AFTER cleaning.
                        errorMsg = `Invalid rate format ('${rateStr}' -> Parsed: ${dailyRate}) for ${dateStr}. Cannot proceed.`; // Updated error message for clarity
                        console.warn(`Invalid rate format '${rateStr}' for room ${room.id} on ${dateStr}. Cleaned: '${numericString}', Parsed: ${dailyRate}`); // Updated console log
                        details.push({ date: dateStr, rate: 0, error: 'Invalid Rate Format' });
                        calculationFailed = true;
                        break; // Stop calculation on first invalid rate
                    }
                } else {
                    // Rate is missing for this day, or the day is not 'available'
                    errorMsg = `Rate unavailable or room not available for ${dateStr}. Cannot proceed.`;
                    console.warn(`Rate missing or unavailable for room ${room.id} on ${dateStr}`);
                    details.push({ date: dateStr, rate: 0, error: 'Rate Unavailable/Missing' });
                    calculationFailed = true;
                    break; // Stop calculation on first missing rate
                }
                currentDate = addDays(currentDate, 1);
            }

            // Update state based on calculation outcome
            if (calculationFailed) {
                setCalculatedSubtotal(0); // Reset subtotal display
                setRateDetails(details); // Show details up to the point of failure
                setRateCalculationError(errorMsg); // Display the specific error
            } else {
                setCalculatedSubtotal(currentSubtotal);
                setRateDetails(details); // Store the full breakdown
                setRateCalculationError(''); // Clear any previous errors
            }

        } else {
            // Reset calculation if dates/room are invalid or data is missing
            setCalculatedSubtotal(0);
            setRateDetails([]);
            // Clear error only if the reason is invalid inputs, not missing availabilityData
            if (!startDate || !endDate || !room?.id || !isBefore(startDate, endDate)) {
                setRateCalculationError('');
            } else if (!availabilityData) {
                setRateCalculationError('Availability data not loaded.');
            }
        }
    }, [startDate, endDate, room, availabilityData]); // Dependencies for recalculation


    // --- Calculated Values ---
    const numberOfNights = startDate && endDate && isDateValid(startDate) && isDateValid(endDate) && isBefore(startDate, endDate)
        ? differenceInDays(endDate, startDate)
        : 0;

    const discountAmount = parseFloat(formData.discountAmount) || 0;
    // Use the calculated subtotal state here
    const totalCost = Math.max(0, calculatedSubtotal - discountAmount);


    // --- Event Handlers ---

    /**
     * Handles changes for text, number, tel inputs.
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: value
        }));
    };

    /**
     * Handles changes for the start date input.
     */
    const handleStartDateChange = (e) => {
        const newDateStr = e.target.value;
        if (!newDateStr) {
            setStartDate(null);
            return;
        }
        try {
            const newDate = startOfDay(parseISO(newDateStr)); // Use startOfDay
            if (isDateValid(newDate)) {
                setStartDate(newDate);
                if (endDate && !isBefore(newDate, endDate)) {
                    setEndDate(addDays(newDate, 1));
                }
            } else {
                 console.warn("Invalid start date selected:", newDateStr);
                 setStartDate(null);
            }
        } catch (error) {
            console.error("Error parsing start date:", newDateStr, error);
            setStartDate(null);
        }
    };

    /**
     * Handles changes for the end date input.
     */
    const handleEndDateChange = (e) => {
        const newDateStr = e.target.value;
         if (!newDateStr) {
             setEndDate(null);
             return;
        }
        try {
            const newDate = startOfDay(parseISO(newDateStr)); // Use startOfDay
             if (isDateValid(newDate)) {
                 if (startDate && isBefore(startDate, newDate)) {
                    setEndDate(newDate);
                 } else if (startDate && areDatesEqual(startDate, newDate)) {
                    // Handle case where end date is set same as start date (allow it, nights=0)
                    // But calculation effect requires isBefore(start, end), so warn or adjust UI
                     console.warn("Check-out date is the same as check-in date. Booking will be for 0 nights.");
                     setEndDate(newDate); // Allow setting it, but other logic handles 0 nights
                 }
                 else {
                     console.warn("End date must be on or after start date.");
                     // Optionally auto-adjust: setEndDate(addDays(startDate, 1));
                 }
            } else {
                console.warn("Invalid end date selected:", newDateStr);
                setEndDate(null);
            }
        } catch (error) {
             console.error("Error parsing end date:", newDateStr, error);
             setEndDate(null);
        }
    };

    /**
     * Handles the form submission.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitResult({ message: 'Submitting booking request...', type: '' });

        // --- Format Dates for API ---
        const checkinDateStr = startDate && isDateValid(startDate) ? format(startDate, 'yyyy-MM-dd') : '';
        const checkoutDateStr = endDate && isDateValid(endDate) ? format(endDate, 'yyyy-MM-dd') : '';
        const propertyCode = validatePropertyCode(room?.propertyId || 'UNKNOWN');

        // --- Input Validation (Client-side) ---
        // REMOVED 'dailyRate' from requiredFields
        const requiredFields = ['surname', 'name', 'phone'];
        const missing = requiredFields.filter(f => !formData[f]?.trim());

        // NEW: Check for rate calculation errors first
        if (rateCalculationError) {
             setSubmitResult({ message: rateCalculationError, type: 'error' });
             setIsSubmitting(false);
             return;
        }
        // Check if subtotal is valid (allow 0 only if nights are 0 or discount makes it 0)
        if (isNaN(calculatedSubtotal) || (calculatedSubtotal <= 0 && totalCost <= 0 && numberOfNights > 0)) {
             setSubmitResult({ message: 'Cannot proceed with zero or invalid total cost. Check rates for selected dates.', type: 'error' });
             setIsSubmitting(false);
             return;
        }

        // Check other required fields and selections
        if (missing.length > 0 || !room || propertyCode === 'UNKNOWN' || room?.id === 'UNKNOWN' || !checkinDateStr || !checkoutDateStr) {
            const missingList = missing.join(', ');
            let errorMsg = `Missing required fields or invalid selection.`;
            if (missingList) errorMsg += ` Provide: ${missingList}.`;
            if (!room || propertyCode === 'UNKNOWN' || room?.id === 'UNKNOWN') errorMsg += ` Invalid room/property selection.`;
            if (!checkinDateStr || !checkoutDateStr) errorMsg += ` Invalid dates selected.`;

            setSubmitResult({ message: errorMsg, type: 'error' });
            setIsSubmitting(false);
            return;
        }
        if (!isBefore(startDate, endDate)) {
            setSubmitResult({ message: 'Check-out date must be after Check-in date for a valid booking.', type: 'error' });
            setIsSubmitting(false);
            return;
        }
         if (numberOfNights <= 0) {
             setSubmitResult({ message: 'Booking must be for at least one night.', type: 'error' });
             setIsSubmitting(false);
             return;
         }

        // --- Prepare Data Payload for API ---
        // REMOVED dailyRate, ADDED calculated costs and details
        const bookingData = {
            // Guest Details from form
            surname: formData.surname,
            name: formData.name,
            phone: formData.phone,
            discountCode: formData.discountCode,
            discountAmount: formData.discountAmount, // Send the entered discount amount

            // Calculated Financials (Backend should validate these)
            calculatedSubtotal: calculatedSubtotal.toFixed(2), // Pre-discount total
            calculatedTotalCost: totalCost.toFixed(2),     // Final total after discount
            dailyRateDetails: rateDetails, // Send the breakdown for validation/logging

            // Booking Identifiers
            propertyId: propertyCode,
            roomId: room?.id || 'UNKNOWN',
            roomName: room?.name || 'Unknown Room',
            checkin: checkinDateStr, // 'yyyy-MM-dd'
            checkout: checkoutDateStr, // 'yyyy-MM-dd'

            // Optional: Send room details if needed by backend
            actType: room?.actType,
            propRate: room?.propRate,
        };

        try {
            // --- Call Backend API to Initiate Booking ---
            console.log(`Sending to Backend (${INITIATE_BOOKING_URL}):`, JSON.stringify(bookingData, null, 2)); // Log the payload clearly
            const response = await axios.post(INITIATE_BOOKING_URL, bookingData);
            console.log("Backend Response:", response.data);

            // --- Handle Success Response from Backend ---
            if (response.data?.status === 'success' && response.data.pendingReservationId) {
                setSubmitResult({
                    message: response.data.message || 'Booking requested successfully. Awaiting final confirmation.',
                    type: 'success'
                });

                if (onBookingSuccess) {
                    onBookingSuccess({
                        status: 'pending',
                        pendingReservationId: response.data.pendingReservationId
                    });
                }
                setTimeout(onClose, 3000); // Close modal after success

            } else {
                // Backend indicated an issue within a 2xx response
                throw new Error(response.data?.message || 'Unknown error during booking request.');
            }

        } catch (error) {
            // --- Handle Errors (Network, Server, Validation from Backend) ---
            console.error(`Booking Initiation Error (${INITIATE_BOOKING_URL}):`, error);
            let errorMessage = 'Failed to submit booking request.';
            if (error.response) {
                errorMessage = error.response.data?.message || `Server error ${error.response.status}.`;
                 if (error.response.data?.details) { // Append details if backend provides them
                    errorMessage += ` Details: ${JSON.stringify(error.response.data.details)}`;
                 }
            } else if (error.request) {
                errorMessage = 'No response from server. Check connection or server status.';
            } else {
                errorMessage = error.message;
            }
            setSubmitResult({ message: errorMessage, type: 'error' });
            setIsSubmitting(false); // Allow retry
        }
    };

    // --- Render Logic ---
    if (!isOpen) return null;

    return (
        <div className="modal-overlay-themed" onClick={onClose}>
            <div className="modal-content-themed" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button-themed" onClick={onClose} disabled={isSubmitting}>×</button>
                <h2>Create Booking</h2>
                <p>Room: <strong>{room?.name || room?.id || 'N/A'}</strong> ({validatePropertyCode(room?.propertyId || 'UNKNOWN')})</p>
                <hr className="modal-hr-themed"/>

                <form onSubmit={handleSubmit}>
                     {/* Date Inputs */}
                     <div className="date-group-themed">
                         <label htmlFor="checkin-date">Check-in:</label>
                         <input
                             type="date"
                             id="checkin-date"
                             className="modal-input-themed"
                             value={formatDateForInput(startDate)}
                             onChange={handleStartDateChange}
                             required
                             disabled={isSubmitting} />

                         <label htmlFor="checkout-date">Check-out:</label>
                         <input
                             type="date"
                             id="checkout-date"
                             className="modal-input-themed"
                             value={formatDateForInput(endDate)}
                             onChange={handleEndDateChange}
                             required
                             disabled={isSubmitting}
                             min={startDate ? formatDateForInput(addDays(startDate, 0)) : ''} // Allow same day checkout (0 nights initially)
                             />
                         <span>({numberOfNights} night{numberOfNights !== 1 ? 's' : ''})</span>
                     </div>

                    {/* Guest Detail Inputs */}
                    <label htmlFor="surname-input" className="visually-hidden">Surname</label>
                    <input
                        type="text" name="surname" placeholder="Surname" className="modal-input-themed"
                        value={formData.surname} onChange={handleInputChange} required disabled={isSubmitting} />

                    <label htmlFor="name-input" className="visually-hidden">Name</label>
                    <input
                        type="text" name="name" placeholder="Name" className="modal-input-themed"
                        value={formData.name} onChange={handleInputChange} required disabled={isSubmitting} />

                    <label htmlFor="phone-input" className="visually-hidden">Phone Number</label>
                    <input
                        type="tel" name="phone" placeholder="Phone Number" className="modal-input-themed"
                        value={formData.phone} onChange={handleInputChange} required disabled={isSubmitting} />

                    {/* REMOVED Daily Rate Input */}

                    <label htmlFor="discountCode-input" className="visually-hidden">Discount Code</label>
                    <input
                        type="text" name="discountCode" placeholder="Discount Code (Default: OTH)" className="modal-input-themed"
                        value={formData.discountCode} onChange={handleInputChange} disabled={isSubmitting} />

                    <label htmlFor="discountAmount-input" className="visually-hidden">Discount Amount</label>
                    <input
                        type="number" name="discountAmount" placeholder="Discount Amount (e.g. 100)" className="modal-input-themed"
                        value={formData.discountAmount} onChange={handleInputChange} disabled={isSubmitting}
                        step="0.01" min="0"
                        max={calculatedSubtotal > 0 ? calculatedSubtotal : 0} // Max discount is the subtotal
                        />

                    {/* Status Display */}
                    {isSubmitting && (
                        <div className="processing-status">
                            <div className="spinner"></div>
                            <div>{submitResult.message || 'Processing...'}</div>
                        </div>
                    )}
                    {!isSubmitting && submitResult.message && (
                        <div className={`modal-result-themed ${submitResult.type === 'success' ? 'modal-result-success-themed' : 'modal-result-error-themed'}`}>
                            {submitResult.message}
                        </div>
                    )}

                    {/* Display Rate Calculation Error (if any) */}
                    {rateCalculationError && !isSubmitting && (
                         <div className="modal-result-themed modal-result-error-themed" style={{ marginTop: '10px' }}>
                             <strong>Rate Calculation Error:</strong> {rateCalculationError}
                         </div>
                     )}


                    {/* NEW: Cost Summary (uses calculated state) */}
                    <div className="cost-summary-container">
                         {/* Optional: Display average rate if useful
                           <div className="cost-summary-row">
                             <span>Avg. Daily Rate:</span>
                             <span>{(numberOfNights > 0 ? calculatedSubtotal / numberOfNights : 0).toFixed(2)}</span>
                         </div> */}
                        <div className="cost-summary-row">
                            <span>Nights:</span>
                            <span>{numberOfNights}</span>
                        </div>
                        <div className="cost-summary-row">
                            <span>Subtotal:</span>
                            {/* Show subtotal only if calculation hasn't failed */}
                            <span>{rateCalculationError ? 'N/A' : calculatedSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="cost-summary-row">
                            <span>Discount:</span>
                             {/* Only show discount if applicable */}
                             <span>{discountAmount > 0 ? `-${discountAmount.toFixed(2)}` : '0.00'}</span>
                        </div>
                        <div className="cost-summary-row total-row">
                            <span>Total:</span>
                            {/* Show total only if calculation hasn't failed */}
                            <span>{rateCalculationError ? 'N/A' : totalCost.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Button Group */}
                    <div className="modal-button-group-themed">
                        <button
                            type="submit"
                            className="modal-button-themed modal-button-primary-themed"
                            // Disable if submitting, or if there's a rate error, or if dates are invalid/0 nights
                            disabled={isSubmitting || !!rateCalculationError || !startDate || !endDate || !isBefore(startDate, endDate) || numberOfNights <= 0}
                            >
                            {isSubmitting ? 'Requesting...' : 'Request Booking'}
                        </button>
                        <button
                            type="button"
                            className="modal-button-themed modal-button-secondary-themed"
                            onClick={onClose}
                            disabled={isSubmitting}>
                            Cancel
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default BookingModal;