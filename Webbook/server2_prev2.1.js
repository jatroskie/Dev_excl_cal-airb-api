// File: server2.js
require('dotenv').config(); // Load variables from .env into process.env
console.log('Environment variables loaded:');
console.log('CALLBACK_URL present:', !!process.env.CALLBACK_URL);
console.log('CALLBACK_SECRET present:', !!process.env.CALLBACK_SECRET2);
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
const express = require('express');
const { spawn } = require('child_process'); // Use spawn directly
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // <-- Import Axios for callbacks

// --- Configuration from Environment Variables ---
const CALLBACK_URL = process.env.CALLBACK_URL; // e.g., https://<your-function-url>/confirmBooking
const CALLBACK_SECRET = process.env.CALLBACK_SECRET; // Your shared secret key
// ---

const app = express();

// --- Logging Setup (Winston) ---
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Control log level via env var
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} ${level.toUpperCase()}: ${message} ${metaString}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: path.join(logsDir, 'server-error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logsDir, 'server.log') }),
        new winston.transports.Console({
             format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});
process.on('uncaughtException', (error) => { logger.error('Uncaught Exception', { error: error.stack }); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { logger.error('Unhandled Rejection', { reason: reason, promise: promise }); });
// --- End Logging Setup ---

// --- Middleware ---
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    logger.info(`REQ <<< ${req.method} ${req.originalUrl}`, { ip: req.ip });
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`RES >>> ${req.method} ${req.originalUrl} ${res.statusCode} ${res.statusMessage} (${duration}ms)`, { ip: req.ip });
    });
    next();
});

// Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 100,
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req) => req.ip // Use IP address for rate limiting
});
app.use(limiter);

// CORS Configuration
app.use(cors({
    // Adjust origins based on where your BookingModal/Dashboard is hosted
    origin: ['https://vacprop.ddns.net', 'https://cal-airb-api.web.app', 'https://api-yzrm33bhsq-uc.a.run.app', 'http://localhost:3000', 'http://localhost:3001'], // Add dev/prod origins
    methods: ['POST', 'GET', 'OPTIONS'], // Allow GET for health check
    allowedHeaders: ['Content-Type', 'x-callback-secret'], // Allow secret header for callback
    maxAge: 86400
}));
// --- End Middleware ---

// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
// ---

// --- Helper Functions ---
const validateDateFormat = (dateStr) => {
    logger.debug(`Validating date format: ${dateStr}`);
    const regex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!regex.test(dateStr)) { return false; }
    const [day, month, year] = dateStr.split('.').map(Number);
    // Basic numeric checks and range checks
    if (isNaN(day) || isNaN(month) || isNaN(year) || year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }
    try {
        const date = new Date(year, month - 1, day);
        // Check if the Date object components match the input (accounts for invalid days like Feb 30)
        const isValid = (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day);
        logger.debug(`Date validation result for ${dateStr}: ${isValid}`);
        return isValid;
    } catch (e) {
        logger.warn(`Date validation threw error for ${dateStr}`, { error: e.message });
        return false;
    }
};

// --- Callback Function ---
/**
 * Sends a callback notification to the configured Firebase Function endpoint.
 * @param {string} correlationId - The unique ID linking back to the pending reservation.
 * @param {string} status - 'complete' or 'error'.
 * @param {object} data - Contains 'confirmationNumber' on success or 'errorMessage' on error.
 */
const sendCallback = async (correlationId, status, data) => {
    if (!CALLBACK_URL || !CALLBACK_SECRET) {
        logger.error('Callback failed: CALLBACK_URL or CALLBACK_SECRET not configured in environment variables.');
        return; // Cannot send callback
    }

    const payload = {
        correlationId: correlationId,
        status: status, // 'complete' or 'error'
        ...(status === 'complete' && { confirmationNumber: data.confirmationNumber }),
        ...(status === 'error' && { errorMessage: data.errorMessage }),
    };

    const headers = {
        'Content-Type': 'application/json',
        'X-Callback-Secret': CALLBACK_SECRET, // Add the shared secret header
        'User-Agent': 'OperaCaptureService/1.0' // Optional: Identify the caller
    };

    logger.info(`Attempting callback for ${correlationId} to ${CALLBACK_URL}`, { status: status });
    try {
        // Increased timeout for potentially slow Firebase cold starts
        const response = await axios.post(CALLBACK_URL, payload, { headers: headers, timeout: 30000 }); // 30s timeout
        logger.info(`Callback successful for ${correlationId}`, { responseStatus: response.status, responseData: response.data });
    } catch (error) {
        logger.error(`Callback failed for ${correlationId}`, {
            errorMessage: error.message,
            requestUrl: CALLBACK_URL,
            // Avoid logging sensitive data in production if payload might contain it
            // requestPayload: payload,
            responseStatus: error.response?.status,
            responseData: error.response?.data
        });
        // Optional: Implement retry logic here if needed (e.g., using exponential backoff)
    }
};
// --- End Callback Function ---


