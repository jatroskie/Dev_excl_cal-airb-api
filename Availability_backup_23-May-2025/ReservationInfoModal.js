// File: ReservationInfoModal.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, isValid as isDateValid } from 'date-fns'; // Single import for date functions
import './ReservationInfoModal.css';

// API Endpoint
const API_BASE_URL = 'https://api-yzrm33bhsq-uc.a.run.app';
const DELETE_BOOKING_URL_BASE = `${API_BASE_URL}/deleteBooking`;

// Helper to format date (handles 'YYYY-MM-DD' strings based on previous logs)
const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';

    let date;
    // If it might sometimes be a Timestamp, keep the check. Otherwise, simplify.
    if (dateInput && dateInput.toDate && typeof dateInput.toDate === 'function') {
        try { date = dateInput.toDate(); } catch (error) { date = null; }
    } else {
        // Primarily expecting strings like 'YYYY-MM-DD' or potentially numbers
        try { date = new Date(dateInput); } catch(error) { date = null; }
    }

    // Use the imported isDateValid function
    const isValid = isDateValid(date);

    if (isValid) {
        // Use the imported format function
        return format(date, 'MMM d, yyyy');
    } else {
        console.warn('formatDate: Resulting date is invalid for input:', dateInput);
        return 'Invalid Date';
    }
};

// Helper function to format rate display (handles numbers and "NUMBER CURRENCY" strings)
// Helper function to format rate display (DEBUGGING VERSION)
const formatRateDisplay = (rateInput) => {
    console.log("--- formatRateDisplay ---"); // Add a marker for clarity
    console.log("Input received:", rateInput, "| Type:", typeof rateInput);

    if (rateInput == null) { // Handles null or undefined
        console.log("Result: Input is null/undefined. Returning 'N/A'.");
        return 'N/A';
    }

    if (typeof rateInput === 'number') { // Handle if it's already a number
        console.log("Result: Input is a number. Formatting and returning:", rateInput.toFixed(2));
         return rateInput.toFixed(2);
    }

    if (typeof rateInput === 'string') {
        console.log("Processing: Input is a string.");
        // 1. Extract potential numeric part using regex
        const match = rateInput.match(/^[+-]?[\d,.]+/);
        const potentialNumberString = match ? match[0] : null;
        console.log(" -> Regex match result (potentialNumberString):", potentialNumberString);

        if (potentialNumberString) {
             // 2. Remove thousand separators (commas)
            const cleanedString = potentialNumberString.replace(/,/g, '');
            console.log(" -> String after removing commas (cleanedString):", cleanedString);

            // 3. Convert to number
            const numericValue = parseFloat(cleanedString);
            console.log(" -> Result of parseFloat (numericValue):", numericValue);

            // 4. Check if conversion was successful and format
            if (!isNaN(numericValue)) {
                const formattedRate = numericValue.toFixed(2);
                console.log("Result: Parsed number is valid. Formatting and returning:", formattedRate);
                return formattedRate; // "1400.00"
            } else {
                 console.log("Warning: parseFloat resulted in NaN.");
            }
        } else {
            console.log("Warning: Regex did not find a numeric part at the start of the string.");
        }
    } else {
         console.log("Warning: Input type is not null/undefined, number, or string.");
    }

    // If it couldn't be processed
    console.warn("Fallback: Could not format rate display for the input. Returning 'N/A'.");
    return 'N/A';
};


