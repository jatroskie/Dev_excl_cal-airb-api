// scheduler2.js - Automated sync scheduler

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // execSync not typically needed for async flow
const axios = require('axios');
const admin = require('firebase-admin');
const { format, subDays, addDays } = require('date-fns');

// Configuration
const CONFIG = {
  fcRoomDiaryPath: process.env.FC_ROOM_DIARY_PATH || '.',
  calAirbApiPath: process.env.CAL_AIRB_API_PATH || '.',
  apiBaseUrl: process.env.API_BASE_URL || 'https://api-yzrm33bhsq-uc.a.run.app',
  startDate: process.env.START_DATE || '', // Format: DD.MM.YYYY (for Opera extraction)
  endDate: process.env.END_DATE || '',     // Format: DD.MM.YYYY (for Opera extraction)
  logFile: process.env.LOG_FILE || './scheduler-log.txt',
  auditLogDir: process.env.AUDIT_LOG_DIR || './audit_reports',

  // Configuration for Daily Room State Update (formerly TBA Update)
  dailyStateUpdateCloudFunctionUrl: process.env.DAILY_STATE_UPDATE_CF_URL || 'https://api-yzrm33bhsq-uc.a.run.app/updateDailyRoomStates',
  dailyStateUpdatePropertyId: process.env.DAILY_STATE_UPDATE_PROPERTY_ID || 'TBA', // Default property
  dailyStateUpdateTimeoutMs: parseInt(process.env.DAILY_STATE_UPDATE_TIMEOUT_MS || '600000', 10), // 10 minutes
  dailyStateUpdateDefaultMode: process.env.DAILY_STATE_DEFAULT_MODE || 'targeted', // 'targeted' or 'fullRefresh'
  dailyStateTargetedLookbackHours: parseInt(process.env.DAILY_STATE_TARGETED_LOOKBACK_HOURS || '2', 10),
  dailyStateEnableDetailedLogging: process.env.DAILY_STATE_DETAILED_LOGGING === 'true' || false,
};

// Initialize Firebase Admin
const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || './service-account-key.json';
if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error(`Error initializing Firebase Admin: ${e.message}`);
    console.warn('Firebase logging disabled.');
  }
} else {
  console.warn(`Service account file not found at ${serviceAccountPath}. Firebase logging disabled.`);
}

// Helper function to log messages
function log(message, error = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (error) console.error(logMessage);
  else console.log(logMessage);
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  } catch (fileError) {
    console.error(`Failed to write to main log file ${CONFIG.logFile}: ${fileError.message}`);
  }
  if (admin.apps.length > 0 && !message.startsWith('Error logging to Firebase')) {
    admin.firestore().collection('syncLogs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: message.substring(0, 1000), success: !error,
      error: error ? message.substring(0, 1000) : null,
      manual: false, source: 'scheduler2.js'
    }).catch(err => console.error('Error logging to Firebase:', err));
  }
}

// Function to calculate date range for Opera extraction
function getOperaDateRange() {
  if (CONFIG.startDate && CONFIG.endDate) {
    log(`Using provided Opera date range: ${CONFIG.startDate} to ${CONFIG.endDate}`);
    return { startDate: CONFIG.startDate, endDate: CONFIG.endDate };
  }
  const today = new Date();
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 7);
  const oneYearLater = new Date(); oneYearLater.setFullYear(today.getFullYear() + 1);
  const formatDateOriginal = (date) => [String(date.getDate()).padStart(2, '0'), String(date.getMonth() + 1).padStart(2, '0'), date.getFullYear()].join('.');
  const calculatedStartDate = formatDateOriginal(sevenDaysAgo);
  const calculatedEndDate = formatDateOriginal(oneYearLater);
  log(`Using default Opera date range: ${calculatedStartDate} to ${calculatedEndDate}`);
  return { startDate: calculatedStartDate, endDate: calculatedEndDate };
}

function getTimestampedFilename(prefix = 'log', extension = 'txt') {
    const now = new Date();
    return `${prefix}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.${extension}`;
}

