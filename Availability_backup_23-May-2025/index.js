// functions/index.js - Complete Version with Pending Booking Flow & Updated Availability

// --- Core Firebase Modules ---
const functions = require('firebase-functions');
const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore'); // Explicitly import Timestamp
// --- Dependencies ---
const { logger } = require("firebase-functions/v2");
const express = require('express');

const {
    onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted
} = require("firebase-functions/v2/firestore"); // <-- ADD THIS for v2 Firestore triggers

const { onCall, HttpsError } = require("firebase-functions/v2/https");

const cors = require('cors');
const ical = require('ical-generator'); 


const axios = require('axios'); // <-- ADDED for making HTTP requests
const {
    startOfDay,
    endOfDay,
    eachDayOfInterval,
    isBefore,
    isAfter,         // <-- ADDED (might be used in getAvailability or elsewhere)
    areDatesEqual,   // <-- ADDED (might be used in getAvailability or elsewhere)
    parseISO,
    format,
    parse,           // <-- For simple-ical string parsing
    isValid, // Import isValid and alias it
    getDay,
    isWithinInterval,
    differenceInDays, // <-- ADDED for calculating number of nights
    addDays // <<<----- ADD THIS 
} = require('date-fns');

const isDateValid = isValid; 
// --- Initialize Firebase Admin SDK (Once) ---
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// --- Express App Setup ---
const app = express();
app.use(cors({ origin: true })); // Enable CORS
app.use(express.json({ limit: '20mb' })); // Parse JSON bodies

const roomStatesController = require('./roomStates.js');
exports.updateDailyRoomStates = roomStatesController.updateDailyRoomStates;



// --- Constants ---
const OPERA_CAPTURE_URL = 'https://vprop.co.za/resLoader'; // URL of the external service
// Define a secret key for the callback endpoint (MUST match config on external service)
// Use Firebase Functions environment configuration for secrets!
// Set using: firebase functions:config:set external_api.secret="YOUR_SUPER_SECRET_KEY"
const CALLBACK_SECRET = process.env.CALLBACK_SECRET || 'mhxUQmHG-eRDJN1svXaBZt3jr-ezTV29ijUIfyA8Ea-p9EhJY38#'; // Default/fallback ONLY for testing
const COST_VALIDATION_TOLERANCE = 0.01; // Allow 1 cent difference for floating point

// --- Helper Functions ---
const foldLines = (content) => {
    const lines = content.split('\r\n');
    const foldedLines = lines.map(line => {
      if (line.length <= 75) return line;
      let result = ''; let currentLine = line;
      while (currentLine.length > 75) {
        result += currentLine.substring(0, 75) + '\r\n ';
        currentLine = currentLine.substring(75);
      }
      result += currentLine; return result;
    });
    return foldedLines.join('\r\n');
};

const formatDateForIcal = (date) => {
    // Input 'date' should be a valid JavaScript Date object
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        functions.logger.error('[formatDateForIcal] Received invalid date object:', { dateValue: date, type: typeof date });
        throw new Error('Invalid date object for iCal formatting');
    }
    // Format as YYYYMMDD required by iCal DATE value type
    return format(date, 'yyyyMMdd');
};


// --- Express Routes Defined on 'app' (Handles requests to the 'api' function) ---

// Example URL: GET https://<your-function-url>/test
app.get('/test', (req, res) => {
    functions.logger.info("API Test Endpoint Hit");
    res.status(200).send('API (Express) is working!');
});

// Example URL: GET https://<your-function-url>/echo-ical
app.get('/echo-ical', (req, res) => {
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:12345@test\r\nDTSTAMP:20250319T074400Z\r\nDTSTART;VALUE=DATE:20250401\r\nDTEND;VALUE=DATE:20250402\r\nSUMMARY:UNAVAILABLE\r\nSTATUS:CONFIRMED\r\nTRANSP:OPAQUE\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
});

// Example URL: GET https://<your-function-url>/rooms
app.get('/rooms', async (req, res) => {
     try { const snap = await db.collection('rooms').get(); const rooms = []; snap.forEach(doc=>rooms.push({id: doc.id, ...doc.data()})); res.status(200).json(rooms);} catch (e) {console.error('[/rooms] Error:', e); functions.logger.error('[/rooms] Error fetching rooms', {error: e}); res.status(500).send("Error fetching rooms");}
});

// Example URL: GET https://<your-function-url>/ical/TBA-0302 (Uses ical-generator, currently commented out)
/*
app.get('/ical/:roomId', async (req, res) => {
     // ... (existing commented-out code - requires date handling update if used)
});
*/

// Example URL: GET https://<your-function-url>/simple-ical/TBA-0302
// --- Express Routes Defined on 'app' (Handles requests to the 'api' function) ---

// ... other routes like /test, /rooms etc. ...

// Example URL: GET https://<your-function-url>/simple-ical/TBA-0302.ics
// Handles requests ending specifically with '.ics' after the room ID parameter
// Example URL: GET https://<your-function-url>/simple-ical/TBA-0303.ics
app.get('/simple-ical/:roomId.ics', async (req, res) => {
    // Log entry point and raw parameter received from the URL path
    functions.logger.info(`!!!!!! ENTERED /simple-ical/:roomId.ics HANDLER for param: ${req.params.roomId} !!!!!!`);
    try {
        let roomId = req.params.roomId; // Get the room ID from the URL path parameter (e.g., 'TBA-0303')

        // Trim potential leading/trailing whitespace just in case it slipped into the URL or parameter parsing
        let trimmedRoomId = roomId.trim();
        // Log both the raw and trimmed ID for comparison, along with length
        functions.logger.info(`[/simple-ical] Processing raw roomId: [${roomId}], Trimmed: [${trimmedRoomId}] (Length: ${roomId.length})`);

        // --- Access Logging (using trimmed ID for consistency) ---
        const accessLog = {
            roomId: trimmedRoomId, // Log the potentially cleaned room ID
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userAgent: req.headers['user-agent'] || 'Unknown',
            ipAddress: req.ip || 'Unknown',
            referer: req.headers['referer'] || 'Unknown'
        };
        try {
            await db.collection('icalAccess').add(accessLog);
            // Try updating lastAccessed on the room document (use trimmed ID)
            // This is non-critical; failure here might indicate the doc doesn't exist, but we rely on the explicit check later
            await db.collection('rooms').doc(trimmedRoomId).update({ lastAccessed: admin.firestore.FieldValue.serverTimestamp() })
                .catch(updateError => {
                    // Log if the update fails, but don't stop execution
                    functions.logger.warn(`[/simple-ical] Non-critical error updating lastAccessed for ${trimmedRoomId}: ${updateError.message}. Continuing...`);
                });
        }
        catch (trackError) {
            // Log errors during access tracking, but don't stop execution
            console.error(`[/simple-ical] Error tracking access for ${trimmedRoomId}:`, trackError);
            functions.logger.error(`[/simple-ical] Error tracking access for ${trimmedRoomId}`, { error: trackError.message });
        }
        // Log the identifier of the request, including the '.ics' suffix for clarity on which endpoint was hit
        functions.logger.info(`[/simple-ical] Access logged for request: ${trimmedRoomId}.ics by ${accessLog.userAgent}`);

        // --- Attempt to Fetch Room Document from Firestore ---
        functions.logger.info(`[/simple-ical] Attempting to fetch room document: rooms/${trimmedRoomId}`);
        // Use the trimmed ID for the Firestore query
        const roomDoc = await db.collection('rooms').doc(trimmedRoomId).get();

        // --- CRITICAL CHECK: Does the document actually exist according to Firestore? ---
        if (!roomDoc.exists) {
            // Log the explicit failure of the .exists check - THIS IS THE KEY DIAGNOSTIC POINT
            functions.logger.error(`[/simple-ical] CRITICAL CHECK: roomDoc.exists is FALSE for trimmedRoomId: [${trimmedRoomId}]. Sending 404.`);
            console.warn(`[/simple-ical] Room not found because roomDoc.exists returned false for ID: ${trimmedRoomId}`);
            // Send a specific 404 response indicating the document wasn't found by the function at this point
            return res.status(404).send(`Room document not found in Firestore for ID: ${trimmedRoomId}`);
        } else {
            // Log the explicit success of the .exists check
            functions.logger.info(`[/simple-ical] CRITICAL CHECK: roomDoc.exists is TRUE for trimmedRoomId: [${trimmedRoomId}]. Proceeding...`);
        }
        // --- END CRITICAL CHECK ---

        // --- If execution reaches here, the room document was successfully found ---
        const room = { id: roomDoc.id, ...roomDoc.data() };
        // Determine property identifier, prioritizing 'propertyId' field if available
        const propertyId = room.propertyId || room.property;

        // Check if essential property identifier exists within the fetched document data
        if (!propertyId) {
            functions.logger.error(`[/simple-ical] Missing 'propertyId' or 'property' field in Firestore document data for room: ${trimmedRoomId}. Sending 500.`);
            console.error(`[/simple-ical] Room data incomplete for ${trimmedRoomId}`, { roomData: room });
            return res.status(500).send(`Room data incomplete (missing property identifier) for room ID: ${trimmedRoomId}.`);
        }
        functions.logger.info(`[/simple-ical] Successfully fetched room: ${propertyId}-${room.roomNumber || 'N/A'}`);

        // --- Set HTTP Headers for the iCal File Response ---
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            // Generate a descriptive filename for the download
            'Content-Disposition': `attachment; filename="${propertyId}-${room.roomNumber || 'room'}.ics"`,
            'Access-Control-Allow-Origin': '*', // Allow cross-origin access (adjust if necessary)
            'Cache-Control': 'no-cache, no-store, must-revalidate', // Ensure fresh data
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // --- Get Associated Reservations (using the confirmed existing trimmedRoomId) ---
        functions.logger.info(`[/simple-ical] Fetching reservations for room: ${trimmedRoomId}`);
        const reservationsSnapshot = await db.collection('reservations')
            .where('roomId', '==', trimmedRoomId)
            .where('status', '!=', 'Cancelled') // Exclude cancelled bookings
            // Consider adding `.orderBy('checkInDate', 'asc')` if order matters and index exists
            .get();
        functions.logger.info(`[/simple-ical] Fetched ${reservationsSnapshot.size} non-cancelled reservations for room ${trimmedRoomId}`);

        // --- Build the iCal String Manually ---
        let icalBuilder = 'BEGIN:VCALENDAR\r\n';
        icalBuilder += 'VERSION:2.0\r\n';
        icalBuilder += 'CALSCALE:GREGORIAN\r\n';
        icalBuilder += 'METHOD:PUBLISH\r\n';
        // Create a product identifier including the specific room
        icalBuilder += `PRODID:-//Opera-Airbnb-Sync//${propertyId}-${room.roomNumber || 'room'}//EN\r\n`;
        // Generate a standard iCal timestamp for DTSTAMP fields
        const timestamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''); // Format: YYYYMMDDTHHMMSSZ

        let eventCount = 0;
        // Iterate through each fetched reservation document
        reservationsSnapshot.forEach(doc => {
            const reservation = { id: doc.id, ...doc.data() };

            // --- Robust Date Handling for Reservations ---
            let startDateObj, endDateObj;
            let rawCheckIn = reservation.checkInDate || reservation.checkIn || reservation.start;
            let rawCheckOut = reservation.checkOutDate || reservation.checkOut || reservation.end;
            try {
                // Handle Firestore Timestamps first
                if (rawCheckIn?.toDate && rawCheckOut?.toDate) {
                    startDateObj = rawCheckIn.toDate();
                    endDateObj = rawCheckOut.toDate();
                // Handle 'YYYY-MM-DD' strings as fallback
                } else if (typeof rawCheckIn === 'string' && typeof rawCheckOut === 'string') {
                    startDateObj = parseISO(rawCheckIn); // Assumes UTC midnight if no time provided
                    endDateObj = parseISO(rawCheckOut);
                } else {
                    throw new Error(`Invalid or mixed date types (In: ${typeof rawCheckIn}, Out: ${typeof rawCheckOut})`);
                }
                // Check if parsing resulted in valid Date objects
                if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    throw new Error('Parsed date resulted in NaN');
                }
            } catch (conversionError) {
                // Log warning and skip this specific reservation if dates are invalid
                functions.logger.warn(`[/simple-ical] Skipping reservation ${doc.id} for room ${trimmedRoomId} due to date error.`, { errMsg: conversionError.message, inRaw: rawCheckIn, outRaw: rawCheckOut });
                return; // Continue to the next reservation in the forEach loop
            }
            // --- End Date Handling ---

            // --- Format Dates and Build VEVENT Block ---
            try {
                const startDateStr = formatDateForIcal(startDateObj); // Format as YYYYMMDD
                const endDateStr = formatDateForIcal(endDateObj);   // Format as YYYYMMDD (exclusive date)
                // Use Opera Conf# if available and confirmed, otherwise fallback to Firestore ID
                const operaConfNum = (reservation.status === 'Confirmed' && reservation.operaConfirmationNumber) ? reservation.operaConfirmationNumber : (reservation.id || doc.id);
                const uid = `${operaConfNum}@${propertyId}.opera-sync`; // Generate unique event ID
                // Customize summary based on status
                const summary = reservation.status === 'Pending Confirmation' ? 'PENDING' : 'UNAVAILABLE';

                // Append the VEVENT block
                icalBuilder += 'BEGIN:VEVENT\r\n';
                icalBuilder += `UID:${uid}\r\n`;
                icalBuilder += `DTSTAMP:${timestamp}\r\n`;
                icalBuilder += `DTSTART;VALUE=DATE:${startDateStr}\r\n`; // All-day event start
                icalBuilder += `DTEND;VALUE=DATE:${endDateStr}\r\n`;     // All-day event end (exclusive)
                icalBuilder += `SUMMARY:${summary}\r\n`;
                icalBuilder += 'STATUS:CONFIRMED\r\n'; // Standard practice for calendar blocking
                icalBuilder += 'TRANSP:OPAQUE\r\n';    // Mark time as busy
                icalBuilder += 'END:VEVENT\r\n';
                eventCount++; // Increment count of successfully added events
            } catch (formatError) {
                // Log error if formatting fails for a specific event, but continue processing others
                console.error(`[/simple-ical] Error formatting iCal VEVENT for reservation ${doc.id} (room ${trimmedRoomId}):`, formatError.message);
                functions.logger.error(`[/simple-ical] Error during iCal VEVENT creation for ${doc.id} (room ${trimmedRoomId})`, { error: formatError.message });
            }
        }); // End reservationsSnapshot.forEach

        // --- Handle Empty Calendar Case (Optional: add dummy event) ---
        if (eventCount === 0) {
            functions.logger.info(`[/simple-ical] No valid reservations found or processed for ${trimmedRoomId}.ics, adding dummy event.`);
            // Add a placeholder event to ensure the calendar file is valid for clients that require at least one event
            icalBuilder += `BEGIN:VEVENT\r\n`;
            icalBuilder += `UID:dummy-${trimmedRoomId}@${propertyId}.opera-sync\r\n`;
            icalBuilder += `DTSTAMP:${timestamp}\r\n`;
            icalBuilder += `DTSTART;VALUE=DATE:20500101\r\n`; // Far future date
            icalBuilder += `DTEND;VALUE=DATE:20500102\r\n`;
            icalBuilder += `SUMMARY:NO VALID RESERVATIONS FOUND\r\n`;
            icalBuilder += `STATUS:CONFIRMED\r\n`;
            icalBuilder += `TRANSP:OPAQUE\r\n`;
            icalBuilder += `END:VEVENT\r\n`;
        }

        // --- Finalize iCal String & Apply Line Folding (RFC 5545 requirement) ---
        icalBuilder += 'END:VCALENDAR';
        const foldedContent = foldLines(icalBuilder); // Ensure lines are wrapped correctly

        functions.logger.info(`[/simple-ical] Successfully generated iCal for ${trimmedRoomId}.ics with ${eventCount} valid events (folded length: ${foldedContent.length})`);

        // --- Send the Generated iCal Content as the HTTP Response ---
        return res.status(200).send(foldedContent);

    } catch (error) {
        // --- Top-Level Error Handling ---
        // Catch errors from Firestore operations, date parsing, iCal generation, or any other unexpected issues
        console.error(`[/simple-ical] FATAL Error processing request for room ID param [${req.params.roomId}]:`, error);
        functions.logger.error(`[/simple-ical] FATAL error during processing for requested roomId param [${req.params.roomId}]`, {
            error: error.message,
            stack: error.stack // Log stack trace for debugging
        });
        // Send a generic 500 Internal Server Error response
        res.status(500).set('Content-Type', 'text/plain').send('Internal Server Error generating iCal feed.');
    }
});
// ... other routes like /dash, /upload etc. ...

