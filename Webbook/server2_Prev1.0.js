require('dotenv').config(); // Load variables from .env into process.env
console.log('Environment variables loaded:');
console.log('CALLBACK_URL present:', !!process.env.CALLBACK_URL);
console.log('CALLBACK_SECRET present:', !!process.env.CALLBACK_SECRET);
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
const express = require('express');
const { spawn } = require('child_process'); // Use spawn directly
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // <-- Import Axios

// --- Configuration from Environment Variables ---
const CALLBACK_URL = process.env.CALLBACK_URL;
const CALLBACK_SECRET = process.env.CALLBACK_SECRET;
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
            // Avoid stringifying large objects like request bodies in general logs if too verbose
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
    // Avoid logging sensitive data potentially in body/query for production
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
    origin: ['https://vacprop.ddns.net', 'https://cal-airb-api.web.app', 'http://localhost:3000'], // Add other allowed origins if needed
    methods: ['POST', 'GET', 'OPTIONS'], // Allow GET for health check
    allowedHeaders: ['Content-Type', 'X-Callback-Secret'], // Allow secret header if needed (though it's outgoing here)
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
    // ... (keep existing validation function) ...
    logger.debug(`Validating date format: ${dateStr}`);
    const regex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!regex.test(dateStr)) { return false; }
    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const isValid = ( date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year && date <= new Date('2100-12-31') && date >= new Date('2000-01-01') );
    logger.debug(`Date validation result for ${dateStr}: ${isValid}`);
    return isValid;
};

