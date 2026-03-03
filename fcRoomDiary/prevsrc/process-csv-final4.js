// Description: This enhanced script processes CSV files downloaded from the FC Room Diary
// and merges them into a single JSON file for use in a FullCalendar scheduler.
// It also adds additional properties including iCal URLs from the fixed-resources file.
// The script assumes the CSV files are in a specific format and that the room mapping is correct.

const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

// Function to extract iCal URLs from resources file
async function getICalUrls() {
  try {
    // Path to your fixed-resources file - adjust this path as needed
    const resourcesPath = path.join(__dirname, 'fixed-resources.js');
    
    // Load and evaluate the JavaScript file
    const resourcesContent = await fs.readFile(resourcesPath, 'utf-8');
    
    // Create a temporary file to fix any potential syntax errors in the resources file
    // (like the closing bracket issue at the beginning of the file)
    const tempFilePath = path.join(__dirname, 'temp-resources.js');
    
    // Fix any potential syntax errors and create a proper module
    let fixedContent = resourcesContent
      .replace("];", "]")  // Fix potential syntax error
      .replace(/const resources = \[/, "module.exports = [");
    
    await fs.writeFile(tempFilePath, fixedContent, 'utf-8');
    
    // Import the cleaned resources array
    const resourcesData = require(tempFilePath);
    
    // Clean up the temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (unlinkErr) {
      console.warn('Warning: Could not remove temporary file:', unlinkErr);
    }
    
    // Create a map of roomNumber to iCal URL
    const iCalMap = {};
    resourcesData.forEach(resource => {
      if (resource.extendedProps && resource.extendedProps.roomNumber) {
        iCalMap[resource.extendedProps.roomNumber] = resource.extendedProps.iCal || null;
      }
    });
    
    console.log(`Extracted ${Object.keys(iCalMap).length} iCal URLs from resources file`);
    return iCalMap;
  } catch (error) {
    console.error('Error loading iCal URLs from resources file:', error);
    console.error('Detailed error:', error.stack);
    
    // If there was an error with the JS approach, fall back to manual parsing
    try {
      console.log('Falling back to manual parsing of resources file...');
      const resourcesPath = path.join(__dirname, 'fixed-resources.js');
      const resourcesContent = await fs.readFile(resourcesPath, 'utf-8');
      
      // Use regex to extract room numbers and iCal URLs
      const iCalMap = {};
      const regex = /"roomNumber":\s*"([^"]+)".*?"iCal":\s*"([^"]+)"/gs;
      let match;
      
      while ((match = regex.exec(resourcesContent)) !== null) {
        const roomNumber = match[1];
        const iCalUrl = match[2];
        if (roomNumber && iCalUrl) {
          iCalMap[roomNumber] = iCalUrl;
        }
      }
      
      console.log(`Manually extracted ${Object.keys(iCalMap).length} iCal URLs from resources file`);
      return iCalMap;
    } catch (fallbackError) {
      console.error('Error in fallback parsing:', fallbackError);
      // Return empty map if both approaches fail, so script can continue
      return {};
    }
  }
}

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