// Example URL: GET https://<your-function-url>/dash
//const functions = require('firebase-functions'); // Assuming you use this for logging
//const express = require('express');
const { getFirestore } = require('firebase-admin/firestore'); // Use modular import

// Assuming firebase admin is initialized elsewhere (e.g., index.js)
// const admin = require('firebase-admin');
// admin.initializeApp();
//const db = getFirestore();

//const app = express(); // Create an express app if not already done

// Endpoint to get rooms for a specific destination
app.get('/admin/rooms', async (req, res) => {
    const funcName = '[/admin/rooms]';
    const { destinationName } = req.query;

    if (!destinationName) {
        return res.status(400).json({ message: 'Missing destinationName query parameter' });
    }
    functions.logger.info(`${funcName} Request received for destination:`, destinationName);

    try {
        let roomsQuery = db.collection('rooms');
        if (destinationName.toLowerCase() !== 'all destinations') {
            roomsQuery = roomsQuery.where('destinationName', '==', destinationName);
        }
        // Add orderBy if desired, e.g., .orderBy('hotelCode').orderBy('roomNumber')

        const snapshot = await roomsQuery.get();
        const rooms = [];
        snapshot.forEach(doc => {
            rooms.push({ id: doc.id, ...doc.data() });
        });

        functions.logger.info(`${funcName} Found ${rooms.length} rooms for destination.`);
        res.status(200).json(rooms);
    } catch (error) {
        functions.logger.error(`${funcName} Error fetching rooms:`, error);
        res.status(500).json({ message: 'Error fetching rooms for destination' });
    }
});


