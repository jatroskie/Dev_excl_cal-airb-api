// src/property-sync-handler.js
const admin = require('firebase-admin');
const ical = require('node-ical');
const axios = require('axios');

// Initialize Firebase if not already initialized
let db;
if (!admin.apps.length) {
  let serviceAccount;
  try {
    serviceAccount = require('../firebase-service-account.json');
  } catch (e) {
    // Use environment variables if JSON file is not available
    serviceAccount = {
      "type": process.env.FIREBASE_TYPE,
      "project_id": process.env.FIREBASE_PROJECT_ID,
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
      "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      "client_email": process.env.FIREBASE_CLIENT_EMAIL,
      "client_id": process.env.FIREBASE_CLIENT_ID,
      "auth_uri": process.env.FIREBASE_AUTH_URI,
      "token_uri": process.env.FIREBASE_TOKEN_URI,
      "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
    };
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  db = admin.firestore();
} else {
  db = admin.firestore();
}

// Define all properties from the fixed-resources.json document
const properties = [
  { id: 'TBA-0302', name: 'TBA 0302', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1297713377500685821.ics?s=2bb58758919cb021889cd34ae98ef5af' },
  { id: 'TBA-0303', name: 'TBA 0303', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1247731029392182354.ics?s=9b0c6e03ab2210297ba5ab3ec90dd22a' },
  { id: 'TBA-0304', name: 'TBA 0304', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1231797570482523951.ics?s=a9794695b377f7350d83c7d2cb195996' },
  // TBA-0305 - No iCal
  // TBA-0306 - No iCal
  { id: 'TBA-0307', name: 'TBA 0307', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1231301095469221059.ics?s=a8d15a54340c17c23d67ce537e5e9977' },
  // TBA-0308 - No iCal
  { id: 'TBA-0309', name: 'TBA 0309', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1229590273883233451.ics?s=714b2c07dac299d78ce0d5c739ea63b0' },
  // TBA-0311 - No iCal
  { id: 'TBA-0312', name: 'TBA 0312', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1231279072193286203.ics?s=287ac4863e3e1f46f57e48a365c128d5' },
  // TBA-0313 - No iCal
  // TBA-0314 - No iCal
  { id: 'TBA-0315', name: 'TBA 0315', type: '1-BR', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1231204448340426544.ics?s=0b15075180678b7f4477f25990715f46' },
  { id: 'TBA-0317', name: 'TBA 0317', type: '1-BR', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1212347449286873783.ics?s=9ed8f1213f87e4ac6d8d4cdad35f32c2' },
  // TBA-0318 - No iCal
  { id: 'TBA-0319', name: 'TBA 0319', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1212358372296730196.ics?s=4c1a84bb707478eb99ccefa8e64f5418' },
  // TBA-0320 - No iCal
  { id: 'TBA-0321', name: 'TBA 0321', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1221657676388110334.ics?s=b91f16ef14ad7a9bafea0e41d9c78939' },
  { id: 'TBA-0323', name: 'TBA 0323', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1221670892542894285.ics?s=a4412a8c4b354b8cf4168a80db584c6c' },
  { id: 'TBA-0400', name: 'TBA 0400', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1209304586053489362.ics?s=1e6f02ef61b5172628143028a3769a45' },
  { id: 'TBA-0401', name: 'TBA 0401', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1228303256651219056.ics?s=5d0e220d38a54ce3fb6df27fe8ce4002' },
  { id: 'TBA-0402', name: 'TBA 0402', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1228276893037734445.ics?s=daa1d92d478d2eb70388545833ae1bcd' },
  // TBA-0403 - No iCal
  // TBA-0404 - No iCal
  // TBA-0405 - No iCal
  // TBA-0406 - No iCal
  { id: 'TBA-0407', name: 'TBA 0407', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1224994790515851136.ics?s=6d5a2a29d3c96c219acb3d7bec827a39' },
  // TBA-0408 - No iCal in JSON even though URL exists
  // TBA-0409 - No iCal
  { id: 'TBA-0411', name: 'TBA 0411', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1231608210658786295.ics?s=1d6e40be7bfe32941e397554e9a4ee0e' },
  // TBA-0412 - No iCal
  { id: 'TBA-0413', name: 'TBA 0413', type: '1-BR', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1263658461196930695.ics?s=e38ca36ecfd41ee3ddecccba5a07eb65' },
  // TBA-0415 - No iCal in JSON even though URL exists
  // TBA-0416 - No iCal
  // TBA-0417 - No iCal
  // TBA-0418 - No iCal
  // TBA-0419 - No iCal
  { id: 'TBA-0420', name: 'TBA 0420', type: 'STU-URB', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1221716931721025193.ics?s=8e77b0f039b0131646b2e8bba07b7613' },
  { id: 'TBA-0501', name: 'TBA 0501', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1248669755951945227.ics?s=e197c90f042c9dae11ca3f39e30b99a3' },
  // TBA-0502 - No iCal
  // TBA-0503 - No iCal
  { id: 'TBA-0504', name: 'TBA 0504', type: 'STU-LUX', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1228322903507358655.ics?s=a9c396912f768aa93dce5a780d604656' },
  { id: 'TBA-0506', name: 'TBA 0506', type: 'STU-LUX', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1211317367250046383.ics?s=e697fbd4bf85f9e0a8583afb02c7a697' },
  { id: 'TBA-0507', name: 'TBA 0507', type: 'STU-LUX', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1228676934909732817.ics?s=456467007b241e83f2be7cd79b9627a4' },
  // TBA-0508 - No iCal
  // TBA-0509 - No iCal
  // TBA-0511 - No iCal
  { id: 'TBA-0513', name: 'TBA 0513', type: '2-BR', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1273908503357043458.ics?s=1a06935ca97d1e8b2b0dd27c957c1c17' },
  { id: 'TBA-0514', name: 'TBA 0514', type: 'STU-BALC', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1221693800160287643.ics?s=2972a50a8e4277c45de99ad553033944' },
  { id: 'TBA-0515', name: 'TBA 0515', type: '2-BR', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1212401688791962038.ics?s=a7ad362d416504edfe75243967dd35d5' },
  // TBA-0516 - No iCal
  // TBA-0517 - No iCal
  // TBA-0518 - No iCal
  // TBA-0519 - No iCal
  { id: 'TBA-0520', name: 'TBA 0520', type: 'STU-LUX', icalUrl: 'https://www.airbnb.co.za/calendar/ical/1211338228155057949.ics?s=5da0b66c3496167c283f944dbbe872e0' },
  // TBA-B514A - No iCal in JSON
  // Exclude non-TBA properties
];

// Helper function to load the property configuration from JSON file
// This is not used currently but can be helpful for future updates
async function loadPropertiesFromJson() {
  try {
    const jsonData = await window.fs.readFile('fixed-resources.json', { encoding: 'utf8' });
    const resources = JSON.parse(jsonData);
    
    // Filter properties to only include TBA properties with iCal URLs
    const filteredProperties = resources
      .filter(resource => 
        resource.extendedProps.property === 'TBA' && 
        resource.extendedProps.iCal !== null)
      .map(resource => ({
        id: resource.id,
        name: `${resource.extendedProps.property} ${resource.extendedProps.roomNumber}`,
        type: resource.extendedProps.roomType,
        icalUrl: resource.extendedProps.iCal
      }));
    
    console.log(`Loaded ${filteredProperties.length} properties from JSON file`);
    return filteredProperties;
  } catch (error) {
    console.error('Error loading properties from JSON:', error);
    return [];
  }
}

// Functions for fetching and processing iCal data
async function fetchIcalData(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching iCal data from ${url}:`, error);
    return null;
  }
}

// Function to process and store events from iCal data
async function processAndStoreEvents(property, data) {
  try {
    const events = await ical.parseICS(data);
    const reservations = [];

    for (const key in events) {
      const event = events[key];
      
      // Only process VEVENT types
      if (event.type !== 'VEVENT') continue;
      
      // Skip blocked time periods without guests
      if (event.summary && (
          event.summary.includes('Not available') || 
          event.summary.includes('Blocked') || 
          event.summary.includes('Unavailable'))) {
        continue;
      }

      console.log(`Processing event for ${property.id}: ${event.summary || 'Untitled'}`);
      
      // Extract reservation ID from description if available
      let reservationId = null;
      let reservationUrl = null;
      
      if (event.description) {
        const match = event.description.match(/confirmation_code=([A-Z0-9]+)/);
        if (match && match[1]) {
          reservationId = match[1];
          reservationUrl = `https://www.airbnb.com/hosting/reservations/details/${reservationId}`;
        }
      }
      
      // Determine the source of the reservation
      // Since we're using the Airbnb iCal URLs directly, the source is airbnb
      let source = 'airbnb';
      
      // Create reservation object
      const reservationData = {
        uid: event.uid,
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.type,
        summary: event.summary || 'Untitled',
        description: event.description || '',
        start: event.start,
        end: event.end,
        source: source,
        lastUpdated: new Date(),
        reservationId: reservationId,
        reservationUrl: reservationUrl,
        guestInfo: {} // Will be populated later by the separate scraper
      };
      
      reservations.push(reservationData);
      
      // Store in Firestore
      await db.collection('reservations').doc(event.uid).set(reservationData, { merge: true });
    }
    
    return reservations;
  } catch (error) {
    console.error(`Error processing events for ${property.id}:`, error);
    return [];
  }
}

// Main sync function
async function syncAllCalendars() {
  console.log('Starting calendar sync for all properties...');
  
  // Sync iCal data for all properties
  for (const property of properties) {
    try {
      console.log(`Fetching calendar for ${property.id}`);
      const icalData = await fetchIcalData(property.icalUrl);
      
      if (icalData) {
        await processAndStoreEvents(property, icalData);
      } else {
        console.error(`No data returned for ${property.id}`);
      }
    } catch (error) {
      console.error(`Error processing property ${property.id}:`, error);
    }
  }
  
  console.log('Calendar sync completed for all properties');
  return true;
}

// Function to start the calendar sync process
function startCalendarSync() {
  return syncAllCalendars();
}

// Export functions for use in other modules
module.exports = {
  startCalendarSync,
  syncAllCalendars,
  properties
};