// --- NEW: Callback Function ---
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
        const response = await axios.post(CALLBACK_URL, payload, { headers: headers, timeout: 15000 }); // 15s timeout
        logger.info(`Callback successful for ${correlationId}`, { responseStatus: response.status, responseData: response.data });
    } catch (error) {
        logger.error(`Callback failed for ${correlationId}`, {
            errorMessage: error.message,
            requestUrl: CALLBACK_URL,
            requestPayload: payload, // Be careful logging sensitive data in production
            responseStatus: error.response?.status,
            responseData: error.response?.data
        });
        // Optional: Implement retry logic here if needed
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
        // Don't send callback if initial validation fails
        return res.status(400).json({ error: 'Missing required fields', details: `Please provide: ${missingFields.join(', ')}` });
    }
    if (!validateDateFormat(checkin) || !validateDateFormat(checkout)) {
        logger.warn('Invalid date format', { checkin, checkout, requestData: requestLogData });
        // Don't send callback for invalid date format
        return res.status(400).json({ error: 'Invalid date format', details: 'Dates must be in DD.MM.YYYY format.' });
    }
    const checkinDate = new Date(checkin.split('.').reverse().join('-'));
    const checkoutDate = new Date(checkout.split('.').reverse().join('-'));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (checkinDate < today) {
        logger.warn('Check-in date in the past', { checkin, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid check-in date', details: 'Check-in date cannot be in the past.' });
    }
    if (checkoutDate <= checkinDate) {
        logger.warn('Check-out date not after check-in', { checkin, checkout, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid date range', details: 'Check-out date must be after check-in date.' });
    }
    if (!/^[A-Z]{3}-\d{4}$/.test(roomId)) { // Adjusted regex for room ID format XXX-DDDD
        logger.warn('Invalid roomId format', { roomId, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid room ID format', details: 'Room ID must be like XXX-DDDD.' });
    }
    const parsedRate = parseFloat(dailyRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
        logger.warn('Invalid daily rate', { dailyRate, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid daily rate', details: 'Daily rate must be a positive number.' });
    }
    // --- End Validation ---

    // --- Sanitize Inputs (Keep existing sanitization) ---
    const sanitizedInputs = {
        surname: String(surname).replace(/[^a-zA-Z\s'-]/g, ''), // Allow apostrophe, hyphen
        name: String(name).replace(/[^a-zA-Z\s'-]/g, ''),
        phone: String(phone).replace(/[^0-9+\-()\s]/g, ''), // Allow +, (), space, -
        property: String(property).replace(/[^a-zA-Z0-9\s-]/g, ''),
        roomId: String(roomId).replace(/[^A-Z0-9-]/g, ''),
        checkin: checkin, // Keep original validated format
        checkout: checkout,
        dailyRate: parsedRate.toFixed(2), // Use validated & formatted rate
        discountCode: String(discountCode).replace(/[^a-zA-Z0-9_-]/g, '') // Allow underscore, hyphen
    };
    // --- End Sanitization ---


    // --- Setup SSE Response ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    const sendSse = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendSse({ status: 'progress', message: 'Request received, starting process...' });
    // --- End SSE Setup ---


    // --- Execute capture2.js ---
    const commandArgs = [
        'capture2.js', // Assuming capture2.js is in the same directory or PATH
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
    logger.info(`Spawning capture2.js for correlationId: ${correlationId}`, { args: commandArgs.slice(1) }); // Don't log script name itself

    const childProcess = spawn('node', commandArgs, { encoding: 'utf8' }); // Specify encoding

    let stdoutData = '';
    let stderrData = ''; // Capture stderr for potential error messages

    // Handle stderr (progress updates and potential errors from capture2.js)
    childProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        stderrData += message + '\n'; // Accumulate stderr
        logger.debug(`capture2.js [stderr] for ${correlationId}: ${message}`);
        // Send specific progress messages if desired (parse message content)
        if (message.includes("Navigating to login page") || message.includes("Submitting booking") /* etc. */) {
            sendSse({ status: 'progress', message: message });
        }
    });

    // Handle stdout (expected: confirmation number on success)
    childProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        stdoutData += message; // Accumulate stdout
        logger.debug(`capture2.js [stdout] for ${correlationId}: ${message}`);
    });

    // Handle process errors (e.g., command not found)
    childProcess.on('error', (error) => {
        logger.error(`Failed to spawn capture2.js for ${correlationId}`, { error: error.message, stack: error.stack });
        sendSse({ status: 'error', message: `Internal server error starting reservation process: ${error.message}` });
        res.end(); // Close SSE connection
        // --- Trigger Error Callback ---
        sendCallback(correlationId, 'error', { errorMessage: `Failed to start capture process: ${error.message}` });
    });

    // Handle process completion
    childProcess.on('close', (code) => {
        logger.info(`capture2.js process finished for ${correlationId}`, { exitCode: code });

        // Trim stdout data only after process close
        const confirmationNumber = stdoutData.trim();

        if (code === 0 && /^\d{9}$/.test(confirmationNumber) && confirmationNumber.startsWith('4')) {
            // --- SUCCESS ---
            logger.info(`Successfully obtained confirmation for ${correlationId}: ${confirmationNumber}`);
            sendSse({
                status: 'complete', // Change status text slightly
                message: 'Reservation process completed. Confirmation number obtained.',
                // confirmationNumber: confirmationNumber // REMOVED - rely on callback
            });
            res.end(); // Close SSE connection
            // --- Trigger Success Callback ---
            sendCallback(correlationId, 'complete', { confirmationNumber: confirmationNumber });

        } else {
            // --- FAILURE ---
            const errorMessage = `capture2.js failed (Code: ${code}). Confirmation invalid or missing. Stdout: [${stdoutData}] Stderr: [${stderrData.trim()}]`;
            logger.error(`Reservation failed for ${correlationId}`, { exitCode: code, confirmationAttempt: confirmationNumber, stdout: stdoutData, stderr: stderrData.trim() });
            sendSse({ status: 'error', message: errorMessage });
            res.end(); // Close SSE connection
            // --- Trigger Error Callback ---
            sendCallback(correlationId, 'error', { errorMessage: errorMessage });
        }
    });

    // Handle potential timeout of the main request (though SSE should keep it alive)
    req.on('close', () => {
        logger.warn(`Client closed connection prematurely for ${correlationId}`);
        if (!childProcess.killed) {
            logger.info(`Killing capture2.js process for ${correlationId} due to client disconnect.`);
            childProcess.kill(); // Terminate the child process if client disconnects
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
    } else {
        // Attempt to end the response if headers were already sent (e.g., during SSE)
        res.end();
    }
});
// ---

// --- Start Server ---
const PORT = process.env.PORT || 3234;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    if (!CALLBACK_URL || !CALLBACK_SECRET) {
        logger.warn('!!! CALLBACK_URL or CALLBACK_SECRET environment variables are not set. Callbacks will fail. !!!');
    } else {
        logger.info(`Callback URL configured: ${CALLBACK_URL}`);
    }
});
// ---