// ========================================================
// ===            UPDATED /dash Route Handler           ===
// ========================================================
app.get('/dash', async (req, res) => {
    try {
        // Use the globally declared 'db' instance
        const roomsSnapshot = await db.collection('rooms').orderBy('propertyId').orderBy('roomNumber', 'asc').get();
        let tableRows = '';
        const functionHostname = req.get('host');
        // const scheme = req.protocol; // Not used

        const logLimitPerRoom = 5; // How many logs to show per room
        // Fetch potentially more logs initially, then filter.
        // This isn't perfectly efficient but simpler than N queries.
        // Consider adjusting the overall limit based on expected room count.
        const overallLogLimit = roomsSnapshot.size * logLimitPerRoom + 50; // Fetch a bit extra
        const accessLogsSnapshot = await db.collection('icalAccess')
                                           .orderBy('timestamp', 'desc')
                                           .limit(overallLogLimit)
                                           .get();

        const accessLogsByRoomId = {};
        accessLogsSnapshot.forEach(doc => {
            const log = doc.data();
            if (log.roomId) {
                if (!accessLogsByRoomId[log.roomId]) {
                    accessLogsByRoomId[log.roomId] = [];
                }
                // Only store the top 'logLimitPerRoom' for each room
                if (accessLogsByRoomId[log.roomId].length < logLimitPerRoom) {
                    accessLogsByRoomId[log.roomId].push({
                        timestamp: log.timestamp?.toDate ? log.timestamp.toDate() : null,
                        userAgent: log.userAgent || 'Unknown',
                        ipAddress: log.ipAddress || 'Unknown' // Keep IP if needed for display later
                    });
                }
            }
        });

        // Helper to format Firestore Timestamps or return 'Never'/'Invalid Date'
        const formatTs = (ts) => {
            if (ts && typeof ts.toDate === 'function') {
                try {
                    // Using 'sv-SE' for YYYY-MM-DD HH:MM:SS format. Adjust locale if needed.
                    return ts.toDate().toLocaleString('sv-SE', { timeZone: 'Africa/Johannesburg' });
                } catch (e) {
                    console.error("Error formatting date:", e);
                    return 'Invalid Date';
                }
            }
            return 'Never';
        };

        // Helper to safely escape HTML characters
        const escapeHtml = (unsafe) => {
             if (!unsafe) return '';
             return unsafe
                 .replace(/&/g, "&")
                 .replace(/</g, "<")
                 .replace(/>/g, ">")
                 .replace(/"/g, '\\"')
                 .replace(/'/g, "'");
        }

        roomsSnapshot.forEach(doc => {
            const room = { id: doc.id, ...doc.data() };
            const propId = escapeHtml(room.propertyId || room.property); // Use 'property' as fallback
            const roomNum = escapeHtml(room.roomNumber);
            if (!propId || !roomNum) {
                console.warn(`[/dash] Skipping room ${room.id} - missing propertyId or roomNumber`);
                return; // Skip this iteration
            }
            const lastUpdated = formatTs(room.lastUpdated);
            const lastAccessed = formatTs(room.lastAccessed);
            const dynamicUrl = `https://${functionHostname}/simple-ical/${room.id}.ics`;
            let airbnbUrl = room.airbnbUrl || '';
            if (airbnbUrl && !airbnbUrl.startsWith('http')) {
                airbnbUrl = 'https://' + escapeHtml(airbnbUrl);
            } else if (airbnbUrl) {
                airbnbUrl = escapeHtml(airbnbUrl); // Still escape potentially malicious URLs
            }

            let accessLogHtml = '<p class="no-logs">No recent access logged.</p>';
            const logsForRoom = accessLogsByRoomId[room.id]; // Already sorted desc by query
            if (logsForRoom && logsForRoom.length > 0) {
                accessLogHtml = '<ul class="access-log-list">';
                logsForRoom.forEach(log => {
                    const logTime = log.timestamp ? log.timestamp.toLocaleString('sv-SE', { timeZone: 'Africa/Johannesburg' }) : 'Unknown Time';
                    const userAgentRaw = log.userAgent || 'Unknown Agent';
                    // Shorten and escape User Agent
                    const userAgentShort = userAgentRaw.length > 80 ? escapeHtml(userAgentRaw.substring(0, 77)) + '...' : escapeHtml(userAgentRaw);
                    // const ip = escapeHtml(log.ipAddress); // Uncomment if you want to display IP
                    accessLogHtml += `<li><span class="log-time">${logTime}</span> <span class="log-agent">${userAgentShort}</span></li>`; // Add ${ip} if needed
                });
                accessLogHtml += '</ul>';
            }
            const roomType = escapeHtml(room.roomType || 'N/A');
            const airbnbLinkHtml = airbnbUrl ? `<a href="${airbnbUrl}" target="_blank" class="link airbnb-link">View Listing</a>` : '<span class="na-text">N/A</span>';

            // Append the row HTML
            tableRows += `
                <tr>
                    <td>${propId}</td>
                    <td>${roomNum}</td>
                    <td>${roomType}</td>
                    <td>
                        <a href="${dynamicUrl}" target="_blank" class="link ical-link">Dynamic iCal Link</a>
                        <p class="timestamp">Updated: ${lastUpdated}</p>
                        <p class="timestamp">Accessed: ${lastAccessed}</p>
                    </td>
                    <td>${airbnbLinkHtml}</td>
                    <td>
                        <details class="log-details">
                            <summary class="log-summary">View Recent Access</summary>
                            <div class="log-content">
                                ${accessLogHtml}
                            </div>
                        </details>
                    </td>
                </tr>`;
        });

        // Define the CSS styles (Same as previous good version)
        const cssStyles = `
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f7f9; color: #333; line-height: 1.6; }
            .container { max-width: 1200px; margin: 20px auto; padding: 20px; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); border-radius: 8px; }
            .header-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; }
            .header-controls a, .header-controls button { display: inline-block; padding: 8px 15px; border-radius: 5px; text-decoration: none; font-size: 0.9em; cursor: pointer; transition: background-color 0.2s ease; }
            .header-controls a { background-color: #e7f3ff; color: #0056b3; border: 1px solid #b8d6f3; }
            .header-controls a:hover { background-color: #d0e7ff; }
            .header-controls button { background-color: #f0f0f0; color: #333; border: 1px solid #ccc; }
            .header-controls button:hover { background-color: #e0e0e0; }
            h1 { color: #2c3e50; margin-bottom: 20px; text-align: center; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
            th { background-color: #f8f9fa; font-weight: 600; color: #495057; white-space: nowrap; }
            tbody tr:nth-child(even) { background-color: #fdfdfd; }
            tbody tr:hover { background-color: #f1f5f8; }
            .link { color: #007bff; text-decoration: none; font-weight: 500; display: inline-block; margin-bottom: 5px; }
            .link:hover { text-decoration: underline; color: #0056b3; }
            .timestamp { font-size: 0.8em; color: #6c757d; margin: 2px 0 0 0; line-height: 1.3; }
            .na-text { font-style: italic; color: #888; }
            .log-summary { cursor: pointer; font-weight: 500; color: #007bff; display: inline-block; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s ease; }
            .log-summary:hover { background-color: #e7f3ff; }
            .log-summary::marker { color: #007bff; }
            /* Alternative marker styling if ::marker is inconsistent:
            .log-summary { list-style: none; position: relative; padding-left: 18px; }
            .log-summary::before { content: '►'; position: absolute; left: 0; top: 4px; font-size: 0.8em; color: #007bff; transition: transform 0.2s ease;}
            .log-details[open] > .log-summary::before { transform: rotate(90deg); }
            */
            .log-content { margin-top: 10px; padding-left: 10px; border-left: 2px solid #e0e0e0; }
            .access-log-list { list-style: none; padding: 0; margin: 0; font-size: 0.85em; color: #444; }
            .access-log-list li { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #eee; line-height: 1.4; }
            .access-log-list li:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
            .log-time { display: inline-block; min-width: 140px; font-family: monospace; color: #555; margin-right: 10px; }
            .log-agent { color: #666; word-break: break-word; }
            .no-logs { font-style: italic; color: #999; font-size: 0.9em; margin: 5px 0 0 0; }
        `;

        // Construct the full HTML page
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>iCal Dashboard</title>
    <style>${cssStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header-controls">
            <a href="/syncLogs">View Sync Logs</a>
            <button onclick="location.reload()">Refresh</button>
        </div>
        <h1>iCal Dashboard</h1>
        <table>
            <thead>
                <tr>
                    <th>Property</th>
                    <th>Room</th>
                    <th>Type</th>
                    <th>iCal Feed</th>
                    <th>Airbnb</th>
                    <th>Access Logs</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</body>
</html>`;

        res.set('Content-Type', 'text/html').send(html);

    } catch (error) {
        console.error('[/dash] Error generating dashboard:', error);
        // Use functions.logger if available and in Firebase environment
        if (functions && functions.logger) {
            functions.logger.error('[/dash] Dashboard Error', { error: error.message, stack: error.stack });
        }
        res.status(500).send('Error generating dashboard. Check server logs.');
    }
});
// ========================================================

// Export the app or specific functions if needed for Firebase Functions
// e.g., exports.api = functions.https.onRequest(app);
// Or if running standalone:
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}...`);
// });

// Export the app for Firebase Functions or start listening if running standalone
// module.exports.app = functions.https.onRequest(app); // Example for Firebase
// Or: app.listen(3000, () => console.log('Server running on port 3000'));

// Example URL: POST https://api-yzrm33bhsq-uc.a.run.app/upload
app.post('/upload', async (req, res) => {
    const MAX_BATCH_WRITES = 490; // Firestore limit is 500, keep a small margin
    let syncLogRef = null;
    let roomsUpdatedCount = 0, reservationsAddedCount = 0, reservationsUpdatedCount = 0;
    let reservationsSkippedCount = 0, dateErrorCount = 0, idErrorCount = 0;
    let duplicateErrorCount = 0, queryErrorCount = 0, roomValidationErrorCount = 0;
    let currentBatch = null;
    let writeCounter = 0;

    // Helper function to manage batch commits
    const commitBatchIfNeeded = async (forceCommit = false) => {
        if (currentBatch && (writeCounter >= MAX_BATCH_WRITES || (forceCommit && writeCounter > 0))) {
            try {
                functions.logger.info(`Committing batch with ${writeCounter} writes...`);
                await currentBatch.commit();
                functions.logger.info("Batch committed successfully.");
                currentBatch = db.batch(); // Start a new batch immediately
                writeCounter = 0; // Reset counter for the new batch
            } catch (batchError) {
                functions.logger.error("FATAL: Batch commit failed!", { error: batchError.message, stack: batchError.stack });
                // Rethrow to be caught by the main try/catch block
                throw new Error(`Batch commit failed: ${batchError.message}`);
            }
        } else if (!currentBatch && writeCounter > 0) {
             // This state should ideally not be reached if logic is correct
             functions.logger.error("Error state: writeCounter > 0 but currentBatch is null!");
        }
    };

    try {
        // --- Phase 1: Initial Setup & Logging ---
        const operaData = req.body;
        if (!operaData || (!operaData.resources && !operaData.events)) {
            functions.logger.error("Upload failed: Invalid Opera data format received.");
            return res.status(400).send({ status: 'error', message: 'Invalid Opera data format.' });
        }
        const resources = operaData.resources || [];
        const events = operaData.events || [];
        functions.logger.info(`Received upload: ${resources.length} resources, ${events.length} events.`);

        // Create initial sync log entry
        syncLogRef = await db.collection('syncLogs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            success: false, // Assume failure until the end
            manual: false,
            message: 'Upload process started.',
            details: {
                resourceCountInput: resources.length,
                eventCountInput: events.length
            }
        });
        functions.logger.info(`Created sync log entry: ${syncLogRef.id}`);

        currentBatch = db.batch(); // Initialize the first batch
        const resourceIdToRoomMap = {}; // To map Opera resource IDs to standardized room IDs

        // --- Phase 2: Process Rooms (Resources) ---
        functions.logger.info('Processing rooms...');
        if (resources.length > 0) {
             for (const room of resources) {
                try {
                    const props = room.extendedProps;
                    // Validate required room properties
                    if (!props?.property || !props?.roomNumber) {
                        functions.logger.warn(`Skipping resource ${room.id || '??'}: Missing property or roomNumber.`, { resourceData: room });
                        roomValidationErrorCount++;
                        continue; // Skip this resource
                    }
                    const property = props.property;
                    const roomNumber = props.roomNumber;
                    const originalResourceIdFromJson = room.id; // The ID from the JSON input

                    // Create a standardized room ID (e.g., "PROP-101")
                    const standardizedRoomId = `${property}-${roomNumber}`;

                    // Store mapping for event processing later
                    if(originalResourceIdFromJson) {
                        resourceIdToRoomMap[originalResourceIdFromJson] = { standardizedId: standardizedRoomId, propertyId: property };
                    } else {
                         functions.logger.warn(`Resource missing 'id' field, cannot map for events`, { resourceData: room });
                    }


                    const roomRef = db.collection('rooms').doc(standardizedRoomId);
                    const roomData = {
                        roomId: standardizedRoomId, // Store the standardized ID
                        propertyId: property, // Explicitly store propertyId
                        property: property, // Keep original field if needed elsewhere
                        roomNumber: roomNumber,
                        roomType: props.roomType || null,
                        airbnbUrl: props.url || null,
                        iCalUrl: props.iCal || null, // Assuming this might come from Opera
                        title: room.title || `${property} ${roomNumber}`, // Use title or construct one
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        // Add any other relevant room fields from 'room' or 'props'
                    };

                    // Add to batch (using set with merge to update or create)
                    currentBatch.set(roomRef, roomData, { merge: true });
                    writeCounter++;
                    roomsUpdatedCount++;

                    // Commit batch if it's full
                    await commitBatchIfNeeded();

                } catch (roomError) {
                     functions.logger.error(`Error processing room resource ${room.id || '??'}. Skipping.`, { error: roomError.message, stack: roomError.stack, resourceData: room });
                     roomValidationErrorCount++; // Count errors even if we skip
                 }
             } // End room loop
             functions.logger.info(`Room processing phase complete. Processed: ${roomsUpdatedCount}, Validation Errors/Skipped: ${roomValidationErrorCount}.`);
        } else {
             functions.logger.info("No resources (rooms) found in input data to process.");
        }


        // --- Phase 3: Process Reservations (Events) ---
        functions.logger.info('Processing events...');
        if (events.length > 0) {
             for (const event of events) {
                 let operaConfirmationNumber = null; // Keep track for logging/error messages
                 try {
                    // --- Extract Confirmation Number ---
                     try {
                         // Assuming Opera confirmation number is the first 9 digits of the event ID
                         if (!event.id || event.id.length < 9) {
                            throw new Error('Event ID is missing or too short to extract Conf#.');
                         }
                         operaConfirmationNumber = event.id.substring(0, 9);
                     } catch (err) {
                         idErrorCount++;
                         reservationsSkippedCount++;
                         functions.logger.error(`Conf# extraction error for event.id "${event.id || 'MISSING'}". Skipping.`, { error: err.message, eventData: event });
                         continue; // Skip this event
                     }

                    // --- Determine Room ID ---
                     const originalResourceIdFromJson = event.resourceId;
                     const roomMapping = resourceIdToRoomMap[originalResourceIdFromJson];
                     let standardizedRoomId, propertyId;

                     if (roomMapping) {
                         standardizedRoomId = roomMapping.standardizedId;
                         propertyId = roomMapping.propertyId;
                     } else if (event.extendedProps?.property && event.extendedProps?.roomNumber) {
                         // Fallback: If resourceId mapping failed, try getting from extendedProps
                         propertyId = event.extendedProps.property;
                         standardizedRoomId = `${propertyId}-${event.extendedProps.roomNumber}`;
                         functions.logger.warn(`Using fallback room ID from extendedProps for event ${event.id} -> ${standardizedRoomId}. Mapping failed for resourceId: ${originalResourceIdFromJson}`);
                     } else {
                         // Cannot determine room, skip this event
                         functions.logger.error(`Cannot determine standardized room ID for event ${event.id} (Conf#: ${operaConfirmationNumber}). Mapping failed and fallback props missing. Skipping.`, { eventData: event });
                         reservationsSkippedCount++;
                         continue;
                     }

                    // --- Parse and Validate Dates (Save as Firestore Timestamps) ---
                     let checkInDateTs, checkOutDateTs;
                     try {
                         if (!event.start || !event.end) {
                            throw new Error('Missing event start or end date string.');
                         }
                         // IMPORTANT: Assume event.start/end are strings like 'YYYY-MM-DD'
                         // Append time and 'Z' to parse as UTC midnight
                         const startDate = new Date(event.start + 'T00:00:00Z');
                         const endDate = new Date(event.end + 'T00:00:00Z'); // End date in Opera is usually the checkout day, so start of day is correct

                         if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                             throw new Error('Result of parsing date string is not a valid Date (NaN).');
                         }
                         checkInDateTs = admin.firestore.Timestamp.fromDate(startDate);
                         checkOutDateTs = admin.firestore.Timestamp.fromDate(endDate);

                     } catch (dateError) {
                         dateErrorCount++;
                         reservationsSkippedCount++;
                         functions.logger.error(`Date parsing/conversion error for event ${event.id} (Conf#: ${operaConfirmationNumber}). Skipping.`, {
                             error: dateError.message,
                             startStr: event.start,
                             endStr: event.end,
                             eventData: event
                         });
                         continue; // Skip this event
                     }

                     // --- Prepare Reservation Data for Firestore ---
                     const reservationData = {
                         roomId: standardizedRoomId, // Use the standardized room ID
                         propertyId: propertyId,     // Store associated property ID
                         checkInDate: checkInDateTs,   // Store as Firestore Timestamp
                         checkOutDate: checkOutDateTs, // Store as Firestore Timestamp
                         status: event.extendedProps?.status || 'Unknown', // Get status if available
                         operaConfirmationNumber: operaConfirmationNumber, // The extracted 9-digit number
                         originalEventId: event.id, // Keep the full original ID for reference
                         guestName: event.title || null, // Guest name often in title
                         confirmationNumber: event.extendedProps?.confirmationNumber || null, // Other confirmation number?
                         adults: event.extendedProps?.adults || null,
                         children: event.extendedProps?.children || null,
                         rate: event.extendedProps?.rate || null,
                         source: event.extendedProps?.source || null,
                         travelAgent: event.extendedProps?.travelAgent || null,
                         // Add any other relevant fields from event.extendedProps
                         dataSource: 'Opera', // Indicate the origin
                         lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                     };

                    // --- Upsert Logic: Find existing reservation by Conf# ---
                     try {
                        // Query for existing reservation with the same Opera Conf#
                        // Index needed: reservations collection, operaConfirmationNumber ASC
                        const querySnapshot = await db.collection('reservations')
                                                      .where('operaConfirmationNumber', '==', operaConfirmationNumber)
                                                      .limit(2) // Limit to 2 to detect duplicates easily
                                                      .get();

                        if (querySnapshot.empty) {
                            // No existing reservation found -> Add new one
                            const newRef = db.collection('reservations').doc(); // Auto-generate Firestore ID
                            currentBatch.set(newRef, reservationData);
                            reservationsAddedCount++;
                            writeCounter++;
                        } else if (querySnapshot.size === 1) {
                            // Exactly one found -> Update it
                            const existingDocRef = querySnapshot.docs[0].ref;
                            currentBatch.update(existingDocRef, reservationData); // Update existing doc
                            reservationsUpdatedCount++;
                            writeCounter++;
                        } else {
                            // More than one found -> Critical error (duplicate Conf# in DB)
                            duplicateErrorCount++;
                            reservationsSkippedCount++;
                            functions.logger.error(`CRITICAL: Duplicate operaConfirmationNumber ${operaConfirmationNumber} found in Firestore. Skipping update for event ${event.id}. Manual investigation needed.`, { eventData: event });
                            // Do not add to batch, just log the error
                            continue;
                        }
                     } catch (queryError) {
                         queryErrorCount++;
                         reservationsSkippedCount++;
                         functions.logger.error(`DB Query Error when checking Conf# ${operaConfirmationNumber} for event ${event.id}. Skipping.`, { error: queryError.message, stack: queryError.stack, eventData: event });
                         continue; // Skip this event
                     }

                     // Commit batch if needed after processing event
                     await commitBatchIfNeeded();

                 } catch (eventError) { // Catch unexpected errors within the event loop
                     functions.logger.error(`Unhandled error processing event ${event?.id || 'UNKNOWN'} (Conf#: ${operaConfirmationNumber || 'N/A'}). Skipping.`, { error: eventError.message, stack: eventError.stack, eventData: event });
                     reservationsSkippedCount++; // Increment skip count for unhandled errors
                     // Attempt to commit any pending writes before potentially failing harder
                     await commitBatchIfNeeded();
                 }
             } // End event loop
             functions.logger.info(`Event processing phase complete.`);
        } else {
             functions.logger.info("No events (reservations) found in input data to process.");
        }

        // --- Phase 4: Final Commit & Log Update ---
        // Commit any remaining writes in the last batch
        await commitBatchIfNeeded(true); // Force commit whatever is left

        const successfulProcessing = (idErrorCount === 0 && dateErrorCount === 0 && duplicateErrorCount === 0 && queryErrorCount === 0 && roomValidationErrorCount === 0);
        const finalMessage = `Sync completed. Rooms Processed: ${roomsUpdatedCount} (Val. Errors: ${roomValidationErrorCount}). Events Processed Input: ${events.length} -> Added: ${reservationsAddedCount}, Updated: ${reservationsUpdatedCount}, Skipped: ${reservationsSkippedCount} (ID Err: ${idErrorCount}, Date Err: ${dateErrorCount}, Dup Conf#: ${duplicateErrorCount}, Query Err: ${queryErrorCount}, Unhandled: ${reservationsSkippedCount - idErrorCount - dateErrorCount - duplicateErrorCount - queryErrorCount}).`;
        functions.logger.info(finalMessage);

        // Update the sync log entry with final results
        await syncLogRef.update({
            success: successfulProcessing,
            message: finalMessage,
            details: {
                resourceCountInput: resources.length,
                eventCountInput: events.length,
                roomsProcessed: roomsUpdatedCount,
                roomValidationErrors: roomValidationErrorCount,
                reservationsAdded: reservationsAddedCount,
                reservationsUpdated: reservationsUpdatedCount,
                reservationsSkippedTotal: reservationsSkippedCount,
                reservationsSkippedByIdError: idErrorCount,
                reservationsSkippedByDateError: dateErrorCount,
                reservationsSkippedByDuplicateConf: duplicateErrorCount,
                reservationsSkippedByQueryError: queryErrorCount,
                // Add other specific error counts if needed
            }
        });

        // Send final response to the client
        res.status(200).send({ status: 'success', message: finalMessage, details: (await syncLogRef.get()).data()?.details });

    } catch (error) { // Catch errors from initial setup, batch commits, or final log update
        console.error('[/upload] FATAL Error during upload process:', error);
        functions.logger.error('[/upload] FATAL Upload Error', { error: error.message, stack: error.stack });
        // Attempt to log the fatal error to the sync log entry if it exists
        try {
            if (syncLogRef) {
                 await syncLogRef.update({
                     success: false,
                     error: `Fatal error during processing: ${error.message}`,
                     message: 'Upload process failed critically.'
                 });
            }
        } catch (logError) {
             console.error("Failed to update sync log with fatal error", logError);
             functions.logger.error("Failed to update sync log with fatal error", { error: logError.message });
        }
        // Send error response
        res.status(500).send({ status: 'error', message: `Upload failed critically: ${error.message}` });
    }
});



// === NEW Endpoint: Initiate Booking Request                  ===
// ===============================================================
// Example URL: POST https://<your-function-url>/requestBooking
app.post('/requestBooking', async (req, res) => {
    functions.logger.info('[/requestBooking] Received booking request (v2 - with cost validation):', req.body);
    const {
        surname, name, phone, discountCode, // Guest details
        calculatedSubtotal: frontendSubtotalStr, // From frontend calculation
        calculatedTotalCost: frontendTotalCostStr, // From frontend calculation
        discountAmount: discountAmountStr,      // From frontend input
        dailyRateDetails: frontendRateDetails, // Optional detailed breakdown from frontend     
        propertyId, roomId, roomName, // Room details
        checkin, checkout // Dates as 'YYYY-MM-DD' strings from modal
    } = req.body;

    // --- Basic Validation ---


    // --- Basic Validation (Updated) ---
    // REMOVED dailyRate check, ADDED frontend cost checks
    if (!surname || !name || !phone || !frontendSubtotalStr || !frontendTotalCostStr ||
        !propertyId || !roomId || !checkin || !checkout) {
        functions.logger.warn('[/requestBooking] Missing required fields (v2).', { body: req.body });
        return res.status(400).json({ status: 'error', message: 'Missing required booking details (costs, guest info, room, dates).' });
    }

    let startDate, endDate, checkInDateTs, checkOutDateTs;
    let frontendSubtotal, frontendTotalCost, discountAmount;
    let numberOfNights;

    try {

        startDate = parseISO(checkin); endDate = parseISO(checkout);
       if (!isDateValid(startDate) || !isDateValid(endDate) || !isBefore(startDate, endDate)) {
            throw new Error('Invalid date format or range (check-out must be after check-in).');
        }
        // Use startOfDay for consistency
        
        
        startDate = startOfDay(startDate);
        endDate = startOfDay(endDate);       
        checkInDateTs = admin.firestore.Timestamp.fromDate(startOfDay(startDate));
        checkOutDateTs = admin.firestore.Timestamp.fromDate(startOfDay(endDate));
        numberOfNights = differenceInDays(endDate, startDate);
        if (numberOfNights <= 0) {
            throw new Error("Booking must be for at least one night.");
        }
        // Parse costs
        frontendSubtotal = parseFloat(frontendSubtotalStr);
        frontendTotalCost = parseFloat(frontendTotalCostStr);
        // discountAmount can be 0, parseFloat returns NaN if invalid string
        discountAmount = parseFloat(discountAmountStr || '0');
        if (isNaN(frontendSubtotal) || isNaN(frontendTotalCost) || isNaN(discountAmount)) {
            throw new Error('Invalid cost format received (subtotal, total, or discount).');
        }
        if (discountAmount < 0) {
             throw new Error('Discount amount cannot be negative.');
        }

    } catch (validationError) {
        functions.logger.error('[/requestBooking] Invalid date or cost format:', { 
            checkin, checkout, frontendSubtotalStr, frontendTotalCostStr, discountAmountStr, error: validationError.message });
        
        return res.status(400).json({ status: 'error', message: `Invalid format: ${validationError.message}` });
    }

    let pendingReservationRef;
    let backendCalculatedSubtotal = 0; // Initialize backend calculated subtotal

    try {
        // === Backend Rate Calculation & Validation ===
        // 1. Fetch Room Details (Needed for rate key)
          
        const roomRef = db.collection('rooms').doc(roomId);
        const roomDoc = await roomRef.get();
        if (!roomDoc.exists) {
            functions.logger.error(`[/requestBooking] Room document not found: ${roomId}`);
            return res.status(404).json({ status: 'error', message: `Room ${roomId} not found.` });
        }
        const roomData = roomDoc.data();
        const roomActType = roomData.actType || 'Unknown';
        const roomPropRate = roomData.propRate || 'std';
        const roomPropTypeKey = `${roomPropRate}${roomActType}`.toLowerCase(); // Key for rate lookup
        functions.logger.info(`[/requestBooking] Fetched room details for ${roomId}. Rate key: ${roomPropTypeKey}`);
        

         // 2. Fetch Applicable Season Rates
         const processedSeasonRates = [];
         const seasonRatesQuery = db.collection('seasonRates'); // Add .where('propertyId', '==', propertyId) if needed
         const seasonRatesSnapshot = await seasonRatesQuery.get();
         seasonRatesSnapshot.forEach(doc => {
             const data = doc.data();
             try {
                 // Basic parsing and validation (similar to /getAvailability)
                 const seasonStart = data.dateStart?.toDate ? startOfDay(data.dateStart.toDate()) : (typeof data.dateStart === 'string' ? startOfDay(parseISO(data.dateStart)) : null);
                 const seasonEndInclusive = data.dateEnd?.toDate ? endOfDay(data.dateEnd.toDate()) : (typeof data.dateEnd === 'string' ? endOfDay(parseISO(data.dateEnd)) : null);
 
                 if (seasonStart && seasonEndInclusive && isDateValid(seasonStart) && isDateValid(seasonEndInclusive) &&
                     data.rateWeek !== undefined && data.rateWeekend !== undefined && data.propType &&
                     // Optimization: Check if season overlaps request range
                     isBefore(seasonStart, endDate) && isAfter(seasonEndInclusive, startDate)) {
                     processedSeasonRates.push({
                         propType: data.propType.toLowerCase(), // Store lowercase for matching
                         rateWeek: data.rateWeek,
                         rateWeekend: data.rateWeekend,
                         parsedDateStart: seasonStart,
                         parsedDateEndInclusive: seasonEndInclusive
                     });
                 }
             } catch (e) { /* Ignore seasons with parsing errors */ }
         });
         functions.logger.info(`[/requestBooking] Found ${processedSeasonRates.length} potentially relevant season rates.`);
         if (processedSeasonRates.length === 0) {
              functions.logger.error(`[/requestBooking] No applicable season rates found for property ${propertyId} covering the requested period. Cannot validate cost.`);
              return res.status(400).json({ status: 'error', message: 'Rate information unavailable for the selected dates. Cannot validate booking cost.'});
         }
        
             // 3. Calculate Backend Subtotal
             const dateRange = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) }); // Iterate each night

             for (const date of dateRange) {
                 const dayOfWeek = getDay(date); // 0=Sun, 6=Sat
                 const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Fri or Sat
                 let dailyRateFound = false;
     
                 for (const season of processedSeasonRates) {
                     if (season.propType === roomPropTypeKey && isWithinInterval(date, { start: season.parsedDateStart, end: season.parsedDateEndInclusive })) {
                         const rate = isWeekend ? season.rateWeekend : season.rateWeek;
                         if (typeof rate === 'number' && !isNaN(rate)) {
                             backendCalculatedSubtotal += rate;
                             dailyRateFound = true;
                             break; // Found rate for this day
                         } else {
                              throw new Error(`Invalid rate type (${typeof rate}) found in season data for ${format(date, 'yyyy-MM-dd')}`);
                         }
                     }
                 }
                 if (!dailyRateFound) {
                     functions.logger.error(`[/requestBooking] Failed to find a valid rate for room ${roomId} (key: ${roomPropTypeKey}) on ${format(date, 'yyyy-MM-dd')}`);
                     return res.status(400).json({ status: 'error', message: `Rate unavailable for ${format(date, 'yyyy-MM-dd')}. Cannot validate booking cost.` });
                 }
             }
             functions.logger.info(`[/requestBooking] Backend calculated subtotal: ${backendCalculatedSubtotal.toFixed(2)}`);
     
             // 4. Validate Costs
             const backendCalculatedTotal = Math.max(0, backendCalculatedSubtotal - discountAmount);
             const difference = Math.abs(backendCalculatedTotal - frontendTotalCost);
     
             functions.logger.info(`[/requestBooking] Comparing Costs: Frontend Total=${frontendTotalCost.toFixed(2)}, Backend Total=${backendCalculatedTotal.toFixed(2)}, Difference=${difference.toFixed(4)}`);
     
             if (difference > COST_VALIDATION_TOLERANCE) {
                 functions.logger.error(`[/requestBooking] Cost validation failed! Frontend total (${frontendTotalCost.toFixed(2)}) does not match backend calculation (${backendCalculatedTotal.toFixed(2)}).`);
                 return res.status(400).json({
                     status: 'error',
                     message: `Booking cost discrepancy detected (Expected: ${backendCalculatedTotal.toFixed(2)}, Received: ${frontendTotalCost.toFixed(2)}). Rates may have changed. Please refresh and try again.`
                 });
             }
             functions.logger.info(`[/requestBooking] Cost validation successful.`);
     
             // === End Backend Rate Calculation & Validation ===
     
        
        
        
        const pendingData = {
            // Room & Guest Info
            roomId: roomId,
            propertyId: propertyId,
            guestName: `${name} ${surname}`,
            phone: phone,
            // Dates (as Timestamps)
            checkInDate: checkInDateTs,
            checkOutDate: checkOutDateTs,
            // Status & Source
            status: 'Pending Confirmation',
            dataSource: 'WebViewer',
            // NEW: Store validated costs and details
            subtotal: parseFloat(backendCalculatedSubtotal.toFixed(2)), // Store validated subtotal
            totalCost: parseFloat(backendCalculatedTotal.toFixed(2)), // Store validated total cost
            discountAmount: parseFloat(discountAmount.toFixed(2)), // Store received discount
            discountCode: discountCode || null,
            // REMOVED: rate: parseFloat(dailyRate) || null,
            dailyRateDetails: frontendRateDetails || null, // Store frontend breakdown for auditing
            // Timestamps
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        pendingReservationRef = await db.collection('reservations').add(pendingData);
        const pendingReservationId = pendingReservationRef.id;
        functions.logger.info(`[/requestBooking] Created pending reservation ${pendingReservationId} with validated costs.`);


        // --- Respond to Frontend Immediately ---
        res.status(200).json({
            status: 'success',
            message: 'Booking request received. Awaiting confirmation.',
            pendingReservationId: pendingReservationId
        });

        // --- Asynchronously Call External Opera Service ---
        // IMPORTANT: Decide what rate to send to the external service.
        // If it still requires a single rate, calculate an average from the *validated* subtotal.
        const averageDailyRate = (numberOfNights > 0) ? (backendCalculatedSubtotal / numberOfNights) : 0;
        functions.logger.info(`[/requestBooking] Calculated average daily rate for external API: ${averageDailyRate.toFixed(2)}`);

        const checkinOperaFmt = format(startDate, 'dd.MM.yyyy');
        const checkoutOperaFmt = format(endDate, 'dd.MM.yyyy');
        const operaPayload = {
            surname: surname, name: name, phone: phone,
            // --- MODIFIED: Send calculated average rate ---
            dailyRate: averageDailyRate.toFixed(2), // Send average if external API needs single rate
            // Consider if external API can handle totalCost or subtotal instead/additionally
            // totalCost: backendCalculatedTotal.toFixed(2), // Example if API supports total
            // ---
            discountCode: discountCode,
            property: propertyId, roomId: roomId, // Ensure roomId sent here is what Opera expects (might be original resourceId if mapping occurred)
            checkin: checkinOperaFmt, checkout: checkoutOperaFmt,
            correlationId: pendingReservationId // Pass our Firestore ID

        };
        functions.logger.info(`[/requestBooking] Calling external service ${OPERA_CAPTURE_URL} for pending ID ${pendingReservationId} with payload:`, operaPayload);


        // No 'await' here. Respond first, then trigger external call.
        axios.post(OPERA_CAPTURE_URL, operaPayload, { timeout: 90000 })
            .then(operaResponse => {
                functions.logger.info(`[/requestBooking] External service call successful for ${pendingReservationId}. Status: ${operaResponse.status}. Waiting for callback.`);
            })
            .catch(operaError => {
                functions.logger.error(`[/requestBooking] Error calling external service for ${pendingReservationId}:`, { message: operaError.message, url: OPERA_CAPTURE_URL, status: operaError.response?.status });
                 // Update Firestore status
                 db.collection('reservations').doc(pendingReservationId).update({
                     status: 'Error - External Call Failed',
                     lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                     errorMessage: `Failed to initiate Opera booking: ${operaError.message}`
                 }).catch(updateError => functions.logger.error(`[/requestBooking] Failed status update after external call error for ${pendingReservationId}`, updateError));
            });

        } catch (error) { // Catch errors during room fetch, rate calc, validation, or Firestore write
            console.error('[/requestBooking] FATAL Error processing booking request:', error);
            functions.logger.error('[/requestBooking] FATAL Error', { error: error.message, stack: error.stack });
            if (pendingReservationRef?.id) { // Mark as error if partially created
                 db.collection('reservations').doc(pendingReservationRef.id).update({
                     status: 'Error - Internal Processing',
                     lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                     errorMessage: `Internal error during validation/creation: ${error.message}`
                 }).catch(err => {});
            }
            // Send error only if no success response was sent earlier
            if (!res.headersSent) {
                // Avoid sending specific calculation errors to the client unless necessary
                const userMessage = error.message.includes("Rate unavailable") || error.message.includes("Rate information unavailable")
                    ? error.message // Propagate rate availability errors
                    : `Internal server error during booking processing.`;
                res.status(500).json({ status: 'error', message: userMessage });
            }
        }
    });

// ===============================================================
// === NEW Endpoint: Receive Confirmation from External Service ===
// ===============================================================
// Example URL: POST https://<your-function-url>/confirmBooking
// --- functions/index.js ---

// --- Assume necessary imports are already present: ---
// const functions = require('firebase-functions');
// const admin = require('firebase-admin');
// const express = require('express');
// const cors = require('cors');
// const axios = require('axios');
// const { ...dateFunctions } = require('date-fns');
// etc.

// --- Assume Firebase Admin SDK is initialized: ---
// if (!admin.apps.length) {
//     admin.initializeApp();
// }
// const db = admin.firestore();

// --- Assume Express app is initialized: ---
// const app = express();
// app.use(cors({ origin: true }));
// app.use(express.json({ limit: '20mb' }));

// ===============================================================
// === Endpoint: Receive Confirmation from External Service      ===
// ===============================================================
// Example URL: POST https://<your-function-url>/confirmBooking
app.post('/confirmBooking', async (req, res) => {
    // Log incoming request details (headers might contain sensitive info like the secret, be careful in prod)
    functions.logger.info('[/confirmBooking] Received confirmation callback:', { body: req.body, headers: req.headers });



    // --- ADDED: Log the value RIGHT BEFORE checking it ---
    functions.logger.info('[/confirmBooking] Value of process.env.CALLBACK_SECRET before check:', process.env.CALLBACK_SECRET ? `SET (Length: ${process.env.CALLBACK_SECRET.length})` : 'UNDEFINED or EMPTY');
    // ----------------------------------------------------
    // --- Security Check: Shared Secret ---
    // Get the secret provided in the header (ensure header name matches what server2.js sends)
    const providedSecret = req.headers['x-callback-secret'];

    // Get the expected secret from environment variables (configure this in Firebase/GCP)
    const CALLBACK_SECRET = process.env.CALLBACK_SECRET; // Uses environment variable

    // 1. Check if the secret is configured on the Firebase side *at all*
    if (!CALLBACK_SECRET) {
         functions.logger.error('[/confirmBooking] CRITICAL: CALLBACK_SECRET environment variable is not configured for this function.');
         // This is a server configuration error, so 500 is appropriate.
         return res.status(500).json({ status: 'error', message: 'Callback secret configuration error on server.' });
    }

    // 2. Check if the provided secret matches the configured one
    if (providedSecret !== CALLBACK_SECRET) {
        functions.logger.error('[/confirmBooking] Unauthorized callback attempt. Invalid secret provided.', {
            // Avoid logging the actual provided secret in production for security
            provided: providedSecret ? '******' : 'MISSING',
            expectedLength: CALLBACK_SECRET.length // Log expected length for debugging config issues
        });
        // This is an authorization failure from the client (server2.js), so 403 is appropriate.
        return res.status(403).json({ status: 'error', message: 'Unauthorized.' });
    }

    // --- If secrets match, proceed with processing the callback ---
    functions.logger.info('[/confirmBooking] Callback secret validated successfully.');

    // Destructure expected fields from the request body
    const {
        correlationId,       // REQUIRED: Firestore document ID
        confirmationNumber,  // REQUIRED on success: Opera confirmation number
        status: operaStatus, // REQUIRED: Status from external service ('complete', 'error'?)
        errorMessage: operaErrorMessage // Optional: Error details from external service
    } = req.body;

    // Validate that the essential correlationId is present
    if (!correlationId) {
        functions.logger.error('[/confirmBooking] Callback missing correlationId.');
        // Bad request from the client (server2.js)
        return res.status(400).json({ status: 'error', message: 'Missing correlationId.' });
    }

    // Get a reference to the specific reservation document in Firestore
    const reservationRef = db.collection('reservations').doc(correlationId);

    try {
        // Fetch the existing reservation document
        const docSnap = await reservationRef.get();

        // Handle case where the reservation document doesn't exist anymore (or never did)
        if (!docSnap.exists) {
            functions.logger.error(`[/confirmBooking] Reservation document not found for correlationId: ${correlationId}`);
            // Respond 200 OK even if not found. The external service successfully sent the callback.
            // Acknowledging the callback prevents potential retries from server2.js.
            return res.status(200).json({ status: 'processed_not_found', message: 'Pending reservation not found by callback handler, but callback acknowledged.' });
        }

        // --- Determine Final Status & Prepare Update Data ---
        let finalData = {
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(), // Update timestamp
            confirmationCallbackReceived: true, // Flag that callback arrived
            operaCallbackStatus: operaStatus || null, // Store the status received from Opera service
            operaCallbackMessage: operaErrorMessage || null // Store any message/error from Opera service
        };
        let finalStatusLog = 'Unknown'; // For logging purposes

        // Standardize the received status for comparison (handle null/undefined safely)
        const statusLower = String(operaStatus || '').toLowerCase();

        // Success Case: Status indicates completion AND confirmation number is provided
        if (['complete', 'success', 'confirmed'].includes(statusLower) && confirmationNumber) {
            finalData.status = 'Confirmed'; // Set the final status in Firestore
            finalData.operaConfirmationNumber = confirmationNumber; // Store the confirmation number
            finalStatusLog = 'Confirmed';
        }
        // Success Fallback Case: Confirmation number provided, even if status is missing/unclear
        else if (!operaStatus && confirmationNumber) {
             finalData.status = 'Confirmed';
             finalData.operaConfirmationNumber = confirmationNumber;
             finalStatusLog = 'Confirmed (Implicit)';
             functions.logger.warn(`[/confirmBooking] Callback for ${correlationId} provided confirmation number but missing success status. Assuming Confirmed.`);
        }
        // Error Case: Status indicates failure, or success conditions not met
        else {
            finalData.status = 'Error - Opera Rejected'; // Set a specific error status
            finalData.errorMessage = operaErrorMessage || 'Opera service reported an error or confirmation failed.'; // Store or update error message
            finalStatusLog = `Error (${finalData.status})`; // Log the specific error status
            functions.logger.error(`[/confirmBooking] Callback for ${correlationId} indicates failure or is incomplete.`, { body: req.body });
        }

        // --- Update Firestore Document ---
        await reservationRef.update(finalData);
        functions.logger.info(`[/confirmBooking] Updated reservation ${correlationId} to status: ${finalStatusLog}`);

        // --- Acknowledge Callback Successfully Processed ---
        res.status(200).json({ status: 'success', message: 'Confirmation processed.' });

    } catch (error) {
        // Handle errors during Firestore read/update or other internal processing
        console.error(`[/confirmBooking] Error processing confirmation for ${correlationId}:`, error);
        functions.logger.error(`[/confirmBooking] Error processing confirmation for ${correlationId}`, { error: error.message, stack: error.stack });

        // IMPORTANT: Acknowledge the callback even if internal processing failed,
        // to prevent the external service (server2.js) from potentially retrying.
        // Log the internal error for debugging.
        res.status(200).json({ status: 'processed_with_error', message: `Internal server error during callback processing: ${error.message}` });
    }
});

// --- Make sure to export the 'app' for Firebase Functions: ---
// exports.api = functions.https.onRequest(app);


// Example URL: POST https://<your-function-url>/reservation (Manual/Single Update)
app.post('/reservation', async (req, res) => {
     // ... (Existing /reservation code - Ensure date handling if needed) ...
     try {
         const r = req.body;
         if (!r.id || !r.roomId) return res.status(400).send('Invalid data: Missing id or roomId');
         // Add date validation/conversion if this endpoint receives strings
         r.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
         await db.collection('reservations').doc(r.id).set(r, { merge: true });
         functions.logger.info(`[/reservation] Updated reservation ${r.id}`);
         res.status(200).send({ status: 'success', message: `Reservation ${r.id} updated.` });
     } catch (e) {
         console.error('[/reservation] Error:', e); functions.logger.error('[/reservation] Error updating reservation', { error: e.message, data: req.body });
         res.status(500).send({ status: 'error', message: `Error updating reservation: ${e.message}` });
     }
});

// Example URL: GET https://<your-function-url>/syncStatus
app.get('/syncStatus', async (req, res) => {
     // ... (Existing /syncStatus code - KEEP AS IS) ...
    try {
         const snap = await db.collection('syncLogs').orderBy('timestamp', 'desc').limit(1).get();
         if (snap.empty) { return res.status(404).json({ status: 'error', message: 'No sync logs found.' }); }
         const logData = snap.docs[0].data();
         if (logData.timestamp?.toDate) { logData.timestamp_iso = logData.timestamp.toDate().toISOString(); }
         res.status(200).json({ id: snap.docs[0].id, ...logData });
     } catch (e) { console.error('[/syncStatus] Error:', e); functions.logger.error('[/syncStatus] Error', { error: e.message }); res.status(500).send({ status: 'error', message: 'Error fetching sync status.'}); }
});

// Example URL: GET https://<your-function-url>/syncLogs
app.get('/syncLogs', async (req, res) => {
     // ... (Existing /syncLogs code - KEEP AS IS) ...
     try {
         const limit = parseInt(req.query.limit || '50', 10);
         const logsSnapshot = await db.collection('syncLogs').orderBy('timestamp', 'desc').limit(limit).get();
         let logHtml = `<h1>Sync Logs (Last ${limit})</h1><table border="1" style="border-collapse:collapse; width:95%;"><thead><tr><th>Timestamp</th><th>Status</th><th>Message</th><th>Details</th></tr></thead><tbody>`;
         if (logsSnapshot.empty) { logHtml += '<tr><td colspan="4">No logs found.</td></tr>'; }
         else { logsSnapshot.forEach(doc => { /* ... build HTML row ... */ }); }
         logHtml += '</tbody></table>';
         res.set('Content-Type', 'text/html').send(`<!DOCTYPE html><html><head><title>Sync Logs</title></head><body>${logHtml}</body></html>`);
     } catch (e) { console.error('[/syncLogs] Error:', e); functions.logger.error('[/syncLogs] Error', { error: e.message }); res.status(500).set('Content-Type', 'text/html').send('<h1>Error generating sync logs</h1>'); }
});

// Example URL: GET https://<your-function-url>/stats
app.get('/stats', async (req, res) => {
     // ... (Existing /stats code - KEEP AS IS) ...
     try {
         const roomCount = (await db.collection('rooms').count().get()).data().count;
         const resCount = (await db.collection('reservations').count().get()).data().count;
         const html = `<h1>Stats</h1><p>Total Rooms: ${roomCount}</p><p>Total Reservations: ${resCount}</p>`;
         res.set('Content-Type', 'text/html').send(`<!DOCTYPE html><html><body>${html}</body></html>`);
      } catch (e) { console.error(e); functions.logger.error('[/stats] Error', { error: e.message }); res.status(500).send('Error generating stats'); }
});

// Example URL: GET https://<your-function-url>/manualSync
app.get('/manualSync', async (req, res) => {
     // ... (Existing /manualSync code - KEEP AS IS) ...
     try {
         await db.collection('syncLogs').add({ timestamp: admin.firestore.FieldValue.serverTimestamp(), success: null, manual: true, message: 'Manual sync trigger endpoint requested.' });
         functions.logger.info('[/manualSync] Manual sync requested and logged.');
         res.send('Manual sync request logged. Trigger upload externally. <a href="/syncLogs">View Logs</a>'); // Update link
     } catch (e) { console.error('[/manualSync] Error:', e); functions.logger.error('[/manualSync] Error', { error: e.message }); res.status(500).send('Error logging manual sync request'); }
});

// Example URL: GET https://<your-function-url>/runDailyStats
app.get('/runDailyStats', async (req, res) => {
     // ... (Existing /runDailyStats code - KEEP AS IS) ...
     try {
         const today = format(new Date(), 'yyyy-MM-dd');
         const roomCount = (await db.collection('rooms').count().get()).data().count;
         // Count only active (confirmed/pending?) reservations for daily stats
         const activeResCount = (await db.collection('reservations').where('status', 'in', ['Confirmed', 'Pending Confirmation']).count().get()).data().count;
         await db.collection('dailyStats').doc(today).set({ /* ... */ }, { merge: true });
         functions.logger.info(`[/runDailyStats] Saved stats for ${today}`);
         res.status(200).json({ success: true, message: `Stats saved for ${today}.` });
     } catch (e) { console.error('[/runDailyStats] Error:', e); functions.logger.error('[/runDailyStats] Error', { error: e.message }); res.status(500).send({ status: 'error', message: `Error running daily stats: ${e.message}`}); }
});

// ========================================================================
// === NEW: Endpoint for DELETING a Booking ===
// ========================================================================
// Example URL: DELETE https://<your-function-url>/deleteBooking/<reservationId>
app.delete('/deleteBooking/:reservationId', async (req, res) => {
    const { reservationId } = req.params;
    functions.logger.info(`[/deleteBooking] Received request to delete reservation ID: ${reservationId}`);

    // --- Basic Validation ---
    if (!reservationId) {
        functions.logger.warn('[/deleteBooking] Missing reservationId parameter.');
        return res.status(400).json({ status: 'error', message: 'Missing reservation ID.' });
    }

    // --- Security Check (Example - Adapt!) ---
    // In a real app, verify the user has permission to delete this booking!
    // This might involve checking req.user (if using Firebase Auth middleware)
    // or some other authorization mechanism.
    // For now, we proceed without explicit user auth check for demonstration.
    // const userId = req.user?.uid; // Example if using auth
    // if (!userId) {
    //     functions.logger.warn('[/deleteBooking] Unauthorized delete attempt (no user).');
    //     return res.status(401).json({ status: 'error', message: 'Authentication required.' });
    // }

    const reservationRef = db.collection('reservations').doc(reservationId);

    try {
        const docSnap = await reservationRef.get();

        if (!docSnap.exists) {
            functions.logger.warn(`[/deleteBooking] Reservation document not found: ${reservationId}`);
            return res.status(404).json({ status: 'error', message: 'Reservation not found.' });
        }

        // Optional: Add condition to prevent deleting confirmed bookings from this endpoint
        const reservationData = docSnap.data();
     /*   if (reservationData.operaConfirmationNumber || reservationData.status === 'Confirmed') {
             functions.logger.warn(`[/deleteBooking] Attempted to delete a confirmed reservation: ${reservationId}`);
             // Decide if this should be an error or just ignored
             return res.status(403).json({ status: 'error', message: 'Cannot delete confirmed reservations via this method.' });
        } */

        // --- Perform Deletion ---
        await reservationRef.delete();
        functions.logger.info(`[/deleteBooking] Successfully deleted reservation: ${reservationId}`);
        res.status(200).json({ status: 'success', message: 'Reservation deleted successfully.' }); // Or 204 No Content

    } catch (error) {
        console.error(`[/deleteBooking] Error deleting reservation ${reservationId}:`, error);
        functions.logger.error(`[/deleteBooking] Error deleting reservation ${reservationId}`, { error: error.message, stack: error.stack });
        res.status(500).json({ status: 'error', message: `Internal server error: ${error.message}` });
    }
});
// ========================================================================


// ----- Your Express Route -----
app.get('/getAvailability', async (req, res) => {
    // --- Parameter Extraction & Validation ---
    functions.logger.info("[/getAvailability] Request received. Query:", req.query); // ADDED: Initial request log
    const { propertyId, startDate: startDateStr, endDate: endDateStr } = req.query;
    if (!propertyId || !startDateStr || !endDateStr) {
        functions.logger.warn("[/getAvailability] Bad Request: Missing query parameters.", { query: req.query });
        return res.status(400).send("Missing required query parameters: propertyId, startDate, endDate");
    }
    // ============================================================
    // ***** START: IMPORT VERIFICATION BLOCK *****
    // ============================================================
    try {
        functions.logger.info("[/getAvailability] Verifying date-fns imports...");
        // Check all functions used throughout the *entire* getAvailability route
        if (typeof parseISO !== 'function') throw new Error('parseISO is not a function');
        if (typeof isDateValid !== 'function') throw new Error('isDateValid (imported as isValid) is not a function');
        if (typeof startOfDay !== 'function') throw new Error('startOfDay is not a function');
        if (typeof endOfDay !== 'function') throw new Error('endOfDay is not a function'); // Used for query boundaries & season rate check
        if (typeof isBefore !== 'function') throw new Error('isBefore is not a function');
        if (typeof isAfter !== 'function') throw new Error('isAfter is not a function');   // Used in reservation filtering
        if (typeof eachDayOfInterval !== 'function') throw new Error('eachDayOfInterval is not a function');
        if (typeof format !== 'function') throw new Error('format is not a function');
        if (typeof getDay !== 'function') throw new Error('getDay is not a function');     // Used for rate calculation
        if (typeof isWithinInterval !== 'function') throw new Error('isWithinInterval is not a function'); // Used for rate calculation
        //if (typeof addDays !== 'function') throw new Error('addDays is not a function'); // Used in occupancy check

        functions.logger.info("[/getAvailability] date-fns imports appear OK.");
    } catch (importError) {
         functions.logger.error("[/getAvailability] CRITICAL: Import verification failed!", { error: importError.message });
         // Return 500 Internal Server Error because this is a setup issue
         return res.status(500).send("Internal Server Error: Date library configuration issue.");
    }
    // ============================================================
    // ***** END: IMPORT VERIFICATION BLOCK *****
    // ============================================================

    let startDate, endDate;
    // ADDED: Log before date validation try block
    functions.logger.info("[/getAvailability] Starting date validation with:", { startDateStr, endDateStr });
    try {
         // ***** START DEBUGGING LOGS (Original from Snippet 1) *****
         functions.logger.info("[/getAvailability] Attempting to parse dates:", { startDateStr, endDateStr });

         // Check types just in case
         if (typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
             throw new Error("Received non-string date parameters.");
         }

         const parsedStart = parseISO(startDateStr);
         functions.logger.info("[/getAvailability] Parsed Start Date:", { parsedStart, isValid: isDateValid(parsedStart) }); // KEPT Original log

         const parsedEnd = parseISO(endDateStr);
         functions.logger.info("[/getAvailability] Parsed End Date:", { parsedEnd, isValid: isDateValid(parsedEnd) }); // KEPT Original log
         // ***** END DEBUGGING LOGS *****


         if (!isDateValid(parsedStart) || !isDateValid(parsedEnd)) {
              throw new Error(`Invalid date format or value after parsing. Start valid: ${isDateValid(parsedStart)}, End valid: ${isDateValid(parsedEnd)}`);
         }

         startDate = startOfDay(parsedStart);
         endDate = startOfDay(parsedEnd); // NOTE: Snippet 1 used startOfDay here. Keeping it consistent.

         if (isBefore(endDate, startDate)) {
             throw new Error("End date cannot be before start date.");
         }
         // Use format for consistency in logging validated dates
         functions.logger.info("[/getAvailability] Date validation successful:", { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') });

     } catch (error) {
         functions.logger.error("[/getAvailability] Invalid Date Parameters Caught:", { query: req.query, error: error.message });
         return res.status(400).send(`Invalid date format or range: ${error.message}`);
     }


    // --- Authorization / Staff View Check ---
    // TODO: Implement real Firebase Auth check here
    const isStaff = true; // <<< HARDCODED FOR TESTING - REMOVE/REPLACE
    if(isStaff) { functions.logger.info("[/getAvailability] Running in STAFF view mode (TESTING)."); }

    try {
        // ADDED: Log before core data fetching
        functions.logger.info("[/getAvailability] Proceeding to fetch core data...");

        // --- 1. Fetch Rooms (Include necessary fields for rate lookup) ---
        const roomsQuery = db.collection('rooms')
            .where('propertyId', '==', propertyId)
            .orderBy('roomNumber', 'asc');
        const roomsSnapshot = await roomsQuery.get();

        // ***** INSERT LOG 1: Count from Firestore *****
        functions.logger.info(`[/getAvailability] Firestore rooms query returned ${roomsSnapshot.size} documents.`);
        // *******************************************

        if (roomsSnapshot.empty) {
            functions.logger.warn(`[/getAvailability] No rooms found for propertyId: ${propertyId}`);
            return res.status(404).send(`No rooms found for property ${propertyId}`);
        }

        // --- Map Room Data (Original logic from Snippet 1) ---
        const rooms = roomsSnapshot.docs.map(doc => {
            const data = doc.data() || {}; // Use empty object default
            // Original mapping logic, no try/catch inside map from snippet 2
            return {
                id: doc.id,
                // Provide sensible defaults for all needed fields
                name: data.title || data.roomNumber || doc.id,
                roomNumber: data.roomNumber || 'N/A',
                roomType: data.roomType || 'Unknown',
                actType: data.actType || 'Unknown', // Needed for rate key
                propRate: data.propRate || 'std'     // Needed for rate key
            };
        }); // No .filter here, keeping original behavior

        // ***** INSERT LOG 2: Count and Samples After Mapping *****
        functions.logger.info(`[/getAvailability] Successfully mapped ${rooms.length} room objects.`);
        if (rooms.length > 5) {
            functions.logger.info(`[/getAvailability] Mapped - First 5 room numbers:`, rooms.slice(0, 5).map(r => r?.roomNumber || 'MAPPING_ISSUE'));
            functions.logger.info(`[/getAvailability] Mapped - Last 5 room numbers:`, rooms.slice(-5).map(r => r?.roomNumber || 'MAPPING_ISSUE'));
        } else if (rooms.length > 0) {
            functions.logger.info(`[/getAvailability] Mapped - All room numbers:`, rooms.map(r => r?.roomNumber || 'MAPPING_ISSUE'));
        }
        // ******************************************************

        const allRoomIds = rooms.map(room => room.id);
        // Original log: functions.logger.info(`[/getAvailability] Fetched ${rooms.length} rooms for property ${propertyId}.`); // (Replaced by Log 2)

        // --- 2. Fetch Relevant Reservations ---
        // ADDED: Log before reservation fetch
        functions.logger.info(`[/getAvailability] Fetching reservations for ${allRoomIds.length} room IDs...`);
        const firestoreRangeEnd = admin.firestore.Timestamp.fromDate(endOfDay(endDate)); // Use endOfDay for query boundary
        const firestoreRangeStart = admin.firestore.Timestamp.fromDate(startOfDay(startDate));
        const allReservationsRaw = [];
        const MAX_IN_VALUES = 30; // Firestore 'in' query limit

        for (let i = 0; i < allRoomIds.length; i += MAX_IN_VALUES) {
            const roomIdsChunk = allRoomIds.slice(i, i + MAX_IN_VALUES);
            if (roomIdsChunk.length > 0) {
                const reservationQuery = db.collection('reservations')
                    .where('propertyId', '==', propertyId)
                    .where('roomId', 'in', roomIdsChunk)
                    .where('status', '!=', 'Cancelled') // Exclude cancelled
                     // Broaden query slightly for safety, filter overlap precisely later
                    .where('checkInDate', '<=', firestoreRangeEnd) // checkIn <= rangeEnd
                    .where('checkOutDate', '>', firestoreRangeStart); // checkOut > rangeStart

                const reservationQuerySnapshot = await reservationQuery.get();
                reservationQuerySnapshot.forEach(doc => {
                     allReservationsRaw.push({ fbId: doc.id, ...doc.data() });
                });
            }
        }
        functions.logger.info(`[/getAvailability] Fetched ${allReservationsRaw.length} potential reservations.`);

        // --- 3. Process Reservations (Parse Dates, Filter Overlap - Original Logic) ---
        const reservations = allReservationsRaw.map(data => {
            let checkInDateObj = null;
            let checkOutDateObj = null;
            let areDatesValid = false;

            try {
                // Attempt to parse Check-In Date
                if (data.checkInDate?.toDate) { // Handle Firestore Timestamp
                    checkInDateObj = startOfDay(data.checkInDate.toDate());
                } else if (typeof data.checkInDate === 'string') { // Handle ISO String
                    const parsed = parseISO(data.checkInDate);
                    if (isDateValid(parsed)) checkInDateObj = startOfDay(parsed);
                }

                // Attempt to parse Check-Out Date (use startOfDay for exclusive comparison)
                if (data.checkOutDate?.toDate) { // Handle Firestore Timestamp
                    checkOutDateObj = startOfDay(data.checkOutDate.toDate());
                } else if (typeof data.checkOutDate === 'string') { // Handle ISO String
                    const parsed = parseISO(data.checkOutDate);
                    if (isDateValid(parsed)) checkOutDateObj = startOfDay(parsed);
                }

                // Check if both dates are valid JS Date objects
                areDatesValid = checkInDateObj instanceof Date && !isNaN(checkInDateObj) &&
                                checkOutDateObj instanceof Date && !isNaN(checkOutDateObj);

            } catch (e) {
                 functions.logger.warn(`[/getAvailability] Error parsing dates for reservation ${data.fbId}.`, { checkIn: data.checkInDate, checkOut: data.checkOutDate, error: e.message });
                 areDatesValid = false;
            }

            if (areDatesValid &&
                // Check if reservation interval actually overlaps the requested view range
                isBefore(checkInDateObj, endOfDay(endDate)) && // CheckIn is before the range ends (using endOfDay for inclusive end)
                isAfter(checkOutDateObj, startOfDay(startDate)) // CheckOut is after the range starts
               ) {
                 // Return processed reservation object IF dates are valid and overlap
                 return {
                    fbId: data.fbId,
                    roomId: data.roomId,
                    propertyId: data.propertyId,
                    guestName: data.guestName || 'N/A', // Default
                    operaConfirmationNumber: data.operaConfirmationNumber || null,
                    status: data.status || 'Unknown', // Default
                    errorMessage: data.errorMessage || null,
                    rate: data.rate ?? null, // Keep original rate if needed
                    // Store the valid JS Date objects (start of day)
                    checkInDate: checkInDateObj,
                    checkOutDate: checkOutDateObj
                };
            } else {
                // If dates invalid or no overlap, filter out this reservation
                if (!areDatesValid) {
                     functions.logger.debug(`[/getAvailability] Excluding reservation ${data.fbId} due to invalid dates.`);
                } else {
                    // This is normal, reservation exists but is outside the view window
                    // functions.logger.debug(`[/getAvailability] Excluding reservation ${data.fbId} as it's outside the requested date range.`);
                }
                return null; // Filter this out
            }
        }).filter(res => res !== null); // Remove null entries from the array

        functions.logger.info(`[/getAvailability] Processed ${reservations.length} valid, overlapping reservations.`);


        // --- 4. Fetch and Process Season Rates ---
        // ADDED: Log before season rate fetch
        functions.logger.info(`[/getAvailability] Fetching and processing season rates...`);
        const processedSeasonRates = [];
        try {
            // Add .where('propertyId', '==', propertyId) if season rates are property-specific
            const seasonRatesQuery = db.collection('seasonRates'); // Potentially add .where('propertyId', '==', propertyId)
            const seasonRatesSnapshot = await seasonRatesQuery.get();

            seasonRatesSnapshot.forEach(doc => {
                const data = doc.data() || {}; // Default to empty object
                try {
                    let seasonStart = null; let seasonEnd = null;

                    // Parse Start Date
                    if (data.dateStart?.toDate) seasonStart = data.dateStart.toDate();
                    else if (typeof data.dateStart === 'string') {
                        const parsed = parseISO(data.dateStart);
                        if (isDateValid(parsed)) seasonStart = parsed;
                    }

                    // Parse End Date
                    if (data.dateEnd?.toDate) seasonEnd = data.dateEnd.toDate();
                    else if (typeof data.dateEnd === 'string') {
                         const parsed = parseISO(data.dateEnd);
                         if (isDateValid(parsed)) seasonEnd = parsed;
                    }

                    // Validate dates and ensure required rate fields exist
                    if (!(seasonStart instanceof Date && !isNaN(seasonStart)) ||
                        !(seasonEnd instanceof Date && !isNaN(seasonEnd)) ||
                         data.rateWeek === undefined || data.rateWeekend === undefined || !data.propType ) {
                          throw new Error(`Invalid dates or missing required fields (propType, rateWeek, rateWeekend)`);
                    }

                    // Use startOfDay for start, endOfDay for end to create an inclusive interval
                    const parsedStart = startOfDay(seasonStart);
                    const parsedEndInclusive = endOfDay(seasonEnd); // Use end of day for inclusive check

                    // Check if the season *might* overlap the requested range (optimization)
                    // Using endOfDay(endDate) and startOfDay(startDate) for range boundaries consistent with reservation query
                    if (isBefore(parsedStart, endOfDay(endDate)) && isAfter(parsedEndInclusive, startOfDay(startDate))) {
                         processedSeasonRates.push({
                             id: doc.id,
                             propType: data.propType, // e.g., "supStudio"
                             currency: data.currency || 'N/A', // Default currency
                             rateWeek: data.rateWeek,
                             rateWeekend: data.rateWeekend,
                             // Add minStay if needed later: minStayWeekday, minStayWeekend
                             parsedDateStart: parsedStart, // JS Date (start of day)
                             parsedDateEndInclusive: parsedEndInclusive // JS Date (end of day, for interval check)
                         });
                    }
                } catch (parseError) {
                    functions.logger.warn(`[/getAvailability] Skipping seasonRate ${doc.id} due to processing error: ${parseError.message}`, { data });
                }
            });
            // Original log text style
            functions.logger.info(`[/getAvailability] Fetched and processed ${processedSeasonRates.length} potentially relevant season rates.`);
        } catch (rateError) {
            functions.logger.error(`[/getAvailability] CRITICAL: Error fetching/processing season rates: ${rateError.message}`, { error: rateError });
            // Decide how to handle: continue without rates or fail request?
            // Let's continue for now, but rates will be missing. Frontend should handle null rateDisplay.
        }


        // --- 5. Build Availability Map (Combining Occupancy and Rates - Original Logic) ---
        // ADDED: Log before map building
        functions.logger.info(`[/getAvailability] Building availability map...`);
        const availabilityMap = {};
        const dateRange = eachDayOfInterval({ start: startDate, end: endDate }); // Array of Date objects

        rooms.forEach(room => {
            // Basic check if room object is valid (minimal addition for robustness)
             if (!room || !room.id) {
                functions.logger.warn("[/getAvailability] Skipping map generation for invalid room object.");
                return; // Skip this room iteration
             }
            availabilityMap[room.id] = {};
            dateRange.forEach(date => { // 'date' is a JS Date object for the current day (start of day)
                 // Basic check if date object is valid (minimal addition for robustness)
                 if (!isDateValid(date)) {
                    functions.logger.warn("[/getAvailability] Skipping map cell for invalid date object.");
                     return; // Skip this date iteration
                 }
                const dateStr = format(date, 'yyyy-MM-dd');
                let cellData = { status: 'error', reason: 'Initialization failed' }; // Default cautious status

                // a) Check for Occupancy (Original Logic using isBefore)
                // Note: isBefore(date, res.checkOutDate) means booked UNTIL the checkout date (exclusive).
                // So a checkout on the 15th means the 14th is the last occupied night.
                const occupyingReservation = reservations.find(res =>
                    res.roomId === room.id &&
                    (isBefore(res.checkInDate, date) || res.checkInDate.getTime() === date.getTime()) && // checkIn <= date
                    isBefore(date, res.checkOutDate) // date < checkOut (Exclusive endpoint)
                );

                if (occupyingReservation) {
                    // --- Handle Occupied Cell ---
                    let gridStatus = 'occupied_unknown'; // Fallback
                    if (occupyingReservation.status === 'Confirmed') gridStatus = 'occupied_confirmed';
                    else if (occupyingReservation.status === 'Pending Confirmation') gridStatus = 'occupied_pending';
                    else if (occupyingReservation.status && occupyingReservation.status.startsWith('Error')) gridStatus = 'occupied_error';

                    cellData = { status: gridStatus };

                    // Add details ONLY for staff view
                    if (isStaff) {
                        cellData.reservationStatus = occupyingReservation.status;
                        cellData.guestName = occupyingReservation.guestName; // Already defaulted
                        cellData.confNum = occupyingReservation.operaConfirmationNumber || (occupyingReservation.status === 'Pending Confirmation' ? 'Pending' : 'N/A');
                        cellData.reservationId = occupyingReservation.fbId;
                        cellData.checkIn = format(occupyingReservation.checkInDate, 'yyyy-MM-dd');
                        cellData.checkOut = format(occupyingReservation.checkOutDate, 'yyyy-MM-dd');
                        if (occupyingReservation.errorMessage) {
                            cellData.errorMessage = occupyingReservation.errorMessage;
                        }
                    }
                } else {
                    // --- Handle Available Cell (Calculate Rate - Original Logic) ---
                    cellData = { status: 'available', rateDisplay: null }; // Mark as available, default rateDisplay to null

                    try {
                        // ADDED: Check if rates were actually processed before trying to calculate
                        if (processedSeasonRates.length > 0) {
                            const dayOfWeek = getDay(date); // 0=Sun, 6=Sat
                            const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Fri or Sat

                            // Construct lookup key (case-insensitive) using room properties
                            const roomPropTypeKey = `${room.propRate || 'std'}${room.actType || 'Unknown'}`.toLowerCase();
                            // NOTE: Keeping original key construction, no '.replace(/(\d)br$/, '$1-br')' adjustment here

                            let foundRate = undefined; // Use undefined to distinguish from a rate of 0
                            let foundCurrency = 'N/A';

                            // Find matching season rate
                            for (const season of processedSeasonRates) {
                                // Check date is within this season's range
                                const dateIsInSeason = isWithinInterval(date, {
                                    start: season.parsedDateStart,
                                    end: season.parsedDateEndInclusive // Inclusive end check
                                });
                                // Check property type matches (case-insensitive, check season.propType exists)
                                const typeMatches = season.propType?.toLowerCase() === roomPropTypeKey;

                                if (dateIsInSeason && typeMatches) {
                                    foundRate = isWeekend ? season.rateWeekend : season.rateWeek;
                                    foundCurrency = season.currency || 'N/A';
                                    // Optional: Add minStay check logic here if needed
                                    break; // Found the rate for this date/room
                                }
                            }

                            // Add rateDisplay to the map if rate was found (and is not null/undefined)
                            if (foundRate !== undefined && foundRate !== null) {
                                // Format the display string (KEEPING ORIGINAL DETAILED REPLACEMENTS)
                                cellData.rateDisplay = `${foundCurrency} ${foundRate}`.replace('ZAR', 'R').replace('USD', '$').replace('EUR', '€').replace('GBP', '£');
                            } else {
                                // functions.logger.debug(`[/getAvailability] No rate found for available cell: ${room.id} on ${dateStr} (key: ${roomPropTypeKey})`);
                                // rateDisplay remains null (or set explicit N/A if preferred)
                                // cellData.rateDisplay = 'N/A'; // Uncomment if explicit 'N/A' is better than null
                            }
                        } else {
                             // ADDED: Log warning if no rates available, set explicit display
                             functions.logger.warn(`[/getAvailability] No processed season rates available for calculating rate on ${dateStr}. Setting rateDisplay to 'N/A'.`);
                             cellData.rateDisplay = 'N/A';
                        }
                    } catch (rateCalcError) {
                         functions.logger.error(`[/getAvailability] Error calculating rate for ${room.id} on ${dateStr}: ${rateCalcError.message}`);
                         cellData.rateDisplay = 'Rate Error'; // Indicate error clearly
                    }
                }
                 // Assign the calculated cellData to the map
                 availabilityMap[room.id][dateStr] = cellData;
            }); // End dateRange loop
        }); // End rooms loop
        // ADDED: Log after map building
        functions.logger.info(`[/getAvailability] Availability map built.`);


        // --- 6. Construct Final JSON Response ---
        // ADDED: Log before constructing response
        functions.logger.info(`[/getAvailability] Constructing final response...`);
        const responseData = {
            query: { propertyId, startDate: startDateStr, endDate: endDateStr },
            // Ensure rooms array includes needed properties for frontend
            rooms: rooms.map(r => ({
                id: r.id,
                name: r.name,
                roomNumber: r.roomNumber,
                roomType: r.roomType,
                actType: r.actType, // Include actType
                propRate: r.propRate  // Include propRate
            })),
            dates: dateRange.map(d => format(d, 'yyyy-MM-dd')),
            isStaffView: isStaff,
            availability: availabilityMap, // Contains statuses AND rateDisplay for available cells
             // Send RESERVATIONS data (convert dates back to strings for JSON)
             // Conditionally include sensitive details based on isStaff
            reservations: reservations.map(r => ({
                // Non-sensitive fields always included
                fbId: r.fbId,
                roomId: r.roomId,
                propertyId: r.propertyId,
                status: r.status,
                checkInDate: format(r.checkInDate, 'yyyy-MM-dd'), // Format back to string
                checkOutDate: format(r.checkOutDate, 'yyyy-MM-dd'), // Format back to string
                // Sensitive fields only for staff
                ...(isStaff && {
                    guestName: r.guestName,
                    operaConfirmationNumber: r.operaConfirmationNumber,
                    errorMessage: r.errorMessage,
                    rate: r.rate // Include original reservation rate if needed by staff view
                })
            })),
             // Exclude processedSeasonRates from response unless specifically needed by client
        };

        // ***** INSERT LOG 3: Count and Samples Before Sending *****
        functions.logger.info(`[/getAvailability] Preparing to send response with ${responseData.rooms?.length || 0} rooms.`);
        if (responseData.rooms?.length > 5) {
             functions.logger.info(`[/getAvailability] Sending - First 5 room numbers:`, responseData.rooms.slice(0, 5).map(r => r?.roomNumber || 'RESPONSE_ERROR'));
             functions.logger.info(`[/getAvailability] Sending - Last 5 room numbers:`, responseData.rooms.slice(-5).map(r => r?.roomNumber || 'RESPONSE_ERROR'));
        } else if (responseData.rooms?.length > 0) {
            functions.logger.info(`[/getAvailability] Sending - All room numbers:`, responseData.rooms.map(r => r?.roomNumber || 'RESPONSE_ERROR'));
        }
        // **************************************************

        res.status(200).json(responseData);
        // MODIFIED final success log
        functions.logger.info(`[/getAvailability] Successfully served availability.`);

    } catch (error) {
        // Catch any unexpected errors during the main processing
        // ADDED: Context to error log
        functions.logger.error("[/getAvailability] UNHANDLED Internal Server Error in main logic:", {
            query: req.query, propertyId, startDateStr, endDateStr, // Log context
            error: error.message,
            stack: error.stack // Log stack trace for debugging
        });
        res.status(500).send("Internal Server Error. Please try again later or contact support.");
    }
});


// --- Updated Endpoint: /properties searches for properties qualifying for web user interface. ---
// --- Updated Endpoint: /properties searches for properties qualifying for web user interface. ---
// Presuming this is an Express app or similar (e.g., for Google Cloud Functions/Run)
// const functions = require('firebase-functions'); // If using Firebase Functions
// const admin = require('firebase-admin'); // If using Firebase Functions and Admin SDK
// const { startOfDay, parseISO, isAfter } = require('date-fns'); // Example date library

// Helper function: isDateValid (assuming you have this defined)
// const isDateValid = (date) => date instanceof Date && !isNaN(date);


app.get('/properties', async (req, res) => {
    const funcName = '[/properties]';
    // functions.logger.info(`${funcName} Request received. Query:`, req.query); // Use your logger

    // --- 1. Extract and Validate Query Parameters ---
    const {
        destinationName,
        startDate: startDateStr,
        endDate: endDateStr,
        adults: adultsStr,
        children: childrenStr,
        roomType,
        limit: limitStr
    } = req.query;

    const returnLimit = parseInt(limitStr || '10', 10);

    if (!destinationName || !startDateStr || !endDateStr) {
        // functions.logger.warn(`${funcName} Missing required parameters.`);
        return res.status(400).json({ status: 'error', message: 'Missing required parameters: destinationName, startDate, endDate.' });
    }

    // --- 2. Parse and Validate Dates ---
    let requestedStartDate, requestedEndDate;
    let requestedStartDateTs, requestedExclusiveEndDateTs;
    try {
        // Ensure you have `startOfDay`, `parseISO`, `isDateValid`, `isAfter` defined or imported
        requestedStartDate = startOfDay(parseISO(startDateStr));
        requestedEndDate = startOfDay(parseISO(endDateStr));
        if (!isDateValid(requestedStartDate) || !isDateValid(requestedEndDate) || !isAfter(requestedEndDate, requestedStartDate)) {
            throw new Error('Invalid date format or end date must be after start date.');
        }
        // Ensure `admin.firestore.Timestamp` is available if you're using Admin SDK Timestamps
        requestedStartDateTs = admin.firestore.Timestamp.fromDate(requestedStartDate);
        requestedExclusiveEndDateTs = admin.firestore.Timestamp.fromDate(requestedEndDate);
        // functions.logger.info(`${funcName} Date range parsed:`, { start: startDateStr, end: endDateStr });
    } catch (e) {
        // functions.logger.warn(`${funcName} Invalid date parameters:`, { startDateStr, endDateStr, error: e.message });
        return res.status(400).json({ status: 'error', message: `Invalid date format or range: ${e.message}` });
    }

    // --- 3. Parse Guest Counts & Apply Logic ---
    const adults = parseInt(adultsStr || '1', 10);
    const children = parseInt(childrenStr || '0', 10);
    const totalGuests = adults + children;

    if (isNaN(adults) || isNaN(children) || adults < 1 || children < 0) {
        // functions.logger.warn(`${funcName} Invalid guest count.`);
        return res.status(400).json({ status: 'error', message: 'Invalid guest count.' });
    }
    if (adults > 6) {
        // functions.logger.info(`${funcName} Request exceeds max adults (6). Returning empty.`);
        return res.status(200).json([]);
    }
    // functions.logger.info(`${funcName} Guest counts parsed:`, { adults, children, totalGuests });

    const calculateMaxOccupancy = (room) => {
        const bedrooms = room.bedrooms;
        if (room.actType?.toLowerCase() === 'penthouse') return 6;
        if (bedrooms === 3) return 6;
        if (bedrooms === 2) return 4;
        if (bedrooms === 1) return 2;
        if (bedrooms === 0) return 2;
        return 2;
    };

    try {
        // --- 4. Fetch Potential Rooms based on Destination ---
        let roomsQuery = db.collection('rooms') // Assuming 'db' is your initialized Firestore instance
                           .where('imageUrls', '!=', null); // Or some other base filter

        if (destinationName && destinationName.toLowerCase() !== 'all destinations') {
            // functions.logger.info(`${funcName} Filtering rooms by destination: ${destinationName}`);
            roomsQuery = roomsQuery.where('destinationName', '==', destinationName);
        } else {
            // functions.logger.info(`${funcName} Fetching for all destinations.`);
        }

        const roomsSnapshot = await roomsQuery.get();

        if (roomsSnapshot.empty) {
            // functions.logger.info(`${funcName} No rooms found with images for criteria.`);
            return res.status(200).json([]);
        }

        let potentialRooms = [];
        roomsSnapshot.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                potentialRooms.push({ id: doc.id, ...data });
            }
        });
        // functions.logger.info(`${funcName} Found ${potentialRooms.length} potential rooms with images matching destination filter.`);

        // --- 5. Filter Rooms by Guests & Room Type ---
        const guestFilteredRooms = potentialRooms.filter(room => {
             const maxOcc = calculateMaxOccupancy(room); if (totalGuests > maxOcc) return false;
             const bedrooms = room.bedrooms; const isPenthouse = room.actType?.toLowerCase() === 'penthouse';
             if (adults >= 5 && adults <= 6) { if (!(bedrooms === 3 || isPenthouse)) return false; }
             else if (adults >= 3 && adults <= 4) { if (!(bedrooms === 2 || bedrooms === 3 || isPenthouse)) return false; }
             else if (adults >= 1 && adults <= 2) { if (children >= 1 && children <= 2) { if (!(bedrooms === 2 || bedrooms === 3 || isPenthouse)) return false; } else if (children > 2) { if (!(bedrooms === 3 || isPenthouse)) return false; } }
             return true;
         });
        // functions.logger.info(`${funcName} ${guestFilteredRooms.length} rooms after guest filter.`);

        const typeFilteredRooms = !roomType ? guestFilteredRooms : guestFilteredRooms.filter(room => {
             const typeLower = roomType.toLowerCase().replace(' ', '').replace('bedroom','').replace('bed','');
             const bedrooms = room.bedrooms;
             const roomActualTypeLower = room.actType?.toLowerCase();
             if (typeLower === "studio" && roomActualTypeLower === "studio") return true;
             if (typeLower === "penthouse" && roomActualTypeLower === "penthouse") return true;
             if (typeLower === "1" && bedrooms === 1 && roomActualTypeLower !== "studio" && roomActualTypeLower !== "penthouse") return true;
             if (typeLower === "2" && bedrooms === 2 && roomActualTypeLower !== "studio" && roomActualTypeLower !== "penthouse") return true;
             if (typeLower === "3" && bedrooms === 3 && roomActualTypeLower !== "studio" && roomActualTypeLower !== "penthouse") return true;
             return false;
         });
        // functions.logger.info(`${funcName} ${typeFilteredRooms.length} rooms after roomType filter ('${roomType || 'N/A'}').`);

        // --- 6. Check Availability ---
        const availableRooms = [];
        await Promise.all(typeFilteredRooms.map(async (room) => {
             try {
                 const reservationsQuery = db.collection('reservations').where('roomId', '==', room.id).where('status', '!=', 'Cancelled').where('checkInDate', '<', requestedExclusiveEndDateTs).where('checkOutDate', '>', requestedStartDateTs).limit(1);
                 const reservationSnapshot = await reservationsQuery.get();
                 if (reservationSnapshot.empty) { availableRooms.push(room); }
             } catch(error) { /* functions.logger.error(`${funcName} Error checking reservation for room ${room.id}:`, error); */ }
         }));
        // functions.logger.info(`${funcName} Found ${availableRooms.length} available rooms.`);

        if (availableRooms.length === 0) { return res.status(200).json([]); }

        // --- 7. Format, Select Cover Image, and Prioritize Results ---
        const selectCoverImage = (imageUrls) => {
             if (!Array.isArray(imageUrls) || imageUrls.length === 0) { return null; } let cover = imageUrls.find(img => img.isCover === true); if (cover?.url) return cover.url; cover = imageUrls.find(img => img.category?.toLowerCase() === 'living_room'); if (cover?.url) return cover.url; cover = imageUrls.find(img => img.category?.toLowerCase() === 'balcony_patio'); if (cover?.url) return cover.url; return imageUrls[0].url;
        };

        const roomsByHotel = availableRooms.reduce((acc, room) => {
              const hotelCode = room.hotelCode || 'UNKNOWN'; if (!acc[hotelCode]) { acc[hotelCode] = []; } acc[hotelCode].push(room); return acc;
        }, {});

        const prioritizedResults = [];
        const hotelCodes = Object.keys(roomsByHotel);
        let hotelIndex = 0; let itemsAdded = 0;
        const hotelIndices = hotelCodes.reduce((acc, code) => { acc[code] = 0; return acc; }, {});

        while (itemsAdded < returnLimit && itemsAdded < availableRooms.length) {
             const currentHotelCode = hotelCodes[hotelIndex % hotelCodes.length]; const currentHotelList = roomsByHotel[currentHotelCode]; const currentIndex = hotelIndices[currentHotelCode];
             if (currentIndex < currentHotelList.length) {
                 const room = currentHotelList[currentIndex]; // This 'room' object is from Firestore
                 let latitude = null, longitude = null;
                 if (room.gpsCoordinates && typeof room.gpsCoordinates === 'string') { try { const parts = room.gpsCoordinates.split(',').map(s => parseFloat(s.trim())); if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) { latitude = parts[0]; longitude = parts[1]; } else { throw new Error('Invalid parts'); } } catch (parseError) { /* functions.logger.warn(`${funcName} Invalid gpsCoordinates format for room ${room.id}:`, room.gpsCoordinates); */ } }

                 const coverImageUrl = selectCoverImage(room.imageUrls);
                 const priceDisplay = "Price TBD";

                 // --- ANNOTATED CHANGE: Add existing thumbnail URL from the room data ---
                 // We assume the field in your Firestore 'rooms' document containing
                 // the pre-existing thumbnail URL is named 'actualThumbnailUrl'.
                 // If it's named something else (e.g., 'thumbnailUrl', 'thumbUrl'),
                 // change 'room.actualThumbnailUrl' to 'room.yourFieldName'.
                 const thumbnailImageUrl = room.thumbnailImageUrl || null; // Use the existing field or null if not present
                 const shortDescription = room.description50 || null; // Optional: Add short description if needed
                 const longDescription = room.description500 || null; // Optional: Add long description if needed  

                 prioritizedResults.push({
                     id: room.id,
                     name: room.name || room.title || room.id,
                     coverImageUrl: coverImageUrl,
                     thumbnailImageUrl: thumbnailImageUrl, // <<< ADDED/MODIFIED THIS FIELD
                     bedrooms: room.bedrooms,
                     maxOccupancy: calculateMaxOccupancy(room),
                     priceDisplay: priceDisplay,
                     latitude: latitude,
                     longitude: longitude,
                     hotelCode: room.hotelCode,
                     shortDescription: shortDescription,
                     longDescription: longDescription
                 });
                 hotelIndices[currentHotelCode]++; itemsAdded++;
             }
             hotelIndex++;
             let remainingRooms = false;
             for(const code of hotelCodes) { if (hotelIndices[code] < roomsByHotel[code].length) { remainingRooms = true; break; } }
             if (!remainingRooms && itemsAdded < availableRooms.length) { break; }
             if (hotelIndex > availableRooms.length * hotelCodes.length * 2) { /* functions.logger.error(`${funcName} Prioritization loop exceeded safety limit.`); */ break; }
        }
        // functions.logger.info(`${funcName} Returning ${prioritizedResults.length} prioritized and limited results (limit=${returnLimit}).`);

        // --- 8. Send Response ---
        res.status(200).json(prioritizedResults);

    } catch (error) {
        // functions.logger.error(`${funcName} Unhandled error:`, { message: error.message, stack: error.stack });
        console.error(`${funcName} Unhandled error:`, error); // Log the error for debugging
        res.status(500).json({ status: 'error', message: 'Internal Server Error processing property search.' });
    }
});
// --- Remember other imports, initializations, and exports ---
// const { Timestamp } = require('firebase-admin/firestore');
// etc...
// exports.api = onRequest(...)