// Main function to process and merge CSVs
async function processAndMergeCSVs() {
  // You can customize these paths as needed
  const outputDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary';
  const downloadsDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary\\downloads';
  const jsonFilePath = path.join(outputDirectory, 'calendar-data.json');
  
  // Create directories if they don't exist
  try {
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.mkdir(downloadsDirectory, { recursive: true });
  } catch (err) {
    console.log('Directories already exist or cannot be created');
  }
  
  // Step 1: Load iCal URLs from resources file
  console.log('Loading iCal URLs from resources file...');
  const iCalMap = await getICalUrls();
  console.log(`Loaded ${Object.keys(iCalMap).length} iCal URLs from resources file`);
  
  // Step 2: Update roomMapping with iCal URLs
  let iCalCount = 0;
  for (const roomId in roomMapping) {
    if (iCalMap[roomId]) {
      roomMapping[roomId].iCal = iCalMap[roomId];
      iCalCount++;
    } else {
      roomMapping[roomId].iCal = null;
    }
  }
  console.log(`Added ${iCalCount} iCal URLs to the roomMapping object`);
  
  // Optional: Save the updated roomMapping to a file for inspection
  try {
    await fs.writeFile(
      path.join(outputDirectory, 'updated-room-mapping.json'),
      JSON.stringify(roomMapping, null, 2),
      'utf-8'
    );
    console.log('Saved updated room mapping to updated-room-mapping.json');
  } catch (err) {
    console.warn('Warning: Could not save updated room mapping:', err.message);
  }
  
  // Step 3: Load existing JSON data if it exists
  let existingData = { resources: [], events: [] };
  try {
    const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
    existingData = JSON.parse(jsonContent);
    console.log(`Loaded existing JSON with ${existingData.resources.length} resources and ${existingData.events.length} events`);
  } catch (error) {
    console.log('No existing JSON file found or error reading it. Creating new file.');
  }
  
  // Step 4: Process new CSV files from downloads folder
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
  
  // Step 5: Merge resources and events
  const mergedData = mergeCalendarData(existingData, newResources, newEvents);
  
  // Step 6: Save the merged data back to JSON
  // Do a final check to ensure iCal URLs are included
  let icalsAdded = 0;
  
  // For each resource, ensure room with iCal in roomMapping has iCal in the resource
  mergedData.resources.forEach(resource => {
    if (resource.extendedProps && resource.extendedProps.roomNumber) {
      const roomNumber = resource.extendedProps.roomNumber;
      if (roomMapping[roomNumber] && roomMapping[roomNumber].iCal && 
          (!resource.extendedProps.iCal || resource.extendedProps.iCal === 'null')) {
        resource.extendedProps.iCal = roomMapping[roomNumber].iCal;
        icalsAdded++;
      }
    }
  });
  
  // For each event, ensure the corresponding resource's iCal URL is included
  mergedData.events.forEach(event => {
    if (event.resourceId) {
      const matchingResource = mergedData.resources.find(res => res.id === event.resourceId);
      if (matchingResource && matchingResource.extendedProps && matchingResource.extendedProps.iCal && 
          (!event.extendedProps.iCal || event.extendedProps.iCal === 'null')) {
        if (!event.extendedProps) {
          event.extendedProps = {};
        }
        event.extendedProps.iCal = matchingResource.extendedProps.iCal;
        icalsAdded++;
      }
    }
  });
  
  if (icalsAdded > 0) {
    console.log(`Added ${icalsAdded} missing iCal URLs in final check`);
  }
  
  // Now write the final JSON with all iCal URLs properly included
  await fs.writeFile(
    jsonFilePath,
    JSON.stringify(mergedData, null, 2),
    'utf-8'
  );
  
  // Return the merged data for validation
  return mergedData;
  
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
    
    // Get room data from mapping if available
    const roomTrimmed = roomId.trim();
    const roomData = roomMapping[roomTrimmed];
    
    // Debug logging for iCal URLs
    if (roomData && roomData.iCal) {
      console.log(`Found iCal URL for room ${roomTrimmed}: ${roomData.iCal.substring(0, 50)}...`);
    } else {
      console.log(`No iCal URL found for room ${roomTrimmed}`);
    }
    
    const url = roomData ? roomData.url : null;
    const iCal = roomData ? roomData.iCal : null;
    
    // Create the new unique ID combining property and room number
    const uniqueResourceId = `${property}-${roomTrimmed}`;
    
    if (!roomsMap.has(uniqueResourceId)) {
      const resourceObj = {
        id: uniqueResourceId, // New unique ID format: property-room
        title: `${roomTrimmed}-${roomType}`, // Keep the original title format
        extendedProps: { 
          roomNumber: roomTrimmed, // Store the original room number
          roomType: roomType,
          property: property,
          url: url  // Adding URL to resource extended properties
        }
      };
      
      // Explicitly add iCal if it exists
      if (iCal) {
        resourceObj.extendedProps.iCal = iCal;
      }
      
      roomsMap.set(uniqueResourceId, resourceObj);
      
      // Debug: Log the created resource
      console.log(`Created resource for ${uniqueResourceId} with iCal: ${iCal ? 'YES' : 'NO'}`);
    }

    try {
      const startDate = formatDate(row.Arrival);
      const endDate = formatDate(row.Departure);

      if (startDate && endDate) {
        const status = row['Reservation Type'] || '';
        
        // Create a unique ID that can be used for deduplication
        // Include property code to ensure uniqueness across properties
        const confirmationId = row['Confirmation Number'] || '';
        const uniqueEventId = `${confirmationId}_${property}-${roomId}_${startDate}_${endDate}`;
        
        const eventObj = {
          id: uniqueEventId, // Use a unique ID for better deduplication
          resourceId: uniqueResourceId, // Use the new unique resource ID
          title: row.Name || 'Unnamed Reservation',
          start: startDate,
          end: endDate,
          classNames: getReservationClasses(status),
          extendedProps: {
            fileName: fileName, // Keep track of which file this came from
            confirmationNumber: row['Confirmation Number'],
            roomNumber: roomTrimmed, // Store the original room number
            roomType: row['Room Type'],
            status: status,
            nights: row.Nights,
            adults: row.Adults,
            children: row.Children,
            rate: row.Rate,
            source: row.Source,
            travelAgent: row['Travel Agent'] || '', // Added Travel Agent field
            property: property, // Added property field to events as well
            url: url, // Adding URL to event extended properties
            lastUpdated: new Date().toISOString() // Track when this was last updated
          }
        };
        
        // Explicitly add iCal if it exists
        if (iCal) {
          eventObj.extendedProps.iCal = iCal;
        }
        
        events.push(eventObj);
        
        // Debug: Log the created event
        console.log(`Created event for ${uniqueEventId} with iCal: ${iCal ? 'YES' : 'NO'}`);
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
    // Check if we're losing iCal information in the update
    if (resourceMap.has(resource.id)) {
      const existingResource = resourceMap.get(resource.id);
      if (existingResource.extendedProps && existingResource.extendedProps.iCal && 
          (!resource.extendedProps || !resource.extendedProps.iCal)) {
        console.log(`Preserving iCal URL for resource ${resource.id}`);
        if (!resource.extendedProps) {
          resource.extendedProps = {};
        }
        resource.extendedProps.iCal = existingResource.extendedProps.iCal;
      }
    }
    
    // Debug: log the resource being added/updated
    const hasIcal = resource.extendedProps && resource.extendedProps.iCal;
    console.log(`${resourceMap.has(resource.id) ? 'Updating' : 'Adding'} resource ${resource.id} with iCal: ${hasIcal ? 'YES' : 'NO'}`);
    
    resourceMap.set(resource.id, resource);
  });
  
  // Merge new events with special handling (update existing or add new)
  newEvents.forEach(event => {
    // Debug: check if the event has iCal
    const hasIcal = event.extendedProps && event.extendedProps.iCal;
    
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
      
      // Preserve iCal URL if we're losing it in the update
      if (existingEvent.extendedProps && existingEvent.extendedProps.iCal && 
          (!event.extendedProps || !event.extendedProps.iCal)) {
        console.log(`Preserving iCal URL for event ${event.id}`);
        if (!event.extendedProps) {
          event.extendedProps = {};
        }
        event.extendedProps.iCal = existingEvent.extendedProps.iCal;
      }
      
      if (hasChanged) {
        console.log(`Updating changed event: ${event.id} with iCal: ${hasIcal ? 'YES' : 'NO'}`);
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
        // No changes, keep existing but ensure iCal is preserved
        console.log(`Event unchanged: ${event.id}`);
        // Make sure iCal is preserved in the existing event
        if (!existingEvent.extendedProps.iCal && hasIcal) {
          existingEvent.extendedProps.iCal = event.extendedProps.iCal;
          console.log(`Added missing iCal URL to unchanged event ${event.id}`);
        }
      }
    } else {
      // If it's a new event, add it directly
      console.log(`Adding new event: ${event.id} with iCal: ${hasIcal ? 'YES' : 'NO'}`);
      eventMap.set(event.id, event);
    }
  });
  
  // Convert maps back to arrays
  const result = {
    resources: Array.from(resourceMap.values()),
    events: Array.from(eventMap.values())
  };
  
  // Add some debug counts
  const resourcesWithIcal = result.resources.filter(r => r.extendedProps && r.extendedProps.iCal).length;
  const eventsWithIcal = result.events.filter(e => e.extendedProps && e.extendedProps.iCal).length;
  
  console.log(`
  Resources with iCal: ${resourcesWithIcal}/${result.resources.length}
  Events with iCal: ${eventsWithIcal}/${result.events.length}
  `);
  
  return result;
}

