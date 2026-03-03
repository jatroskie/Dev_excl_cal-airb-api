// Usage: node all-properties-lookup.js
// Description: This script fetches availability data for all properties with iCal feeds
// and saves the data to individual files and a combined JSON file. 
// It also generates a summary report of the process.
// Note: This script requires the fixed-resources-final.js file to be present in the same directory.
// The script will generate a fixed-resources.json file for future use.

const fs = require('fs');
const axios = require('axios');
const ical = require('node-ical');
const path = require('path');

// First, fix and load the resources file
function loadAndFixResources() {
  try {
    // Read the resources file with potential syntax errors
    const fileContent = fs.readFileSync('fixed-resources-final.js', 'utf8');
    
    // Fix common syntax issues
    // First fix is for misplaced bracket on first entry
    let fixedContent = fileContent.replace('    }\n];', '    }\n  },');
    
    // Remove any trailing commas before closing bracket
    fixedContent = fixedContent.replace(/,(\s*)\]/g, '$1]');
    
    // Extract just the array part
    const jsCode = fixedContent.replace('const resources =', '');
    
    // Evaluate the JS code to get the array (in controlled environment only!)
    const resources = eval(jsCode);
    
    // Save the fixed content to a proper JSON file for future use
    fs.writeFileSync('fixed-resources.json', JSON.stringify(resources, null, 2));
    
    console.log(`Fixed and loaded ${resources.length} property resources`);
    return resources;
  } catch (error) {
    console.error('Error loading or fixing resources file:', error.message);
    process.exit(1);
  }
}

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
    
    for (const key in data) {
      const event = data[key];
      
      // Only process VEVENT entries (which represent calendar events)
      if (event.type === 'VEVENT') {
        eventCount++;
        
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
 * Process all resources with iCal links
 */
async function processAllProperties() {
  try {
    // Load and fix the resources file
    const resources = loadAndFixResources();
    
    // Create output directory if it doesn't exist
    const outputDir = 'availability-data';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Filter properties with iCal links
    const propertiesWithIcal = resources.filter(r => r.extendedProps.iCal !== null);
    console.log(`\nFound ${propertiesWithIcal.length} properties with iCal feeds`);
    
    // Special handling for 27Bellair - use the correct URL
    const bellair = propertiesWithIcal.find(p => p.id === "27Bellair");
    if (bellair) {
      bellair.extendedProps.iCal = "https://www.airbnb.co.za/calendar/ical/1099848746094296878.ics?s=2f8f7434b3affe7d4b025bfd68b2e7ec";
      console.log("Updated 27Bellair with the correct iCal URL");
    }
    
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
        
        // Create the property result object
        const propertyResult = {
          property: {
            id: property.id,
            title: property.title,
            roomNumber: property.extendedProps.roomNumber,
            roomType: property.extendedProps.roomType,
            property: property.extendedProps.property,
            url: property.extendedProps.url
          },
          lastUpdated: new Date().toISOString(),
          bookings: bookings,
          availability: calendar
        };
        
        // Add to the all-properties result
        allAvailability.properties[property.id] = propertyResult;
        
        // Save individual property data
        fs.writeFileSync(
          path.join(outputDir, `${property.id}-availability.json`), 
          JSON.stringify(propertyResult, null, 2)
        );
        
        console.log(`Saved availability data for ${property.id}`);
      } catch (error) {
        console.error(`Error processing ${property.id}: ${error.message}`);
        
        // Add an error entry to the results instead of silently failing
        allAvailability.properties[property.id] = {
          property: {
            id: property.id,
            title: property.title,
            roomNumber: property.extendedProps.roomNumber,
            roomType: property.extendedProps.roomType,
            property: property.extendedProps.property,
            url: property.extendedProps.url
          },
          error: error.message,
          lastUpdated: new Date().toISOString(),
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
    console.log(`Individual property files are saved in the "${outputDir}" directory`);
    
    // Generate a summary report
    const summary = {
      totalProperties: propertiesWithIcal.length,
      propertiesProcessed: Object.keys(allAvailability.properties).length,
      propertiesWithBookings: Object.values(allAvailability.properties)
        .filter(p => p.bookings && p.bookings.length > 0).length,
      totalBookings: Object.values(allAvailability.properties)
        .reduce((sum, p) => sum + (p.bookings ? p.bookings.length : 0), 0),
      errors: Object.values(allAvailability.properties)
        .filter(p => p.error).length
    };
    
    console.log('\nSummary Report:');
    console.log(`Total properties with iCal feeds: ${summary.totalProperties}`);
    console.log(`Properties successfully processed: ${summary.propertiesProcessed}`);
    console.log(`Properties with bookings found: ${summary.propertiesWithBookings}`);
    console.log(`Total booking periods: ${summary.totalBookings}`);
    console.log(`Properties with errors: ${summary.errors}`);
    
    return { success: true, summary };
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the script
processAllProperties().then(result => {
  if (result.success) {
    console.log('\nTask completed successfully!');
  } else {
    console.error('\nTask failed:', result.error);
    process.exit(1);
  }
});
