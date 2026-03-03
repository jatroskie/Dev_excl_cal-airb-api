// File: server2.js
require('dotenv').config(); // Load variables from .env into process.env
console.log('Environment variables loaded:');
console.log('CALLBACK_URL present:', !!process.env.CALLBACK_URL);
console.log('CALLBACK_SECRET present:', !!process.env.CALLBACK_SECRET);
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
    level: process.env.LOG_LEVEL || 'info',
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

app.use((req, res, next) => {
    const start = Date.now();
    logger.info(`REQ <<< ${req.method} ${req.originalUrl}`, { ip: req.ip });
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`RES >>> ${req.method} ${req.originalUrl} ${res.statusCode} ${res.statusMessage} (${duration}ms)`, { ip: req.ip });
    });
    next();
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 100,
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req) => req.ip
});
app.use(limiter);

app.use(cors({
    origin: ['https://vacprop.ddns.net', 'https://cal-airb-api.web.app', 'https://api-yzrm33bhsq-uc.a.run.app', 'http://localhost:3000', 'http://localhost:3001', 'https://vacprop.com'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-callback-secret'],
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
    if (isNaN(day) || isNaN(month) || isNaN(year) || year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }
    try {
        const date = new Date(year, month - 1, day);
        const isValid = (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day);
        logger.debug(`Date validation result for ${dateStr}: ${isValid}`);
        return isValid;
    } catch (e) {
        logger.warn(`Date validation threw error for ${dateStr}`, { error: e.message });
        return false;
    }
};

// --- Callback Function ---
const sendCallback = async (correlationId, status, data) => {
    if (!CALLBACK_URL || !CALLBACK_SECRET) {
        logger.error('Callback failed: CALLBACK_URL or CALLBACK_SECRET not configured in environment variables.');
        return;
    }
    const payload = {
        correlationId: correlationId,
        status: status,
        ...(status === 'complete' && { confirmationNumber: data.confirmationNumber }),
        ...(status === 'error' && { errorMessage: data.errorMessage }),
    };
    const headers = {
        'Content-Type': 'application/json',
        'X-Callback-Secret': CALLBACK_SECRET,
        'User-Agent': 'OperaCaptureService/1.0'
    };
    logger.info(`Attempting callback for ${correlationId} to ${CALLBACK_URL}`, { status: status });
    try {
        const response = await axios.post(CALLBACK_URL, payload, { headers: headers, timeout: 30000 });
        logger.info(`Callback successful for ${correlationId}`, { responseStatus: response.status, responseData: response.data });
    } catch (error) {
        logger.error(`Callback failed for ${correlationId}`, {
            errorMessage: error.message,
            requestUrl: CALLBACK_URL,
            responseStatus: error.response?.status,
            responseData: error.response?.data
        });
    }
};
// --- End Callback Function ---

// --- Main Reservation Endpoint ---
app.post('/resLoader', async (req, res) => {
    const {
        surname, name, phone, property, roomId, checkin, checkout, dailyRate,
        discountCode = '',
        correlationId
    } = req.body;

    const requestLogData = { surname, name, phone, property, roomId, checkin, checkout, dailyRate, discountCode, correlationId, ip: req.ip };
    logger.info('Processing reservation request', requestLogData);

    // --- Validation ---
    const requiredFields = ['surname', 'name', 'phone', 'property', 'roomId', 'checkin', 'checkout', 'dailyRate', 'correlationId'];
    const missingFields = requiredFields.filter(field => !req.body[field] || String(req.body[field]).trim() === '');
    if (missingFields.length > 0) {
        logger.warn('Missing required fields', { missingFields, requestData: requestLogData });
        return res.status(400).json({ error: 'Missing required fields', details: `Please provide: ${missingFields.join(', ')}` });
    }
    if (!validateDateFormat(checkin) || !validateDateFormat(checkout)) {
        logger.warn('Invalid date format', { checkin, checkout, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid date format', details: 'Dates must be in DD.MM.YYYY format.' });
    }
    try {
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
    } catch (dateCompareError) {
         logger.error('Error comparing dates', { checkin, checkout, error: dateCompareError.message, requestData: requestLogData });
         return res.status(400).json({ error: 'Invalid date values', details: 'Could not compare provided dates.' });
    }
    const roomIdRegex = /^(?:(?:[A-Z]{4}-\d{1,4})|(?:[A-Z]{3}-[A-Z0-9]{1,8})|(?:[A-Z]{1,2}[A-Z0-9]{3,4}[A-Z]{3,5}-\d{1})|(?:[A-Z]{3}-\d{1}-[A-Z]{5})|(?:[A-Z]\d{3}[A-Z]{5}\d))$/;
    if (!roomIdRegex.test(roomId)) {
        logger.warn('Invalid roomId format', { roomId, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid room ID format', details: 'Room ID format is not recognized.' });
    }
    const parsedRate = parseFloat(dailyRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
        logger.warn('Invalid daily rate', { dailyRate, requestData: requestLogData });
        return res.status(400).json({ error: 'Invalid daily rate', details: 'Daily rate must be a positive number.' });
    }
    // --- End Validation ---

    // --- Sanitize Inputs ---
    const sanitizedInputs = {
        surname: String(surname).replace(/[^a-zA-Z\s'-]/g, ''),
        name: String(name).replace(/[^a-zA-Z\s'-]/g, ''),
        phone: String(phone).replace(/[^0-9+\-()\s]/g, ''),
        property: String(property).replace(/[^a-zA-Z0-9\s-]/g, ''),
        roomId: String(roomId).replace(/[^A-Z0-9-]/g, ''),
        checkin: checkin,
        checkout: checkout,
        dailyRate: parsedRate.toFixed(2),
        discountCode: String(discountCode).replace(/[^a-zA-Z0-9_-]/g, '')
    };
    // --- End Sanitization ---

    // --- Setup SSE Response ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Note: flushHeaders() is called AFTER the first message is written.

    const sendSse = (data) => {
        if (res.writableEnded) {
            logger.debug(`SSE client for ${correlationId} disconnected, skipping SSE send.`);
            return;
        }
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (sseError) {
             logger.warn(`Error writing to SSE stream for ${correlationId} (client likely disconnected)`, { error: sseError.message });
        }
    };

    // --- MODIFICATION: Send initial SSE message with bookingId (correlationId) ---
    const initialSsePayload = {
        event_type: 'initial_status', // Identify this specific event type
        status: 'pending_confirmation', // Or a more generic 'processing_started'
        message: 'Booking request received. Awaiting confirmation.',
        bookingId: correlationId // CRITICAL: Send the correlationId as bookingId
    };
    try {
        // Write the first SSE event
        res.write(`data: ${JSON.stringify(initialSsePayload)}\n\n`);
        // NOW flush headers to send this first message to the client
        res.flushHeaders();
        logger.info(`Sent initial SSE response for ${correlationId} with bookingId.`);
    } catch (initialSendError) {
        logger.error(`Failed to send initial SSE message for ${correlationId}`, { error: initialSendError.message });
        if (!res.writableEnded) {
            // Attempt to end the response gracefully if possible
            try { res.status(500).end(); } catch (e) { logger.error("Error ending response after initial SSE send fail", e); }
        }
        // No further processing if we can't send the initial crucial message
        return;
    }
    // --- End Initial SSE Message ---

    // --- Execute capture2.js ---
    const commandArgs = [
        'capture2.js',
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
    logger.info(`Spawning capture2.js for correlationId: ${correlationId}`, { args: commandArgs.slice(1) });

    const childProcess = spawn('node', commandArgs, { encoding: 'utf8' });
    let stdoutData = '';
    let stderrData = '';

    childProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        stderrData += message + '\n';
        logger.debug(`capture2.js [stderr] for ${correlationId}: ${message}`);
        sendSse({ event_type: 'script_stderr', status: 'progress', detail: message });
    });

    childProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        stdoutData += message;
        logger.debug(`capture2.js [stdout] for ${correlationId}: ${message}`);
    });

    childProcess.on('error', (error) => {
        const errorMsg = `Failed to start capture process: ${error.message}`;
        logger.error(`Failed to spawn capture2.js for ${correlationId}`, { error: error.message, stack: error.stack });
        sendCallback(correlationId, 'error', { errorMessage: errorMsg });
        if (!res.writableEnded) {
            sendSse({ event_type: 'script_spawn_error', status: 'error', message: errorMsg });
            res.end();
        }
    });

    childProcess.on('close', (code) => {
        logger.info(`capture2.js process finished for ${correlationId}`, { exitCode: code });
        const confirmationNumber = stdoutData.trim();

        if (code === 0 && /^\d{9}$/.test(confirmationNumber) && confirmationNumber.startsWith('4')) {
            logger.info(`Successfully obtained confirmation for ${correlationId}: ${confirmationNumber}. Triggering SUCCESS callback.`);
            sendCallback(correlationId, 'complete', { confirmationNumber: confirmationNumber });
            if (!res.writableEnded) {
                 sendSse({ event_type: 'capture_success', status: 'final_progress', message: 'Capture script completed successfully.' });
            }
        } else {
            const errorMessage = `Capture script failed (Exit Code: ${code}). Confirmation invalid or missing. Check logs. Stdout: [${stdoutData.substring(0,100)}...] Stderr: [${stderrData.trim().substring(0,200)}...]`;
            logger.error(`Reservation capture failed for ${correlationId}`, { exitCode: code, confirmationAttempt: confirmationNumber, stdoutSnippet: stdoutData.substring(0,100), stderrSnippet: stderrData.trim().substring(0,200) });
            sendCallback(correlationId, 'error', { errorMessage: errorMessage });
            if (!res.writableEnded) {
                sendSse({ event_type: 'capture_failure', status: 'final_error', message: 'Capture script failed. See server logs for details.' });
            }
        }
        if (!res.writableEnded) {
            res.end();
        }
    });

    req.on('close', () => {
        if (childProcess.exitCode === null && !childProcess.killed) {
            logger.warn(`Client closed connection prematurely for ${correlationId}. Terminating capture process.`);
            childProcess.kill('SIGTERM');
        } else {
            logger.info(`Client connection closed for ${correlationId} (process already ended or killed).`);
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

// --- Global Error Handler ---
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
        try { res.end(); } catch (e) { logger.error("Error ending response in global error handler", e); }
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