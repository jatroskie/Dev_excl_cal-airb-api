const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

// Room mapping with Airbnb URLs
const roomMapping = {
  // STU-BALC
  "0302": {
    airbnbId: "B302",
    airbnbTitle: "Fabulous studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview302",
    property: "TBA"
  },
  "0303": {
    airbnbId: "B303",
    airbnbTitle: "Spectacular studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview303",
    property: "TBA"
  },
  "0400": {
    airbnbId: "B400",
    airbnbTitle: "Fabulous views in trendy Breë",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview400",
    property: "TBA"
  },
  "0401": {
    airbnbId: "B401",
    airbnbTitle: "Fabulous spacious apartment!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview401",
    property: "TBA"
  },
  "0402": {
    airbnbId: "B402",
    airbnbTitle: "Absolutely fabulous personified!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview402",
    property: "TBA"
  },
  "0501": {
    airbnbId: "B501",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview501",
    property: "TBA"
  },
  "0502": {
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null
  },
  "0503": {
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null
  },
  "0514": {
    airbnbId: "B514",
    airbnbTitle: "Fun studio with balcony in Bree",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview514",
    property: "TBA"
  },
  // STU-URB
  "0304": {
    airbnbId: "B404",
    airbnbTitle: "Spacious studio, great views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview404",
    property: "TBA"
  },
  "0307": {
    airbnbId: "B307",
    airbnbTitle: "Sublime studio with everything!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview307",
    property: "TBA"
  },
  "0309": {
    airbnbId: "B309",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview309",
    property: "TBA"
  },
  "0312": {
    airbnbId: "B312",
    airbnbTitle: "Spacious studio with living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview312",
    property: "TBA"
  },
  "0319": {
    airbnbId: "B319",
    airbnbTitle: "Sunny 1 bed great views & decor",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview319",
    property: "TBA"
  },
  "0321": {
    airbnbId: "B321",
    airbnbTitle: "Sunny studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview321",
    property: "TBA"
  },
  "0323": {
    airbnbId: "B323",
    airbnbTitle: "Spacious sunny studio with views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview323",
    property: "TBA"
  },
  "0407": {
    airbnbId: "B407",
    airbnbTitle: "Spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview407",
    property: "TBA"
  },
  "0408": {
    airbnbId: "B408",
    airbnbTitle: "Splendid spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview408",
    property: "TBA"
  },
  "0411": {
    airbnbId: "B411",
    airbnbTitle: "Super studio with sep living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview411",
    property: "TBA"
  },
  "0420": {
    airbnbId: "B420",
    airbnbTitle: "Sunny studio with fabulous views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview420",
    property: "TBA"
  },
  // 1-BR
  "0315": {
    airbnbId: "B315",
    airbnbTitle: "Fab 1 bed with balcony and views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview315",
    property: "TBA"
  },
  "0317": {
    airbnbId: "B317",
    airbnbTitle: "Great 1 bed with balcony & views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview317",
    property: "TBA"
  },
  "0413": {
    airbnbId: "B413",
    airbnbTitle: "Fabulous 1 bed with balcony & views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview413",
    property: "TBA"
  },
  "0415": {
    airbnbId: "S415",
    airbnbTitle: "Sunny spacious 1 bed with views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityviews415",
    property: "TTBH"
  },
  // STU-LUX
  "0504": {
    airbnbId: "B504",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview504",
    property: "TBA"
  },
  "0506": {
    airbnbId: "B506",
    airbnbTitle: "City Views with all the comfort",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview506",
    property: "TBA"
  },
  "0507": {
    airbnbId: "B507",
    airbnbTitle: "Stunning studio with views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview507",
    property: "TBA"
  },
  "0520": {
    airbnbId: "B520",
    airbnbTitle: "Sunny studio & fabulous views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview520",
    property: "TBA"
  },
  // 2-BR
  "0515": {
    airbnbId: "B515",
    airbnbTitle: "Fabulous finishes, views & space!",
    roomType: "2-BR",
    url: "airbnb.co.za/h/cityview515",
    property: "TBA"
  },
  // Additional rooms - waterfront
  "G102": {
    airbnbId: "G102",
    airbnbTitle: "Exceptional Waterfront Living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g102",
    property: "WFV"
  },
  "G205": {
    airbnbId: "G205",
    airbnbTitle: "Fabulous waterfront lifestyle!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g205",
    property: "WFV"
  },
  "H003": {
    airbnbId: "H003",
    airbnbTitle: "Fabulous waterfront living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-h003",
    property: "WFV"
  }
};