// Assume admin, db, app, functions are initialized

app.get('/roomImageStats', async (req, res) => {
    const funcName = '[/roomImageStats]';
    functions.logger.info(`${funcName} Request received.`);

    try {
        // Fetch all documents from the 'rooms' collection
        // For very large collections, consider pagination or querying subsets
        const roomsSnapshot = await db.collection('rooms').get();

        let totalRoomsChecked = 0;
        let roomsWithAnyImages = 0;
        let roomsWithIsCoverTrue = 0;
        let roomsWithLivingRoomImage = 0;
        const destinations = new Set(); // Use a Set to store unique destination names
        const roomsPerDestination = {}; // Count rooms per destination

        roomsSnapshot.forEach(doc => {
            totalRoomsChecked++;
            const roomData = doc.data();
            const roomDest = roomData.destinationName || 'Unknown'; // Get destination

            // Add to unique destinations set
            destinations.add(roomDest);

            // Count rooms per destination
            roomsPerDestination[roomDest] = (roomsPerDestination[roomDest] || 0) + 1;

            // Check imageUrls array
            if (Array.isArray(roomData.imageUrls) && roomData.imageUrls.length > 0) {
                roomsWithAnyImages++;

                // Check for isCover: true within the array
                const hasCover = roomData.imageUrls.some(img => img.isCover === true);
                if (hasCover) {
                    roomsWithIsCoverTrue++;
                }

                // Check for category 'living_room' within the array
                const hasLivingRoom = roomData.imageUrls.some(img =>
                    typeof img.category === 'string' && // Check if category exists and is string
                    img.category.toLowerCase() === 'living_room'
                );
                if (hasLivingRoom) {
                    roomsWithLivingRoomImage++;
                }
            }
        });

        const stats = {
            totalRoomsChecked: totalRoomsChecked,
            numberOfDestinations: destinations.size,
            destinations: Array.from(destinations).sort(), // Return sorted list of destinations
            roomsPerDestination: roomsPerDestination,      // Detailed count per destination
            roomsWithAnyImages: roomsWithAnyImages,
            roomsWithIsCoverTrue: roomsWithIsCoverTrue,
            roomsWithLivingRoomImage: roomsWithLivingRoomImage,
            timestamp: new Date().toISOString()
        };

        functions.logger.info(`${funcName} Stats calculated:`, stats);
        res.status(200).json(stats);

    } catch (error) {
        functions.logger.error(`${funcName} Error calculating stats:`, { message: error.message, stack: error.stack });
        res.status(500).json({ status: 'error', message: 'Failed to calculate room image stats.' });
    }
});

