// src/config.js

// -- Configuration for API Endpoints --

// 1. Determine Base URL for Cloud Functions
// If running locally (localhost), point to the Firebase Emulator.
// If running in production (deployed), point to the live Cloud Functions URL.

const PROJECT_ID = 'cal-airb-api'; // YOUR FIREBASE PROJECT ID
const REGION = 'us-central1';      // YOUR CLOUD FUNCTIONS REGION

const FUNCTIONS_BASE_URL = window.location.hostname === 'localhost'
    ? `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`
    : `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

// 2. Define Specific Endpoint URLs
const SET_COVER_FUNCTION_URL = `${FUNCTIONS_BASE_URL}/setCoverImageAndGenerateThumbnail`;
const UPLOAD_IMAGE_FUNCTION_URL = `${FUNCTIONS_BASE_URL}/uploadPropertyImage`;
const DELETE_IMAGE_FUNCTION_URL = `${FUNCTIONS_BASE_URL}/deletePropertyImage`;
const GENERATE_LISTING_CONTENT_URL = `${FUNCTIONS_BASE_URL}/generateListingContent`; // New AI Endpoint
const ROTATE_IMAGE_FUNCTION_URL = `${FUNCTIONS_BASE_URL}/rotateImage`;
const UPDATE_PROPERTY_DETAILS_URL = `${FUNCTIONS_BASE_URL}/updatePropertyDetails`;

// 3. Operational API (Cloud Run or similar) - kept as is/configured separately if needed
const API_BASE_URL = 'https://api-yzrm33bhsq-uc.a.run.app';

export {
    API_BASE_URL,
    FUNCTIONS_BASE_URL,
    SET_COVER_FUNCTION_URL,
    UPLOAD_IMAGE_FUNCTION_URL,
    DELETE_IMAGE_FUNCTION_URL,
    GENERATE_LISTING_CONTENT_URL,
    ROTATE_IMAGE_FUNCTION_URL,
    UPDATE_PROPERTY_DETAILS_URL
};