// Step 1: Extract data from Opera
async function extractDataFromOpera() {
  return new Promise((resolve, reject) => {
    log('Starting Opera data extraction...');
    const { startDate, endDate } = getOperaDateRange();
    const command = `node app5.js --extractReservations --downloadCsv --startDate=${startDate} --endDate=${endDate}`;
    const options = { cwd: CONFIG.fcRoomDiaryPath };
    log(`Executing: ${command} in ${CONFIG.fcRoomDiaryPath}`);
    exec(command, options, (error, stdout, stderr) => {
      if (error) { log(`Error during Opera data extraction: ${error.message}`, true); return reject(error); }
      if (stderr) log(`Opera extraction stderr: ${stderr}`);
      log(`Opera extraction stdout: ${stdout}`);
      log('Opera data extraction completed.');
      resolve();
    });
  });
}

// Step 2: Process CSV files
async function processCSVFiles() {
  return new Promise((resolve, reject) => {
    log('Starting CSV processing...');
    const command = `node process-csv-final5.js`;
    const options = { cwd: CONFIG.fcRoomDiaryPath };
    log(`Executing: ${command} in ${CONFIG.fcRoomDiaryPath}`);
    exec(command, options, (error, stdout, stderr) => {
      if (error) { log(`Error during CSV processing: ${error.message}`, true); return reject(error); }
      if (stderr) log(`CSV processing stderr: ${stderr}`);
      log(`CSV processing stdout: ${stdout}`);
      const sourceFile = path.join(CONFIG.fcRoomDiaryPath, 'calendar-data.json');
      const destFile = path.join(CONFIG.calAirbApiPath, 'opera_data.json');
      try {
        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, destFile); log(`Copied ${sourceFile} to ${destFile}`);
        } else {
          log(`ERROR: calendar-data.json not found at ${sourceFile}.`, true);
          return reject(new Error('CSV output file not found.'));
        }
      } catch (copyError) {
        log(`Error copying ${sourceFile} to ${destFile}: ${copyError.message}`, true);
        return reject(copyError);
      }
      log('CSV processing completed.');
      resolve();
    });
  });
}

// Step 3: Sync with Firebase (opera-sync.js)
async function syncWithFirebase() {
  return new Promise((resolve, reject) => {
    log('Starting Firebase sync (opera_sync2.1.js)...');
    const command = `node opera_sync2.1.js`;
    const options = { cwd: CONFIG.calAirbApiPath };
    log(`Executing: ${command} in ${CONFIG.calAirbApiPath}`);
    exec(command, options, (error, stdout, stderr) => {
      if (error) { log(`Error during Firebase sync: ${error.message}`, true); return reject(error); }
      if (stderr) log(`Firebase sync stderr: ${stderr}`);
      log(`Firebase sync stdout: ${stdout}`);
      log('Firebase sync (opera-sync2.1.js) completed.');
      resolve();
    });
  });
}