function removeDuplicateResources(resources) {
  const uniqueMap = new Map();
  resources.forEach(resource => uniqueMap.set(resource.id, resource));
  return Array.from(uniqueMap.values());
}

// Additional function to write the updated roomMapping to a separate file
// This can be useful for debugging or for future reference
async function writeRoomMappingToFile() {
  try {
    const outputDirectory = 'C:\\Users\\jatro\\Dev\\fcRoomDiary';
    const mappingFilePath = path.join(outputDirectory, 'room-mapping.json');
    
    // Count how many rooms have iCal URLs
    let roomsWithIcal = 0;
    for (const roomId in roomMapping) {
      if (roomMapping[roomId].iCal) {
        roomsWithIcal++;
      }
    }
    
    console.log(`Room mapping has ${roomsWithIcal} rooms with iCal URLs out of ${Object.keys(roomMapping).length} total rooms`);
    
    await fs.writeFile(
      mappingFilePath,
      JSON.stringify(roomMapping, null, 2),
      'utf-8'
    );
    
    console.log(`Room mapping with iCal URLs saved to: ${mappingFilePath}`);
    
    // Create a separate file with just iCal URLs for easier checking
    const icalMapFilePath = path.join(outputDirectory, 'ical-urls.json');
    const icalMap = {};
    
    for (const roomId in roomMapping) {
      if (roomMapping[roomId].iCal) {
        icalMap[roomId] = roomMapping[roomId].iCal;
      }
    }
    
    await fs.writeFile(
      icalMapFilePath,
      JSON.stringify(icalMap, null, 2),
      'utf-8'
    );
    
    console.log(`iCal URLs extracted to: ${icalMapFilePath}`);
  } catch (error) {
    console.error('Error writing room mapping file:', error);
  }
}