async function processAndMergeCSVs() {
  const outputDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary';
  const downloadsDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary\\downloads';
  const jsonFilePath = path.join(outputDirectory, 'calendar-data.json');
  
  // Step 1: Load existing JSON data if it exists
  let existingData = { resources: [], events: [] };
  try {
    const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
    existingData = JSON.parse(jsonContent);
    console.log(`Loaded existing JSON with ${existingData.resources.length} resources and ${existingData.events.length} events`);
  } catch (error) {
    console.log('No existing JSON file found or error reading it. Creating new file.');
  }
  
  // Step 2: Process new CSV files from downloads folder
  const csvFiles = (await fs.readdir(downloadsDirectory))
    .filter(file => file.endsWith('.csv') && file.includes('_reservations'));

  console.log(`Found ${csvFiles.length} CSV files to process in downloads folder`);

  let newResources = [];
  let newEvents = [];
  const roomsMap = new Map();

  for (const file of csvFiles) {
    const filePath = path.join(downloadsDirectory, file);
    console.log(`Processing file: ${file} from downloads folder`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Skip files that contain "No reservations found for this room"
      if (content.includes('No reservations found for this room')) {
        console.log(`Skipping ${file} - No reservations found`);
        continue;
      }
      
      // Parse the CSV data
      const parseResult = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
      });
      
      if (parseResult.errors.length > 0) {
        console.warn(`Warnings parsing ${file}:`, parseResult.errors);
      }
      
      const { resources, events } = processCSVData(parseResult.data, file);
      newResources = [...newResources, ...resources];
      newEvents = [...newEvents, ...events];
      
      console.log(`Extracted ${resources.length} resources and ${events.length} events from ${file}`);
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
  
  // Step 3: Merge resources and events
  const mergedData = mergeCalendarData(existingData, newResources, newEvents);
  
  // Step 4: Save the merged data back to JSON
  await fs.writeFile(
    jsonFilePath,
    JSON.stringify(mergedData, null, 2),
    'utf-8'
  );
  
  console.log(`
  ---- Processing Summary ----
  CSV files processed: ${csvFiles.length}
  New resources: ${newResources.length}
  New events: ${newEvents.length}
  Final resources count: ${mergedData.resources.length}
  Final events count: ${mergedData.events.length}
  Calendar data saved to: ${jsonFilePath}
  `);
}

function processCSVData(data, fileName) {
  const resources = [];
  const events = [];
  const roomsMap = new Map();

  // Extract room number from file name (assuming format like "0302_reservations.csv")
  const roomNumberMatch = fileName.match(/^(\d+)_reservations\.csv$/);
  const defaultRoomNumber = roomNumberMatch ? roomNumberMatch[1] : null;

  data.forEach((row, index) => {
    // Use room from CSV or from filename if not present in CSV
    const roomId = (row.Room ? row.Room.toString() : defaultRoomNumber).toString();
    
    if (!roomId || !row.Arrival || !row.Departure) {
      console.log(`Skipping row ${index} in ${fileName}: Missing required data`);
      return;
    }

    const roomType = row['Room Type'] || 'UNKNOWN';
    const property = row['Property'] || 'TBA'; // Get property from CSV, defaulting to 'TBA' if not present
    
    // Get URL from room mapping if available
    const roomData = roomMapping[roomId.trim()];
    const url = roomData ? roomData.url : null;
    
    if (!roomsMap.has(roomId)) {
      roomsMap.set(roomId, {
        id: roomId,
        title: `${roomId.trim()}-${roomType}`,
        extendedProps: { 
          roomType: roomType,
          property: property,
          url: url  // Adding URL to resource extended properties
        }
      });
    }

    try {
      const startDate = formatDate(row.Arrival);
      const endDate = formatDate(row.Departure);

      if (startDate && endDate) {
        const status = row['Reservation Type'] || '';
        
        // Create a unique ID that can be used for deduplication
        // The combination of room, confirmation number and arrival/departure dates makes it unique
        const confirmationId = row['Confirmation Number'] || '';
        const uniqueId = `${confirmationId}_${roomId}_${startDate}_${endDate}`;
        
        events.push({
          id: uniqueId, // Use a unique ID for better deduplication
          resourceId: roomId,
          title: row.Name || 'Unnamed Reservation',
          start: startDate,
          end: endDate,
          classNames: getReservationClasses(status),
          extendedProps: {
            fileName: fileName, // Keep track of which file this came from
            confirmationNumber: row['Confirmation Number'],
            roomType: row['Room Type'],
            status: status,
            nights: row.Nights,
            adults: row.Adults,
            children: row.Children,
            rate: row.Rate,
            source: row.Source,
            travelAgent: row['Travel Agent'] || '', // Added Travel Agent field
            property: property, // Added property field to events as well
            url: url, // Adding URL to event extended properties too
            lastUpdated: new Date().toISOString() // Track when this was last updated
          }
        });
      }
    } catch (error) {
      console.error(`Error processing row ${index} in ${fileName}:`, error);
    }
  });

  return { resources: Array.from(roomsMap.values()), events };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : null;
}

function getReservationClasses(status) {
  if (!status) {
    console.log('Status missing for reservation');
    return [];
  }
  const statusLower = status.toLowerCase().trim();
  const classes = [];
  if (statusLower.includes('cancelled') || statusLower === 'canceled') {
    classes.push('reservation-cancelled');
    return classes;
  }
  if (statusLower.includes('in house')) classes.push('reservation-inhouse');
  if (statusLower.includes('guaranteed')) classes.push('reservation-guaranteed');
  if (statusLower.includes('non')) classes.push('reservation-nonguarantee');
  if (statusLower.includes('tentative')) classes.push('reservation-tentative');
  if (statusLower.includes('stay')) classes.push('reservation-stayover');
  if (!classes.length) {
    console.log(`Status "${status}" did not match any known reservation type`);
  }
  return classes;
}

function mergeCalendarData(existingData, newResources, newEvents) {
  // Create maps for easier lookups
  const resourceMap = new Map();
  const eventMap = new Map();
  
  // Initialize with existing data
  existingData.resources.forEach(resource => {
    resourceMap.set(resource.id, resource);
  });
  
  existingData.events.forEach(event => {
    eventMap.set(event.id, event);
  });
  
  // Merge new resources (prefer newer ones if there's a conflict)
  newResources.forEach(resource => {
    resourceMap.set(resource.id, resource);
  });
  
  // Merge new events with special handling (update existing or add new)
  newEvents.forEach(event => {
    // If we have an existing event with the same ID, update it
    // keeping any properties from the existing event that aren't in the new one
    if (eventMap.has(event.id)) {
      const existingEvent = eventMap.get(event.id);
      
      // Check if the reservation details have actually changed
      const hasChanged = (
        event.start !== existingEvent.start ||
        event.end !== existingEvent.end ||
        event.title !== existingEvent.title ||
        JSON.stringify(event.classNames) !== JSON.stringify(existingEvent.classNames)
      );
      
      if (hasChanged) {
        console.log(`Updating changed event: ${event.id}`);
        // Create a merged event, preferring new properties over existing ones
        const mergedEvent = { 
          ...existingEvent, 
          ...event,
          extendedProps: {
            ...existingEvent.extendedProps,
            ...event.extendedProps,
            previousStatus: existingEvent.extendedProps.status,
            wasUpdated: true
          }
        };
        eventMap.set(event.id, mergedEvent);
      } else {
        // No changes, keep existing
        console.log(`Event unchanged: ${event.id}`);
      }
    } else {
      // If it's a new event, add it directly
      console.log(`Adding new event: ${event.id}`);
      eventMap.set(event.id, event);
    }
  });
  
  // Convert maps back to arrays
  return {
    resources: Array.from(resourceMap.values()),
    events: Array.from(eventMap.values())
  };
}

function removeDuplicateResources(resources) {
  const uniqueMap = new Map();
  resources.forEach(resource => uniqueMap.set(resource.id, resource));
  return Array.from(uniqueMap.values());
}

// Run the script
processAndMergeCSVs().catch(error => {
  console.error('Error in main process:', error);
});