// Make sure this is exported with your other functions/app
// exports.api = onRequest(...)



// ===============================================================
// === TEMPORARY Endpoint: Test Secret Environment Variable      ===
// ===============================================================
// Example URL: GET https://<your-function-url>/test-secret-env
app.get('/test-secret-env', (req, res) => {
    functions.logger.info('[/test-secret-env] Attempting to read CALLBACK_SECRET environment variable...');

    // --- Access the environment variable ---
    // NOTE: Use the EXACT name you plan to set/use.
    // If you just renamed it in the previous code snippet for testing, use CALLBACK_SECRET2.
    // If you intend to use CALLBACK_SECRET, test process.env.CALLBACK_SECRET here.
    const secretValue = process.env.CALLBACK_SECRET; // Or process.env.CALLBACK_SECRET

    // --- Check if the variable was found ---
    if (secretValue) {
        // Variable IS set. IMPORTANT: DO NOT return the actual value!
        functions.logger.info('[/test-secret-env] SUCCESS: CALLBACK_SECRET environment variable was found.');
        res.status(200).json({
            status: 'found',
            message: 'Environment variable CALLBACK_SECRET is set.',
            // You could return non-sensitive info like its length for confirmation
            length: secretValue.length
        });
    } else {
        // Variable is NOT set (it's undefined, null, or potentially empty string)
        functions.logger.error('[/test-secret-env] FAILED: CALLBACK_SECRET environment variable is NOT SET or is empty in this environment.');
        // Use a status code that makes sense - 404 might indicate the "resource" (variable) wasn't found
        res.status(404).json({
            status: 'not_found',
            message: 'Environment variable CALLBACK_SECRET is NOT configured or is empty for this function instance.'
        });
    }
});