function ReservationInfoModal({
    isOpen,
    onClose,
    reservation, // Expecting object with 'fbId' as the key property
    onBookingDeleted
}) {

    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteResult, setDeleteResult] = useState({ message: '', type: '' });

    useEffect(() => {
        // Reset state when modal opens
        if (isOpen) {
            setIsDeleting(false);
            setDeleteResult({ message: '', type: '' });
            // console.log("Reservation data in modal:", reservation); // Keep for debugging if needed
        }
    }, [isOpen]); // Only depends on isOpen for resetting state

    const handleDelete = async () => {
        // Use fbId for checks and URL
        if (!reservation || !reservation.fbId /*|| reservation.operaConfirmationNumber */) {
            setDeleteResult({ message: 'Cannot delete this reservation (missing ID or confirmed).', type: 'error' });
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the booking for ${reservation.guestName || 'this guest'}?`)) {
            return;
        }

        setIsDeleting(true);
        setDeleteResult({ message: 'Deleting reservation...', type: 'info' });

        const deleteUrl = `${DELETE_BOOKING_URL_BASE}/${reservation.fbId}`;

        try {
            console.log(`Sending DELETE request to: ${deleteUrl}`);
            const response = await axios.delete(deleteUrl);
            console.log("Delete Response:", response.data);

            if (response.status === 200 || response.status === 204 || response.data?.status === 'success') {
                setDeleteResult({ message: response.data?.message || 'Reservation deleted successfully.', type: 'success' });
                if (onBookingDeleted) {
                    onBookingDeleted(reservation.fbId); // Pass fbId back
                }
                setTimeout(onClose, 2000); // Close modal after success message
            } else {
                // Handle non-2xx responses that might indicate failure
                throw new Error(response.data?.message || `Server responded with status ${response.status}.`);
            }
        } catch (error) {
            console.error(`Booking Deletion Error (${deleteUrl}):`, error);
            let errorMessage = 'Failed to delete reservation.';
            if (error.response) {
                // Prefer server's error message if available
                errorMessage = error.response.data?.message || `Server error: ${error.response.status}.`;
            } else if (error.request) {
                // Network error or no response
                errorMessage = 'No response from server. Check network connection.';
            } else {
                // Other errors (e.g., coding error before request)
                errorMessage = error.message;
            }
            setDeleteResult({ message: errorMessage, type: 'error' });
            setIsDeleting(false); // Allow user to try again or close
        }
    };

    // Determine if the delete button should be shown
    const canDelete = isOpen && reservation && reservation.fbId //&& !reservation.operaConfirmationNumber;

    // Don't render anything if modal is not open or no reservation data
    if (!isOpen || !reservation) { return null; }

    // Determine status color more robustly
    const getStatusColor = (status) => {
        const lowerStatus = status?.toLowerCase() || '';
        if (lowerStatus === 'confirmed' || lowerStatus === 'in house') return 'green';
        if (lowerStatus.startsWith('error')) return 'red';
        if (lowerStatus.includes('pending')) return 'orange'; // Handle different pending types
        return 'grey'; // Default color for unknown statuses
    };

    return (
        <div className="modal-overlay-themed" onClick={onClose}>
            <div className="modal-content-themed reservation-info-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button-themed" onClick={onClose} disabled={isDeleting}>×</button>
                <h2>Reservation Details</h2>

                <p><strong>ID:</strong> {reservation.fbId || 'N/A'}</p>
                <p><strong>Guest:</strong> {reservation.guestName || 'N/A'}</p>
                <p><strong>Phone:</strong> {reservation.phone || 'N/A'}</p>
                <p><strong>Room:</strong> {reservation.roomName || reservation.roomId || 'N/A'} ({reservation.propertyId || 'N/A'})</p>
                <p><strong>Check-in:</strong> {formatDate(reservation.checkInDate)}</p>
                <p><strong>Check-out:</strong> {formatDate(reservation.checkOutDate)}</p>
                {/* Use the rate formatting helper function */}
                <p><strong>Rate:</strong> {formatRateDisplay(reservation.rate)}</p>
                {/* Use helper for status color */}
                <p><strong>Status:</strong> <strong style={{ color: getStatusColor(reservation.status) }}>{reservation.status || 'Unknown'}</strong></p>
                {/* Conditionally display Confirmation # and Error Message */}
                {reservation.operaConfirmationNumber && ( <p><strong>Confirmation #:</strong> {reservation.operaConfirmationNumber}</p> )}
                {reservation.errorMessage && ( <p style={{ color: 'red', fontSize: '0.9em' }}><strong>Error Msg:</strong> {reservation.errorMessage}</p> )}

                <hr className="modal-hr-themed" style={{ margin: '15px 0' }}/>

                {/* Deletion Status Area */}
                {(isDeleting || deleteResult.message) && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                        {isDeleting && (
                            <div className="processing-status">
                                <div className="spinner"></div> {/* Assume you have CSS for .spinner */}
                                <div>{deleteResult.message || 'Processing...'}</div>
                            </div>
                        )}
                        {!isDeleting && deleteResult.message && (
                            <div className={`modal-result-themed ${deleteResult.type === 'success' ? 'modal-result-success-themed' : 'modal-result-error-themed'}`}>
                                {deleteResult.message}
                            </div>
                        )}
                    </div>
                 )}

                {/* Action Buttons Area */}
                 <div className="modal-actions-themed" style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    {/* Show delete button only if allowed */}
                    {canDelete && (
                        <button
                            type="button"
                            className="modal-button-themed modal-button-delete-themed"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Booking'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="modal-button-themed"
                        onClick={onClose}
                        disabled={isDeleting} // Disable close button while deleting
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReservationInfoModal;