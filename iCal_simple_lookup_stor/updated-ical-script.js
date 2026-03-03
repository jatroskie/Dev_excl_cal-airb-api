// Run: node updated-ical-script.js
// Description: This script fetches iCal data for the 27Bellair property and generates availability data.
// It also updates the resources file with the correct iCal URL for the property.
// To run the script for all properties, use the `--all` flag.

const fs = require('fs');
const axios = require('axios');
const ical = require('node-ical');

// Load the fixed resources JSON file
const resources = require('./fixed-resources.json');

/**
 * Fetch iCal data and extract availability information
 * @param {string} icalUrl - URL of the iCal feed
 * @returns {Promise<Array>} - Array of booking periods with start and end dates
 */
async function fetchAvailability(icalUrl) {
  try {
    console.log(`Fetching iCal data from: ${icalUrl}`);
    
    // Fetch the iCal data
    const response = await axios.get(icalUrl);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch iCal data: HTTP ${response.status}`);
    }
    
    console.log(`Successfully fetched iCal data, content length: ${response.data.length} characters`);
    
    // Parse the iCal data
    const data = ical.parseICS(response.data);
    console.log(`Parsed iCal data, found ${Object.keys(data).length} entries`);
    
    // Extract booking periods (VEVENT items represent bookings in Airbnb)
    const bookings = [];
    let eventCount = 0;
    let unavailableCount = 0;
    
    // Log a sample of events to help with debugging
    const eventsToLog = 5;
    let loggedEvents = 0;
    
    for (const key in data) {
      const event = data[key];
      
      // Only process VEVENT entries (which represent calendar events)
      if (event.type === 'VEVENT') {
        eventCount++;
        
        // Log a sample of events to understand their structure
        if (loggedEvents < eventsToLog) {
          console.log(`\nSample Event ${loggedEvents + 1}:`);
          console.log(`  UID: ${key}`);
          console.log(`  Summary: ${event.summary || 'Not specified'}`);
          console.log(`  Status: ${event.status || 'Not specified'}`);
          console.log(`  Start: ${event.start ? event.start.toISOString() : 'Not specified'}`);
          console.log(`  End: ${event.end ? event.end.toISOString() : 'Not specified'}`);
          console.log(`  Description: ${event.description ? event.description.substring(0, 100) + '...' : 'Not specified'}`);
          loggedEvents++;
        }
        
        // In Airbnb iCal:
        // - Unavailable dates usually have "Unavailable" or similar in the summary
        // - Reserved dates might have a reservation code or "Reserved" in summary
        // - Some versions might use BUSY status or include "BUSY" in description
        const isUnavailable = 
          (event.status === 'CONFIRMED') || 
          (event.summary && (
            event.summary.includes('Unavailable') || 
            event.summary.includes('Reserved') || 
            event.summary.includes('BUSY') ||
            event.summary.includes('Not available')
          )) ||
          (event.description && event.description.includes('BUSY'));
        
        if (isUnavailable && event.start && event.end) {
          unavailableCount++;
          
          bookings.push({
            start: event.start.toISOString().split('T')[0], // Get YYYY-MM-DD format
            end: event.end.toISOString().split('T')[0],     // Get YYYY-MM-DD format
            summary: event.summary || 'Booked'
          });
        }
      }
    }
    
    console.log(`Total events found: ${eventCount}`);
    console.log(`Unavailable/booked periods identified: ${unavailableCount}`);
    
    if (bookings.length === 0 && eventCount > 0) {
      console.log('WARNING: Events were found but no bookings were identified. Check the event detection criteria.');
    }
    
    return bookings;
  } catch (error) {
    console.error(`Error fetching or parsing iCal data: ${error.message}`);
    throw error; // Re-throw to handle in the calling function
  }
}

/**
 * Generate availability calendar for the next 6 months
 * @param {Array} bookings - Array of booking periods
 * @returns {Object} - Availability calendar with dates marked as available or booked
 */
function generateAvailabilityCalendar(bookings) {
  // Create a 6-month calendar from today
  const calendar = {};
  const today = new Date();
  const endDate = new Date();
  endDate.setMonth(today.getMonth() + 6); // 6 months from now
  
  // Initialize all days as available
  for (let d = new Date(today); d < endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
    calendar[dateStr] = {
      date: dateStr,
      available: true,
      booking: null
    };
  }
  
  // Mark booked dates
  bookings.forEach(booking => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    
    // Mark all days between start and end (exclusive of end date, which is checkout)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Only update if the date is in our calendar range
      if (calendar[dateStr]) {
        calendar[dateStr].available = false;
        calendar[dateStr].booking = {
          checkIn: booking.start === dateStr,
          checkOut: false, // We don't mark checkout dates as unavailable
          summary: booking.summary
        };
      }
    }
    
    // Mark checkout date (available for new bookings but has checkout info)
    const checkoutStr = end.toISOString().split('T')[0];
    if (calendar[checkoutStr]) {
      calendar[checkoutStr].booking = {
        ...(calendar[checkoutStr].booking || {}),
        checkOut: true
      };
    }
  });
  
  return calendar;
}

/**
 * Main function to process the 27Bellair property and generate availability data
 */
async function main() {
  try {
    // Find the 27Bellair property
    const property = resources.find(r => r.id === "27Bellair");
    
    if (!property) {
      throw new Error('Property 27Bellair not found in the resources file');
    }
    
    console.log(`Processing property: ${property.id} - ${property.title}`);
    
    // IMPORTANT: Use the correct iCal URL, not the one from resources
    // This is the correct URL provided by the user
    const correctIcalUrl = "https://www.airbnb.co.za/calendar/ical/1099848746094296878.ics?s=2f8f7434b3affe7d4b025bfd68b2e7ec";
    
    console.log(`Original iCal URL in resources: ${property.extendedProps.iCal}`);
    console.log(`Using corrected iCal URL: ${correctIcalUrl}`);
    
    // Fetch availability for the property using the corrected URL
    const bookings = await fetchAvailability(correctIcalUrl);
    console.log(`Found ${bookings.length} booking periods for ${property.id}`);
    
    // Generate availability calendar
    const calendar = generateAvailabilityCalendar(bookings);
    
    // Create the result object
    const result = {
      property: {
        id: property.id,
        title: property.title,
        roomNumber: property.extendedProps.roomNumber,
        roomType: property.extendedProps.roomType,
        url: property.extendedProps.url
      },
      lastUpdated: new Date().toISOString(),
      bookings: bookings,
      availability: calendar
    };
    
    // Save to JSON file
    fs.writeFileSync(
      `${property.id}-availability.json`, 
      JSON.stringify(result, null, 2)
    );
    
    console.log(`Availability data for ${property.id} has been saved to ${property.id}-availability.json`);
    
    // Also update the resources file with the correct URL
    const updatedResources = resources.map(r => {
      if (r.id === "27Bellair") {
        return {
          ...r,
          extendedProps: {
            ...r.extendedProps,
            iCal: correctIcalUrl
          }
        };
      }
      return r;
    });
    
    fs.writeFileSync(
      'updated-resources.json',
      JSON.stringify(updatedResources, null, 2)
    );
    
    console.log('Resources file has been updated with the correct iCal URL');
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Process all resources with iCal links
 */
async function processAllProperties() {
  try {
    // Ensure 27Bellair has the correct URL
    const updatedResources = resources.map(r => {
      if (r.id === "27Bellair") {
        return {
          ...r,
          extendedProps: {
            ...r.extendedProps,
            iCal: "https://www.airbnb.co.za/calendar/ical/1099848746094296878.ics?s=2f8f7434b3affe7d4b025bfd68b2e7ec"
          }
        };
      }
      return r;
    });
    
    // Filter properties with iCal links
    const propertiesWithIcal = updatedResources.filter(r => r.extendedProps.iCal !== null);
    console.log(`Found ${propertiesWithIcal.length} properties with iCal feeds`);
    
    // Create a container for all availability data
    const allAvailability = {
      lastUpdated: new Date().toISOString(),
      properties: {}
    };
    
    // Process each property
    for (const property of propertiesWithIcal) {
      console.log(`\nProcessing property: ${property.id} - ${property.title}`);
      
      try {
        // Fetch availability
        const bookings = await fetchAvailability(property.extendedProps.iCal);
        console.log(`Found ${bookings.length} bookings for ${property.id}`);
        
        // Generate availability calendar
        const calendar = generateAvailabilityCalendar(bookings);
        
        // Add to the all-properties result
        allAvailability.properties[property.id] = {
          property: {
            id: property.id,
            title: property.title,
            roomNumber: property.extendedProps.roomNumber,
            roomType: property.extendedProps.roomType,
            url: property.extendedProps.url
          },
          bookings: bookings,
          availability: calendar
        };
      } catch (error) {
        console.error(`Error processing ${property.id}: ${error.message}`);
        
        // Add an error entry to the results instead of silently failing
        allAvailability.properties[property.id] = {
          property: {
            id: property.id,
            title: property.title,
            roomNumber: property.extendedProps.roomNumber,
            roomType: property.extendedProps.roomType,
            url: property.extendedProps.url
          },
          error: error.message,
          bookings: [],
          availability: {} // Empty availability data due to error
        };
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save all availability data
    fs.writeFileSync(
      'all-properties-availability.json',
      JSON.stringify(allAvailability, null, 2)
    );
    
    console.log('\nAll availability data has been saved to all-properties-availability.json');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

// Choose which mode to run
if (process.argv.includes('--all')) {
  // Process all properties
  processAllProperties().catch(err => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
} else {
  // Just run the 27Bellair test
  main().catch(err => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
