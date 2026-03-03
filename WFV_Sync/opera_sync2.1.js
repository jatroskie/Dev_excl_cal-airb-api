// --- START OF MODIFIED opera-sync2.0.js ---

// opera-sync.js - Uploads opera_data.json to a Firebase Cloud Function endpoint for processing.
// IMPORTANT: This script ONLY sends the raw JSON data.
//            The actual Firestore writing logic MUST reside in the '/upload' Cloud Function.
//
// Requires: Node.js, `npm install axios`, `opera_data.json`, active Cloud Function endpoint.
// Usage: node opera-sync2.0.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
// const { exec } = require('child_process'); // No longer needed for exec

// --- Configuration ---
const config = {
  operaDataPath: path.join(__dirname, 'opera_data.json'),
  // *** Ensure this URL is correct for your /upload endpoint ***
  firebaseApiUrl: 'https://api-yzrm33bhsq-uc.a.run.app/upload',

  // --- Removed Static iCal Config ---
  // iCalMetadataPath: path.join(__dirname, 'ical-metadata.json'),
  // iCalGeneratorScript: 'generate-static-icals1.0.js'
};

// --- Function Definitions ---

// Function to read Opera data (Keep as is)
function readOperaData() {
  try {
    if (!fs.existsSync(config.operaDataPath)) throw new Error(`Opera data file not found: ${config.operaDataPath}`);
    const data = fs.readFileSync(config.operaDataPath, 'utf8');
    console.log(`Read ${Buffer.byteLength(data, 'utf8')} bytes from ${config.operaDataPath}`);
    return JSON.parse(data);
  } catch (error) { console.error('Error reading Opera data:', error.message); if (error instanceof SyntaxError) console.error('JSON Detail:', error); throw error; }
}

// Function to upload Opera data (Keep as is)
async function uploadOperaData() {
  let operaData;
  try {
    operaData = readOperaData(); console.log('Successfully parsed Opera data.');
    if (!operaData || typeof operaData !== 'object' || (!operaData.resources && !operaData.events)) throw new Error('Parsed data missing resources or events.');
    console.log(`Found ${operaData.resources?.length || 0} resources and ${operaData.events?.length || 0} events.`);
  } catch (readError) { return false; }

  try {
      console.log(`Uploading data to Firebase endpoint: ${config.firebaseApiUrl}...`);
      const response = await axios.post(config.firebaseApiUrl, operaData, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
      console.log('Upload successful. Response:', response.data);
      if (response.data?.status === 'error') { console.error('Cloud Function reported error:', response.data.message || 'Unknown'); return false; }
      return true;
  } catch (error) {
    console.error('Error during Axios POST to Cloud Function:');
    if (error.response) { console.error('Status:', error.response.status); console.error('Data:', JSON.stringify(error.response.data, null, 2)); }
    else if (error.request) { console.error('No response:', error.code); }
    else { console.error('Axios setup Error:', error.message); }
    console.error(`--- Check Cloud Function at ${config.firebaseApiUrl} is running & check its logs. ---`);
    return false;
  }
}

// --- Removed Static iCal/Hosting Functions ---
/*
function generateStaticIcals() { ... }
function deployStaticFiles() { ... }
*/

// --- Main Process (Simplified) ---
async function mainSyncProcess() {
  console.log("Starting Opera data sync process...");

  try {
    // --- Step 1 (Previously iCal Gen): Now Removed ---
    // console.log("\n--- Skipping iCal Generation ---");

    // --- Step 2: Upload Core Opera Data ---
    console.log("\n--- Uploading Opera Data to Cloud Function ---");
    const uploadSuccess = await uploadOperaData();

    if (!uploadSuccess) {
      console.error('Failed to upload Opera data. Aborting sync process.');
      process.exitCode = 1;
      return;
    }
    console.log("Opera data successfully sent to the Cloud Function for processing.");

    // --- Step 3 (Previously Static Deploy): Now Removed ---
    // console.log("\n--- Skipping Static File Deployment ---");

    console.log('\nOpera sync process completed successfully.');

  } catch (error) {
    // Catch errors primarily from uploadOperaData if it throws unexpectedly
    console.error('\n--- Sync process failed ---');
    console.error('An unhandled error occurred during the sync process:', error);
    process.exitCode = 1;
  }
}

// --- Run the main process ---
mainSyncProcess();

// --- END OF MODIFIED opera-sync2.0.js ---