// Endpoint to get distinct destinations (or hotels)
app.get('/admin/destinations', async (req, res) => {
    const funcName = '[/admin/destinations]';
    functions.logger.info(`${funcName} Request received.`);
    try {
        // Option A: Get from Hotels collection
        const hotelsSnapshot = await db.collection('hotels').select('destinationName').get();
        const destinations = new Set();
        hotelsSnapshot.forEach(doc => {
            const dest = doc.data()?.destinationName;
            if (dest) destinations.add(dest);
        });

        const sortedDestinations = Array.from(destinations).sort();
        functions.logger.info(`${funcName} Found destinations:`, sortedDestinations);
        res.status(200).json(sortedDestinations);
    } catch (error) {
        functions.logger.error(`${funcName} Error fetching destinations:`, error);
        res.status(500).json({ message: 'Error fetching destinations' });
    }
});


// Route for updating daily room states
app.post('/updateDailyRoomStates', async (req, res) => {
    console.log('====== HTTP POST /updateDailyRoomStates endpoint HIT in index.js! ======');
    console.log('Request Body received:', JSON.stringify(req.body, null, 2));

    try {
        // Validate incoming data (basic example)
        if (!req.body || !req.body.propertyId) {
            console.warn('Missing propertyId in request body for /updateDailyRoomStates');
            return res.status(400).send({ error: 'Missing required parameter: propertyId' });
        }

        // Call the imported function from roomStates.js
        // req.body contains the payload (e.g., { propertyId, startDate, endDate })
        // The 'context' argument for a direct HTTP call like this is usually null or not needed
        // unless your roomStatesController.updateDailyRoomStates specifically uses it.
        await roomStatesController.updateDailyRoomStates(req.body, null);

        console.log('/updateDailyRoomStates processed successfully by roomStatesController.');
        res.status(200).send({ message: 'Update process for daily room states initiated successfully.' });
    } catch (error) {
        console.error('Error inside /updateDailyRoomStates POST handler (index.js):', error.message);
        console.error('Error stack:', error.stack); // Log the full stack for better debugging
        // Send a generic error response to the client
        res.status(500).send({
            error: 'An internal error occurred while processing the request.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined // Only show details in dev
        });
    }
});