// Final validation function to check the output
function validateOutput(mergedData) {
  let resourcesWithIcal = 0;
  let eventsWithIcal = 0;
  
  // Count resources with iCal
  mergedData.resources.forEach(resource => {
    if (resource.extendedProps && resource.extendedProps.iCal) {
      resourcesWithIcal++;
    }
  });
  
  // Count events with iCal
  mergedData.events.forEach(event => {
    if (event.extendedProps && event.extendedProps.iCal) {
      eventsWithIcal++;
    }
  });
  
  console.log(`
  ---- Validation Summary ----
  Total resources: ${mergedData.resources.length}
  Resources with iCal URLs: ${resourcesWithIcal}
  Total events: ${mergedData.events.length}
  Events with iCal URLs: ${eventsWithIcal}
  `);
  
  return {
    totalResources: mergedData.resources.length,
    resourcesWithIcal,
    totalEvents: mergedData.events.length,
    eventsWithIcal
  };
}

// Run the script
async function main() {
  try {
    console.log('Starting CSV processing and iCal integration...');
    const mergedData = await processAndMergeCSVs();
    
    // Validate the output
    const validationResults = validateOutput(mergedData);
    
    // Only write the room mapping if it's not already done in processAndMergeCSVs
    // await writeRoomMappingToFile();
    
    console.log('Process completed successfully!');
  } catch (error) {
    console.error('Error in main process:', error);
    console.error(error.stack);
  }
}

// Execute the main function
main();