// --- Main Reservation Endpoint ---
app.post('/resLoader', async (req, res) => {
    // --- Accept correlationId ---
    const {
        surname, name, phone, property, roomId, checkin, checkout, dailyRate,
        discountCode = '', // Default discountCode to empty string
        correlationId // <<< ACCEPT correlationId
    } = req.body;

    const requestLogData = { surname, name, phone, property, roomId, checkin, checkout, dailyRate, discountCode, correlationId, ip: req.ip };
    logger.info('Processing reservation request', requestLogData);

    // --- Validation ---
    const requiredFields = ['surname', 'name', 'phone', 'property', 'roomId', 'checkin', 'checkout', 'dailyRate', 'correlationId']; // Add correlationId
    const missingFields = requiredFields.filter(field => !req.body[field] || String(req.body[field]).trim() === '');

    if (missingFields.length > 0) {
        logger.warn('Missing required fields', { missingFields, requestData: requestLogData });
        // Don't send callback if initial validation fails; respond directly.
        return res.status(400).json({ error: 'Missing required fields', details: `Please provide: ${missingFields.join(', ')}` });
    }
    // Robust date validation
    if (!validateDateFormat(checkin) || !validateDateFormat(checkout)) {
        logger.warn('Invalid date format', { checkin, checkout, requestData: requestLogData });
        // Don't send callback for invalid date format
        return res.status(400).json({ error: 'Invalid date format', details: 'Dates must be in DD.MM.YYYY format.' });
    }
    try {
        const checkinDate = new Date(checkin.split('.').reverse().join('-'));
        const checkoutDate = new Date(checkout.split('.').reverse().join('-'));
        const today = new Date(); today.setHours(0, 0, 0, 0); // Compare against start of today

        if (checkinDate < today) {
            logger.warn('Check-in date in the past', { checkin, requestData: requestLogData });
            return res.status(400).json({ error: 'Invalid check-in date', details: 'Check-in date cannot be in the past.' });
        }
        if (checkoutDate <= checkinDate) {
            logger.warn('Check-out date not after check-in', { checkin, checkout, requestData: requestLogData });
            return res.status(400).json({ error: 'Invalid date range', details: 'Check-out date must be after check-in date.' });
        }
    } catch (dateCompareError) {
         logger.error('Error comparing dates', { checkin, checkout, error: dateCompareError.message, requestData: requestLogData });
         return res.status(400).json({ error: 'Invalid date values', details: 'Could not compare provided dates.' });
    }
    // Example Room ID format validation (adjust regex as needed)
    if (!/^[A-Z]{3}-\d{1,4}$/.test(roomId)) { // e.g., TBA-0302 or CRY-1 etc.
        logger.warn('Invalid roomId format', { roomId, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid room ID format', details: 'Room ID format seems incorrect (e.g., XXX-NNNN).' });
    }
    const parsedRate = parseFloat(dailyRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
        logger.warn('Invalid daily rate', { dailyRate, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid daily rate', details: 'Daily rate must be a positive number.' });
    }
    // --- End Validation ---

    // --- Sanitize Inputs ---
    // Keeping simple sanitization; consider more robust libraries if needed
    const sanitizedInputs = {
        surname: String(surname).replace(/[^a-zA-Z\s'-]/g, ''),
        name: String(name).replace(/[^a-zA-Z\s'-]/g, ''),
        phone: String(phone).replace(/[^0-9+\-()\s]/g, ''),
        property: String(property).replace(/[^a-zA-Z0-9\s-]/g, ''),
        roomId: String(roomId).replace(/[^A-Z0-9-]/g, ''),
        checkin: checkin, // Use original validated format
        checkout: checkout,
        dailyRate: parsedRate.toFixed(2), // Use validated & formatted rate
        discountCode: String(discountCode).replace(/[^a-zA-Z0-9_-]/g, '')
    };
    // --- End Sanitization ---


    // --- Setup SSE Response (Optional: for progress updates) ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    const sendSse = (data) => {
        // Check if connection is still writable before sending
        if (res.writableEnded) {
            logger.debug('SSE client disconnected, skipping SSE send.');
            return;
        }
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (sseError) {
             logger.warn('Error writing to SSE stream (client likely disconnected)', { error: sseError.message });
        }
    };

    sendSse({ status: 'progress', message: 'Request received, starting reservation capture process...' });
    // --- End SSE Setup ---


    // --- Execute capture2.js ---
    const commandArgs = [
        'capture2.js', // Ensure this script is accessible
        sanitizedInputs.surname,
        sanitizedInputs.name,
        sanitizedInputs.phone,
        sanitizedInputs.property,
        sanitizedInputs.roomId,
        sanitizedInputs.checkin,
        sanitizedInputs.checkout,
        sanitizedInputs.dailyRate,
        sanitizedInputs.discountCode
    ];
    logger.info(`Spawning capture2.js for correlationId: ${correlationId}`, { args: commandArgs.slice(1) }); // Log args without script name

    const childProcess = spawn('node', commandArgs, { encoding: 'utf8' });

    let stdoutData = '';
    let stderrData = ''; // Capture stderr for potential error messages

    // Handle stderr (progress updates and potential errors from capture2.js)
    childProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        stderrData += message + '\n'; // Accumulate stderr
        logger.debug(`capture2.js [stderr] for ${correlationId}: ${message}`);
        // Send specific progress messages via SSE if desired (parse message content)
        if (message.startsWith('DEBUG:')) { // Send debug messages as progress
            sendSse({ status: 'progress', message: message.substring(7) }); // Remove 'DEBUG: ' prefix
        } else if (message.startsWith('Error:')) { // Log stderr errors clearly
             logger.warn(`capture2.js script reported error via stderr for ${correlationId}: ${message}`);
        }
    });

    // Handle stdout (expected: confirmation number on success)
    childProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        stdoutData += message; // Accumulate stdout
        logger.debug(`capture2.js [stdout] for ${correlationId}: ${message}`);
    });

    // Handle process spawning errors (e.g., 'node' not found, script not found)
    childProcess.on('error', (error) => {
        const errorMsg = `Failed to start capture process: ${error.message}`;
        logger.error(`Failed to spawn capture2.js for ${correlationId}`, { error: error.message, stack: error.stack });
        // *** Trigger ERROR Callback because the process couldn't even start ***
        sendCallback(correlationId, 'error', { errorMessage: errorMsg });
        // *** End SSE connection if still open, sending error status ***
        if (!res.writableEnded) {
            sendSse({ status: 'error', message: errorMsg });
            res.end();
        }
    });

    // Handle process completion (capture2.js finished execution)
    childProcess.on('close', (code) => {
        logger.info(`capture2.js process finished for ${correlationId}`, { exitCode: code });

        // Trim stdout data only after process close
        const confirmationNumber = stdoutData.trim();

        if (code === 0 && /^\d{9}$/.test(confirmationNumber) && confirmationNumber.startsWith('4')) {
            // --- SUCCESS ---
            logger.info(`Successfully obtained confirmation for ${correlationId}: ${confirmationNumber}. Triggering SUCCESS callback.`);
            // *** Trigger SUCCESS Callback ***
            sendCallback(correlationId, 'complete', { confirmationNumber: confirmationNumber });
            // (Optional: Send a final "process complete" SSE message, but not the confirmation number)
            // sendSse({ status: 'progress', message: 'Capture script finished successfully.' });

        } else {
            // --- FAILURE ---
            const errorMessage = `Capture script failed (Exit Code: ${code}). Confirmation invalid or missing. Check logs. Stdout: [${stdoutData.substring(0,100)}...] Stderr: [${stderrData.trim().substring(0,200)}...]`; // Limit log length
            logger.error(`Reservation capture failed for ${correlationId}`, { exitCode: code, confirmationAttempt: confirmationNumber, stdoutSnippet: stdoutData.substring(0,100), stderrSnippet: stderrData.trim().substring(0,200) });
            // *** Trigger ERROR Callback ***
            sendCallback(correlationId, 'error', { errorMessage: errorMessage });
            // (Optional: Send a final "process failed" SSE message)
            // sendSse({ status: 'error', message: 'Capture script failed. See server logs for details.' });
        }

        // *** End SSE connection cleanly ***
        if (!res.writableEnded) {
            res.end();
        }
    });

    // Handle client disconnecting before process finishes
    req.on('close', () => {
        // Check if the child process is still running before logging/killing
        if (childProcess.exitCode === null && !childProcess.killed) {
            logger.warn(`Client closed connection prematurely for ${correlationId}. Terminating capture process.`);
            childProcess.kill('SIGTERM'); // Attempt graceful termination first
             // Optionally, send an error callback if the process was killed due to disconnect
             // sendCallback(correlationId, 'error', { errorMessage: 'Client disconnected before confirmation received.' });
        } else {
            logger.info(`Client connection closed for ${correlationId} after capture process finished.`);
        }
    });

});
// --- End Main Reservation Endpoint ---


// --- 404 Handler ---
app.use((req, res) => {
    logger.warn('Route not found', { method: req.method, url: req.url, ip: req.ip });
    res.status(404).json({ error: 'Not Found' });
});
// ---

// --- Global Error Handler (Catches errors from middleware/routes) ---
app.use((err, req, res, next) => {
    logger.error('Global error handler caught an error', {
        errorMessage: err.message,
        errorStack: err.stack,
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        requestIp: req.ip
    });
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', details: 'An unexpected error occurred.' });
    } else if (!res.writableEnded) {
        // Attempt to end the response if headers were sent but connection is open (e.g., during SSE)
        res.end();
    }
});
// ---

// --- Start Server ---
const PORT = process.env.PORT || 3234;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    if (!CALLBACK_URL || !CALLBACK_SECRET) {
        logger.warn('!!! CALLBACK_URL or CALLBACK_SECRET environment variables are not set. Callbacks to the main backend will FAIL. !!!');
    } else {
        logger.info(`Callback URL configured: ${CALLBACK_URL}`);
        logger.info(`Callback Secret is ${CALLBACK_SECRET ? 'SET' : 'NOT SET'}`);
    }
});