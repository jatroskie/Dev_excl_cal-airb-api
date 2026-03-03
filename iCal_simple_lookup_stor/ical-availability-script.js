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
    // Fetch the iCal data
    const response = await axios.get(icalUrl);
    
    // Parse the iCal data
    const data = ical.parseICS(response.data);
    
    // Extract booking periods (VEVENT items with BUSY status represent bookings)
    const bookings = [];
    
    for (const key in data) {
      const event = data[key];
      
      // Only process VEVENT entries (which represent bookings)
      if (event.type === 'VEVENT') {
        // Airbnb typically marks bookings with "CONFIRMED" status or with "BUSY" in summary
        const isBusy = 
          (event.status === 'CONFIRMED') || 
          (event.summary && event.summary.includes('BUSY')) ||
          (event.description && event.description.includes('BUSY'));
        
        if (isBusy && event.start && event.end) {
          bookings.push({
            start: event.start.toISOString().split('T')[0], // Get YYYY-MM-DD format
            end: event.end.toISOString().split('T')[0],     // Get YYYY-MM-DD format
            summary: event.summary || 'Booked'
          });
        }
      }
    }
    
    return bookings;
  } catch (error) {
    console.error(`Error fetching iCal data: ${error.message}`);
    return [];
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
        ...calendar[checkoutStr].booking,
        checkOut: true
      };
    }
  });
  
  return calendar;
}

/**
 * Main function to process resources and generate availability data
 */
async function main() {
  // Find the 27Bellair property
  const property = resources.find(r => r.id === "27Bellair");
  
  if (!property || !property.extendedProps.iCal) {
    console.error('Property 27Bellair not found or has no iCal URL');
    return;
  }
  
  console.log(`Processing property: ${property.id} - ${property.title}`);
  
  // Fetch availability for the property
  const bookings = await fetchAvailability(property.extendedProps.iCal);
  console.log(`Found ${bookings.length} bookings for ${property.id}`);
  
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
}

// Process all resources with iCal links
async function processAllProperties() {
  // Filter properties with iCal links
  const propertiesWithIcal = resources.filter(r => r.extendedProps.iCal !== null);
  console.log(`Found ${propertiesWithIcal.length} properties with iCal feeds`);
  
  // Create a container for all availability data
  const allAvailability = {
    lastUpdated: new Date().toISOString(),
    properties: {}
  };
  
  // Process each property
  for (const property of propertiesWithIcal) {
    console.log(`Processing property: ${property.id} - ${property.title}`);
    
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
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save all availability data
  fs.writeFileSync(
    'all-properties-availability.json',
    JSON.stringify(allAvailability, null, 2)
  );
  
  console.log('All availability data has been saved to all-properties-availability.json');
}

// Run just the 27Bellair test
main().catch(err => console.error(err));

// Uncomment the below line to process all properties with iCal feeds
// processAllProperties().catch(err => console.error(err));
