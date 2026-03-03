// ical-firestore-sync.js
const axios = require('axios');
const ical = require('node-ical');
const puppeteer = require('puppeteer');
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
    },
    airbnbCredentials: {
      email: 'jatroskie@gmail.com',
      password: 'your-password' // Consider using environment variables for credentials
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

// Function to scrape additional guest information from Airbnb
async function scrapeAirbnbGuestInfo(reservationId, credentials) {
  if (!reservationId) return null;
  
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    
    // Login to Airbnb
    await page.goto('https://www.airbnb.com/login');
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', credentials.email);
    await page.type('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to reservation details
    const reservationUrl = `https://www.airbnb.com/hosting/reservations/details/${reservationId}`;
    await page.goto(reservationUrl);
    
    // Wait for the page to load the guest information
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Extract guest information
    const guestInfo = await page.evaluate(() => {
      // These selectors need to be adjusted based on Airbnb's current DOM structure
      const nameElement = document.querySelector('.guest-name');
      const phoneElement = document.querySelector('.guest-phone');
      const emailElement = document.querySelector('.guest-email');
      
      return {
        fullName: nameElement ? nameElement.textContent.trim() : null,
        phoneNumber: phoneElement ? phoneElement.textContent.trim() : null,
        email: emailElement ? emailElement.textContent.trim() : null
      };
    });
    
    return guestInfo;
  } catch (error) {
    console.error(`Error scraping Airbnb guest info: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

// Process events and store in Firestore
async function processAndStoreEvents(propertyId, events, source) {
  const property = properties.find(p => p.id === propertyId);
  
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
      updated: new Date().toISOString()
    };
    
    // Extract reservation ID if it's from Airbnb
    if (source === 'airbnb') {
      const reservationId = extractAirbnbReservationId(event.description);
      if (reservationId) {
        eventData.reservationId = reservationId;
        
        // Scrape additional guest information if credentials are available
        if (property.airbnbCredentials) {
          const guestInfo = await scrapeAirbnbGuestInfo(reservationId, property.airbnbCredentials);
          if (guestInfo) {
            eventData.guestInfo = guestInfo;
          }
        }
      }
    }
    
    // Generate a unique document ID
    const docId = `${propertyId}-${source}-${event.uid}`;
    
    // Store in Firestore
    try {
      const eventRef = db.collection('reservations').doc(docId);
      const existingEvent = await eventRef.get();
      
      if (existingEvent.exists) {
        // Update existing document
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