// ========================================================================
// === NEW Endpoint: Receive GPS Tracker Data                         ===
// ========================================================================
// Example URL: POST https://<your-function-url>/tracker
app.post('/tracker', async (req, res) => {
    functions.logger.info('[/tracker] Received GPS update request:', req.body);

    const { deviceId, latitude, longitude, timestamp: timestampStr } = req.body;

    // --- Basic Input Validation ---
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
        functions.logger.warn('[/tracker] Bad Request: Missing or invalid deviceId.');
        return res.status(400).json({ status: 'error', message: 'Missing or invalid deviceId (string, non-empty).' });
    }
    if (latitude === undefined || longitude === undefined || typeof latitude !== 'number' || typeof longitude !== 'number') {
        functions.logger.warn('[/tracker] Bad Request: Missing or invalid coordinates.', { deviceId });
        return res.status(400).json({ status: 'error', message: 'Missing or invalid latitude/longitude (must be numbers).' });
    }
    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
         functions.logger.warn('[/tracker] Bad Request: Coordinates out of range.', { deviceId, latitude, longitude });
        return res.status(400).json({ status: 'error', message: 'Latitude must be between -90 and 90, Longitude between -180 and 180.' });
    }
    if (!timestampStr || typeof timestampStr !== 'string') {
        functions.logger.warn('[/tracker] Bad Request: Missing or invalid timestamp string.', { deviceId });
        return res.status(400).json({ status: 'error', message: 'Missing or invalid timestamp (must be an ISO 8601 string).' });
    }

    let locationTimestamp;
    try {
        const parsedDate = new Date(timestampStr); // Assumes ISO 8601 format like "2023-10-27T10:30:00Z"
        if (isNaN(parsedDate.getTime())) {
            throw new Error('Invalid date format');
        }
        locationTimestamp = Timestamp.fromDate(parsedDate); // Convert to Firestore Timestamp
    } catch (e) {
        functions.logger.warn('[/tracker] Bad Request: Cannot parse timestamp string.', { deviceId, timestampStr, error: e.message });
        return res.status(400).json({ status: 'error', message: 'Invalid timestamp format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ssZ).' });
    }

    // Firestore references
    const deviceRef = db.collection('devices').doc(deviceId);
    const historyCollectionRef = deviceRef.collection('locationHistory');

    try {
        // Data to save in the history subcollection
        const locationData = {
            latitude: latitude,
            longitude: longitude,
            timestamp: locationTimestamp, // The actual time the location was recorded by the device
            receivedAt: Timestamp.now() // Server timestamp when this record was received/processed
        };

        // Add the new location entry to the history subcollection (Firestore auto-generates ID)
        const historyDocRef = await historyCollectionRef.add(locationData);
        functions.logger.info(`[/tracker] Successfully logged location for device ${deviceId}. History doc ID: ${historyDocRef.id}`);

        // Optionally: Update the parent device document with the last known info (good for quick lookups)
        await deviceRef.set({
            lastLatitude: latitude,
            lastLongitude: longitude,
            lastTimestamp: locationTimestamp,
            lastUpdateReceivedAt: locationData.receivedAt,
            deviceId: deviceId // Store deviceId redundantly for easier top-level queries if needed later
        }, { merge: true }); // Use merge:true to create or update without overwriting other fields

        // Respond with success
        res.status(201).json({ status: 'success', message: 'Location logged successfully.', historyId: historyDocRef.id });

    } catch (error) {
        console.error(`[/tracker] Error saving location for device ${deviceId}:`, error);
        functions.logger.error(`[/tracker] Firestore error for device ${deviceId}`, { error: error.message, stack: error.stack });
        res.status(500).json({ status: 'error', message: 'Internal server error saving location data.' });
    }
});