// Step 4: Trigger Daily Room State Recalculation in Cloud Function
async function triggerDailyStateRecalculation(mode = CONFIG.dailyStateUpdateDefaultMode) {
  log(`Starting Daily Room State Recalculation (Mode: ${mode})...`);

  if (!CONFIG.dailyStateUpdateCloudFunctionUrl || CONFIG.dailyStateUpdateCloudFunctionUrl.includes('<PROJECT_ID>')) {
    const errMsg = `Daily State Update Cloud Function URL is not configured or is a placeholder: ${CONFIG.dailyStateUpdateCloudFunctionUrl}`;
    log(errMsg, true); return Promise.reject(new Error(errMsg));
  }
  if (!CONFIG.dailyStateUpdatePropertyId) {
    const errMsg = `Daily State Update Property ID is not configured.`;
    log(errMsg, true); return Promise.reject(new Error(errMsg));
  }

  const payload = {
    propertyId: CONFIG.dailyStateUpdatePropertyId,
    mode: mode,
    enableDetailedLogging: CONFIG.dailyStateEnableDetailedLogging
  };

  if (mode === 'targeted') {
    payload.lookbackWindowHours = CONFIG.dailyStateTargetedLookbackHours;
  }
  // For 'fullRefresh', startDate and endDate for the refresh can be added to payload if needed,
  // otherwise roomStates.js uses its defaults (e.g., today to +365 days)

  log(`Payload for Daily State Recalculation: ${JSON.stringify(payload)}`);
  log(`Target Function URL: ${CONFIG.dailyStateUpdateCloudFunctionUrl}`);

  try {
    log(`Sending request to Daily State Update Cloud Function (client timeout: ${CONFIG.dailyStateUpdateTimeoutMs / 1000}s)...`);
    const response = await axios.post(CONFIG.dailyStateUpdateCloudFunctionUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: CONFIG.dailyStateUpdateTimeoutMs
    });
    log(`Daily State Recalculation request successful! Status: ${response.status}`);
    if (response.data) log(`Response data: ${JSON.stringify(response.data)}`);
    else log("No data returned in response body (may be expected).");
    return Promise.resolve();
  } catch (error) {
    let errorMsg = `ERROR: Failed to trigger Daily State Update CF.`;
    if (error.response) errorMsg += ` Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
    else if (error.request) errorMsg += ` No response received. Request data: ${JSON.stringify(payload)}`;
    else errorMsg += ` Error setting up request: ${error.message}`;
    log(errorMsg, true);
    if (error.code === 'ECONNABORTED') {
        log(`Client-side timeout of ${CONFIG.dailyStateUpdateTimeoutMs / 1000}s reached. Check Cloud Function logs.`, true);
    }
    return Promise.reject(error);
  }
}

// Step 5: Run Detailed Audit Script
async function runAudit() {
  return new Promise((resolve, reject) => {
    log('Starting post-sync audit (detailed_audit.js)...');
    const operaDataForAudit = path.join(CONFIG.calAirbApiPath, 'opera_data.json');
    if (!fs.existsSync(operaDataForAudit)) {
      const errMsg = `Audit failed: opera_data.json not found in ${CONFIG.calAirbApiPath}`;
      log(errMsg, true); return reject(new Error(errMsg));
    }
    // Service key check (optional, if audit script needs it and firebase not init globally)

    const command = `node detailed_audit_reservations.js`;
    const options = { cwd: CONFIG.calAirbApiPath };
    log(`Executing: ${command} in ${CONFIG.calAirbApiPath}`);
    exec(command, options, (error, stdout, stderr) => {
      const combinedOutput = `--- STDOUT ---\n${stdout}\n\n--- STDERR ---\n${stderr}`;
      const auditLogFilename = getTimestampedFilename('detailed_audit_output', 'log');
      const auditLogFilePath = path.join(CONFIG.auditLogDir, auditLogFilename);
      try {
        fs.writeFileSync(auditLogFilePath, combinedOutput);
        log(`Detailed audit console output saved to: ${auditLogFilePath}`);
      } catch (fileError) {
        log(`Error writing detailed audit console log: ${fileError.message}`, true);
      }
      if (stdout) log(`Audit script summary:\n---\n${stdout.trim()}\n---`);
      if (stderr && !error) log(`Audit script stderr (warnings/info):\n---\n${stderr.trim()}\n---`);
      if (error) {
        log(`Error during detailed audit: ${error.message}`, true);
        log(`Audit script failed output:\n${combinedOutput}`, true);
        return reject(error);
      }
      log('Detailed audit script completed.');
      resolve(true);
    });
  });
}

// Step 6: Verify the sync by checking API (Optional)
async function verifySyncViaApi() {
  try {
    log('Verifying sync via API...');
    const response = await axios.get(`${CONFIG.apiBaseUrl}/api/syncStatus`); // Example endpoint
    if (response.data && response.data.timestamp) {
      const lastSyncTime = new Date(response.data.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSyncTime > oneHourAgo) {
        log(`API Sync verification successful. Last sync: ${response.data.timestamp}`); return true;
      } else {
        log(`API Sync verification warning: Last sync (${response.data.timestamp}) seems old.`, false); return true; // Still resolve true but log warning
      }
    } else {
      log(`API Sync verification failed or unexpected format. Response: ${JSON.stringify(response.data)}`, true); return false;
    }
  } catch (error) {
    let errorMsg = `Error verifying sync via API: ${error.message}`;
    if (error.response) errorMsg += ` | Status: ${error.response.status} | Data: ${JSON.stringify(error.response.data)}`;
    log(errorMsg, true); return false;
  }
}

// Main function to run all steps
async function runFullSync() {
  log('Starting full sync process...');
  let overallSuccess = true;

  try {
    await extractDataFromOpera();
    await processCSVFiles();
    await syncWithFirebase();
    // For a full sync, we might run a 'targeted' update.
    // A 'fullRefresh' could be a separate, less frequent cron job.
    await triggerDailyStateRecalculation('targeted'); // Or 'fullRefresh' if preferred for runFullSync

    try {
      await runAudit();
      log('Audit step completed.');
    } catch (auditError) {
      log(`Audit step failed: ${auditError.message}`, true);
      overallSuccess = false;
    }

    // Optional: API verification step
    // const verified = await verifySyncViaApi();
    // if (!verified) overallSuccess = false;

  } catch (error) { // Catches errors from steps 1, 2, 3, or daily state trigger
    log(`Full sync process FAILED critically: ${error.message}`, true);
    overallSuccess = false;
    process.exitCode = 1; // Indicate failure
  } finally {
    log('--- FINAL SYNC STATUS ---');
    if (overallSuccess) {
      log('Full sync process completed (some steps may have warnings). Check audit report.');
    } else {
      log('Full sync process encountered CRITICAL ERRORS or failed verification/audit. Check logs and audit report.', true);
    }
    log('-------------------------');
  }
}

// Command line interface
function handleCommandLine() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Opera to Airbnb iCal Sync Scheduler

Usage:
  node scheduler2.js [options]

General Options:
  --run-now                     Run the full sync process (extract, process, sync, targeted daily state update, audit).
  --start-date=DD.MM.YYYY       Set start date for Opera extraction.
  --end-date=DD.MM.YYYY         Set end date for Opera extraction.
  --help, -h                    Show this help message.

Individual Step Options:
  --extract-only                Only extract data from Opera.
  --process-only                Only process CSV files.
  --sync-only                   Only sync with Firebase (opera_sync2.1.js).
  --audit-only                  Only run the post-sync detailed audit.
  --verify-api-only             Only verify sync status via API.

Daily Room State Update Options:
  --daily-state-targeted        Trigger a 'targeted' daily room state update.
  --daily-state-full-refresh    Trigger a 'fullRefresh' daily room state update.
  --daily-state-prop-id=<ID>    Set property ID for daily state update (overrides default).
  --daily-state-detailed-log    Enable detailed logging for daily state update CF call.

    `);
    return;
  }

  // Parse global date args for Opera extraction
  args.forEach(arg => {
    if (arg.startsWith('--start-date=')) CONFIG.startDate = arg.replace('--start-date=', '');
    else if (arg.startsWith('--end-date=')) CONFIG.endDate = arg.replace('--end-date=', '');
  });

  // Parse daily state specific args
  args.forEach(arg => {
    if (arg.startsWith('--daily-state-prop-id=')) CONFIG.dailyStateUpdatePropertyId = arg.replace('--daily-state-prop-id=', '');
    if (arg === '--daily-state-detailed-log') CONFIG.dailyStateEnableDetailedLogging = true;
  });


  // Handle commands
  if (args.includes('--extract-only')) {
    extractDataFromOpera().catch(err => { log(`Extract failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--process-only')) {
    processCSVFiles().catch(err => { log(`Processing failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--sync-only')) {
    syncWithFirebase().catch(err => { log(`Sync failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--daily-state-targeted')) {
    triggerDailyStateRecalculation('targeted').catch(err => { log(`Targeted Daily State Update failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--daily-state-full-refresh')) {
    triggerDailyStateRecalculation('fullRefresh').catch(err => { log(`Full Refresh Daily State Update failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--audit-only')) {
    runAudit().catch(err => { log(`Audit failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--verify-api-only')) {
    verifySyncViaApi().then(result => { if (!result) process.exitCode = 1; }).catch(err => { log(`API Verification failed: ${err.message}`, true); process.exitCode = 1; });
  } else if (args.includes('--run-now') || args.length === 0) { // Default action
    runFullSync();
  } else {
      log(`Unknown command or combination of arguments. Use --help for options. Args received: ${args.join(' ')}`, true);
      process.exitCode = 1;
  }
}

// Initialize and run
function init() {
  try {
    if (!fs.existsSync(path.dirname(CONFIG.logFile))) fs.mkdirSync(path.dirname(CONFIG.logFile), { recursive: true });
    if (!fs.existsSync(CONFIG.auditLogDir)) fs.mkdirSync(CONFIG.auditLogDir, { recursive: true });
  } catch (dirError) {
    console.error(`Error creating log directories: ${dirError.message}`);
  }
  if (!fs.existsSync(CONFIG.logFile)) {
    try { fs.writeFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Scheduler Initialized\n`); }
    catch (fileError) { console.error(`Failed to create main log file ${CONFIG.logFile}: ${fileError.message}`); }
  }
  log('Scheduler2.js instance starting...');
  handleCommandLine();
}

init();

// Export functions if this were to be used as a module (optional)
module.exports = {
  extractDataFromOpera,
  processCSVFiles,
  syncWithFirebase,
  triggerDailyStateRecalculation,
  runAudit,
  verifySyncViaApi,
  runFullSync
};