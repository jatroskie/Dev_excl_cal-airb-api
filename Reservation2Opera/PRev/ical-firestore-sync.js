// ical-firestore-sync.js
const axios = require('axios');
const ical = require('node-ical');
const admin = require('firebase-admin');
const cron = require('node-cron');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Configuration for properties and their iCal URLs
const properties = [
  {
    id: '27-bellair',
    name: '27 Bellair',
    icalUrls: {
      airbnb: 'https://www.airbnb.co.za/calendar/ical/1099848746094296878.ics?s=2f8f7434b3affe7d4b025bfd68b2e7ec',
      booking: 'https://ical.booking.com/v1/export?t=b3d9b114-2433-4032-be38-7d01a41a15fd'
    }
  }
  // Add more properties as needed
];

// Function to fetch and parse iCal feeds
async function fetchIcalEvents(icalUrl) {
  try {
    const response = await axios.get(icalUrl);
    const events = await ical.async.parseICS(response.data);
    return events;
  } catch (error) {
    console.error(`Error fetching iCal feed: ${error.message}`);
    return {};
  }
}

// Extract reservation ID from Airbnb URL
function extractAirbnbReservationId(url) {
  if (!url) return null;
  const matches = url.match(/reservations\/details\/([A-Z0-9]+)/);
  return matches ? matches[1] : null;
}

// Extract phone number from description (if available)
function extractPhoneLastDigits(description) {
  if (!description) return null;
  const matches = description.match(/Phone Number \(Last 4 Digits\): (\d+)/);
  return matches ? matches[1] : null;
}

// Process events and store in Firestore
async function processAndStoreEvents(propertyId, events, source) {
  for (const key in events) {
    const event = events[key];
    
    // Skip non-VEVENT items
    if (event.type !== 'VEVENT') continue;
    
    // Extract basic event information
    const eventData = {
      propertyId,
      source,
      summary: event.summary,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      description: event.description || '',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      needsGuestInfo: true // Flag to indicate guest info needs to be collected
    };
    
    // Extract basic information from iCal data
    if (source === 'airbnb') {
      // Extract reservation ID if available
      const reservationId = extractAirbnbReservationId(event.description);
      if (reservationId) {
        eventData.reservationId = reservationId;
        eventData.reservationUrl = `https://www.airbnb.com/hosting/reservations/details/${reservationId}`;
      }
      
      // Extract basic contact info if available in the description
      const phoneLastDigits = extractPhoneLastDigits(event.description);
      if (phoneLastDigits) {
        eventData.partialPhone = phoneLastDigits;
      }
      
      // Create a basic guestInfo object with placeholder values
      eventData.guestInfo = {
        fullName: 'Not available yet',
        phoneNumber: phoneLastDigits ? `xxxx-xxxx-${phoneLastDigits}` : 'Not available',
        email: 'Not available yet',
        source: 'iCal description'
      };
    }
    
    // Generate a unique document ID
    const docId = `${propertyId}-${source}-${event.uid}`;
    
    // Store in Firestore
    try {
      const eventRef = db.collection('reservations').doc(docId);
      const existingEvent = await eventRef.get();
      
      if (existingEvent.exists) {
        // Update existing document while preserving any guest info that might have been added manually
        const existingData = existingEvent.data();
        
        // Don't overwrite guest info if it was already collected
        if (existingData.guestInfo && !existingData.needsGuestInfo) {
          delete eventData.guestInfo;
          delete eventData.needsGuestInfo;
        }
        
        await eventRef.update({
          ...eventData,
          updated: new Date().toISOString()
        });
        console.log(`Updated reservation: ${docId}`);
      } else {
        // Create new document
        await eventRef.set(eventData);
        console.log(`Created new reservation: ${docId}`);
      }
    } catch (error) {
      console.error(`Error storing reservation in Firestore: ${error.message}`);
    }
  }
}

// Main synchronization function
async function syncCalendars() {
  console.log('Starting calendar synchronization...');
  
  for (const property of properties) {
    // Process Airbnb events
    const airbnbEvents = await fetchIcalEvents(property.icalUrls.airbnb);
    await processAndStoreEvents(property.id, airbnbEvents, 'airbnb');
    
    // Process Booking.com events
    const bookingEvents = await fetchIcalEvents(property.icalUrls.booking);
    await processAndStoreEvents(property.id, bookingEvents, 'booking');
  }
  
  console.log('Calendar synchronization completed.');
}

// Run synchronization once at startup
syncCalendars();

// Schedule regular synchronization (every hour)
cron.schedule('0 * * * *', () => {
  syncCalendars();
});

// Export functions for external use (e.g., Cloud Functions)
module.exports = {
  syncCalendars,
  processAndStoreEvents,
  fetchIcalEvents
};