// ========================================================================
// === NEW Endpoint: Retrieve GPS Tracker History                     ===
// ========================================================================
// Example URL: GET https://<your-function-url>/tracker/history?deviceId=unique-abc&limit=50&startDate=2023-10-26T00:00:00Z&endDate=2023-10-27T23:59:59Z
app.get('/tracker/history', async (req, res) => {
    functions.logger.info('[/tracker/history] Received history request:', req.query);

    const { deviceId, limit: limitStr, startDate: startDateStr, endDate: endDateStr } = req.query;

    // --- Validation ---
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
        functions.logger.warn('[/tracker/history] Bad Request: Missing or invalid deviceId.');
        return res.status(400).json({ status: 'error', message: 'Missing or invalid deviceId query parameter.' });
    }

    // Firestore reference to the specific device's history
    const deviceRef = db.collection('devices').doc(deviceId);
    const historyCollectionRef = deviceRef.collection('locationHistory');

    // --- Build Query ---
    // Start with base query, ordering by the location timestamp
    let query = historyCollectionRef.orderBy('timestamp', 'asc'); // Ascending for plotting lines chronologically

    // Apply date filters if provided and valid
    try {
        if (startDateStr) {
            const startDate = new Date(startDateStr);
            if (isNaN(startDate.getTime())) throw new Error('Invalid startDate format');
            query = query.where('timestamp', '>=', Timestamp.fromDate(startDate));
        }
        if (endDateStr) {
            const endDate = new Date(endDateStr);
            if (isNaN(endDate.getTime())) throw new Error('Invalid endDate format');
            query = query.where('timestamp', '<=', Timestamp.fromDate(endDate));
        }
    } catch (e) {
        functions.logger.warn('[/tracker/history] Bad Request: Invalid date format in query.', { deviceId, query: req.query, error: e.message });
        return res.status(400).json({ status: 'error', message: `Invalid date format: ${e.message}. Use ISO 8601.` });
    }

    // Apply limit if provided and valid
    const limit = parseInt(limitStr || '100', 10); // Default to 100 if not provided
    if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit);
    } else if (limitStr) {
         functions.logger.warn('[/tracker/history] Invalid limit parameter, using default.', { deviceId, limitStr });
         query = query.limit(100); // Apply default limit if input was invalid but present
    }


    try {
        // Optional: Check if device document exists first for a cleaner 404
        const deviceDoc = await deviceRef.get();
        if (!deviceDoc.exists) {
             functions.logger.warn(`[/tracker/history] Device document not found for deviceId: ${deviceId}`);
             // Return 404 Not Found, but could also return 200 with empty history array
             return res.status(404).json({ status: 'error', message: `Device with ID ${deviceId} not found.` });
        }

        // Execute the query
        const snapshot = await query.get();

        // Process results
        const history = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Convert Firestore Timestamp back to ISO string for the client
            const timestampISO = data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : null;

            if (timestampISO && data.latitude !== undefined && data.longitude !== undefined) {
                history.push({
                    id: doc.id, // Include the history document ID
                    latitude: data.latitude,
                    longitude: data.longitude,
                    timestamp: timestampISO, // Send as ISO string
                    // receivedAt: data.receivedAt?.toDate ? data.receivedAt.toDate().toISOString() : null // Optionally include received time
                });
            } else {
                functions.logger.warn(`[/tracker/history] Skipping history entry ${doc.id} due to missing fields.`, { data });
            }
        });

        functions.logger.info(`[/tracker/history] Found ${history.length} history entries for device ${deviceId}`);

        // Respond with the history data
        res.status(200).json({
            status: 'success',
            deviceId: deviceId,
            queryUsed: { // Echo back parameters for clarity
                limit: limit,
                startDate: startDateStr || null,
                endDate: endDateStr || null
            },
            history: history
        });

    } catch (error) {
        // Handle potential Firestore errors during query execution
        console.error(`[/tracker/history] Error fetching history for device ${deviceId}:`, error);
        functions.logger.error(`[/tracker/history] Firestore query error for device ${deviceId}`, { error: error.message, stack: error.stack });

        // Firestore might require an index. Check logs for a link to create it.
        if (error.code === 'failed-precondition') {
             return res.status(500).json({ status: 'error', message: 'Database requires an index for this query. Please check server logs for a creation link.' });
        }

        res.status(500).json({ status: 'error', message: 'Internal server error fetching location history.' });
    }
});





// Helper to compare Firestore Timestamps (as they are objects)
function areTimestampsEqual(ts1, ts2) {
    if (ts1 === ts2) return true; // Same object or both null/undefined
    if (!ts1 || !ts2) return false; // One is null/undefined
    if (typeof ts1.isEqual === 'function') return ts1.isEqual(ts2); // Firestore v9+
    if (ts1.seconds !== undefined && ts2.seconds !== undefined) { // Older SDK or plain objects
        return ts1.seconds === ts2.seconds && ts1.nanoseconds === ts2.nanoseconds;
    }
    // Fallback for JS Dates if Timestamps were converted
    if (ts1 instanceof Date && ts2 instanceof Date) {
        return ts1.getTime() === ts2.getTime();
    }
    return false;
}



// ----- Make sure app listens if this is the main file -----
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}...`);
// });
// --- EXPORT using runWith ---
exports.api = onRequest(
    {
        secrets: ["CALLBACK_SECRET"], // Declare the secret
        region: 'us-central1',        // Explicitly set region (good practice for v2)
        // memory: '256MiB',          // Optional: Set memory
        // timeoutSeconds: 60,         // Optional: Set timeout
    },
    app // Pass your fully configured Express app instance
);

//exports.api = functions.https.onRequest(app);
  
  //--- END OF FULL `functions/index.js` ---