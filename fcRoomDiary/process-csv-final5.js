// Description: This enhanced script processes CSV files downloaded from the FC Room Diary
// and merges them into a single JSON file with proper iCal URL integration
// Fixes the issue where iCal URLs were not being properly included in the output

const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

// Function to directly extract iCal URLs from fixed-resources.js
async function extractICalUrls() {
  try {
    // Path to your fixed-resources.js file - adjust as needed
    const resourcesPath = path.join(__dirname, 'fixed-resources.js');
    
    console.log('Reading fixed-resources.js file...');
    const content = await fs.readFile(resourcesPath, 'utf-8');
    
    // Parse the content manually with regex
    console.log('Extracting iCal URLs from resources...');
    const iCalMap = {};
    
    // Extract room numbers and their iCal URLs
    const regex = /"roomNumber":\s*"([^"]+)"[^}]*"iCal":\s*"([^"]*?)"/gs;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const roomNumber = match[1];
      const iCalUrl = match[2] || null;
      
      if (roomNumber) {
        iCalMap[roomNumber] = iCalUrl;
        if (iCalUrl) {
          console.log(`Found iCal URL for room ${roomNumber}: ${iCalUrl.substring(0, 40)}...`);
        }
      }
    }
    
    console.log(`Successfully extracted ${Object.keys(iCalMap).length} room mappings with iCal URLs`);
    
    // Save the extracted iCal map to a separate file for debugging
    const debugMapPath = path.join(__dirname, 'extracted-ical-map.json');
    await fs.writeFile(debugMapPath, JSON.stringify(iCalMap, null, 2), 'utf-8');
    console.log(`Saved extracted iCal map to ${debugMapPath} for debugging`);
    
    return iCalMap;
  } catch (error) {
    console.error('Error extracting iCal URLs:', error);
    console.error('Stack trace:', error.stack);
    return {};
  }
}

// Room mapping with Airbnb URLs
// This will be populated with iCal URLs when the script runs
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
  "0404": {
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
  try {
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
    
    // Step 1: Extract iCal URLs from fixed-resources.js
    console.log('Loading iCal URLs from fixed-resources.js...');
    const iCalMap = await extractICalUrls();
    
    // Add a sanity check to see if we have any iCal URLs
    const iCalCount = Object.values(iCalMap).filter(url => url && url.length > 0).length;
    console.log(`Found ${iCalCount} valid iCal URLs out of ${Object.keys(iCalMap).length} rooms`);
    
    if (iCalCount === 0) {
      console.error('WARNING: No valid iCal URLs found! This will affect your output.');
    }
    
    // Step 2: Update roomMapping with iCal URLs
    let updatedCount = 0;
    for (const roomId in roomMapping) {
      if (iCalMap[roomId]) {
        roomMapping[roomId].iCal = iCalMap[roomId];
        updatedCount++;
        console.log(`Added iCal URL for room ${roomId}: ${iCalMap[roomId].substring(0, 40)}...`);
      } else {
        roomMapping[roomId].iCal = null;
      }
    }
    console.log(`Added ${updatedCount} iCal URLs to the roomMapping object`);
    
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
        
        const { resources, events } = processCSVData(parseResult.data, file, iCalMap);
        newResources = [...newResources, ...resources];
        newEvents = [...newEvents, ...events];
        
        console.log(`Extracted ${resources.length} resources and ${events.length} events from ${file}`);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
    
    // Step 5: Merge resources and events
    const mergedData = mergeCalendarData(existingData, newResources, newEvents, iCalMap);
    
    // Step 6: Final validation to ensure iCal URLs are included
    const finalData = ensureICalUrls(mergedData, iCalMap);
    
    // Step 7: Save the merged data back to JSON
    await fs.writeFile(
      jsonFilePath,
      JSON.stringify(finalData, null, 2),
      'utf-8'
    );
    
    console.log(`
    ---- Processing Summary ----
    CSV files processed: ${csvFiles.length}
    New resources: ${newResources.length}
    New events: ${newEvents.length}
    Final resources count: ${finalData.resources.length}
    Final events count: ${finalData.events.length}
    Calendar data saved to: ${jsonFilePath}
    `);
    
    // Validate the final output
    validateOutput(finalData);
    
    return finalData;
  } catch (error) {
    console.error('Error in processAndMergeCSVs:', error);
    throw error;
  }
}

// Process CSV data into resources and events
function processCSVData(data, fileName, iCalMap) {
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
    
    // Get iCal URL from roomMapping or directly from iCalMap
    let iCalUrl = null;
    if (roomData && roomData.iCal) {
      iCalUrl = roomData.iCal;
    } else if (iCalMap && iCalMap[roomTrimmed]) {
      iCalUrl = iCalMap[roomTrimmed];
    }
    
    const url = roomData ? roomData.url : null;
    
    // Create the new unique ID combining property and room number
    const uniqueResourceId = `${property}-${roomTrimmed}`;
    
    if (!roomsMap.has(uniqueResourceId)) {
      const resourceObj = {
        id: uniqueResourceId,
        title: `${roomTrimmed}-${roomType}`,
        extendedProps: { 
          roomNumber: roomTrimmed,
          roomType: roomType,
          property: property,
          url: url
        }
      };
      
      // Only add iCal if it exists to avoid null values
      if (iCalUrl) {
        resourceObj.extendedProps.iCal = iCalUrl;
      }
      
      roomsMap.set(uniqueResourceId, resourceObj);
    }

    try {
      const startDate = formatDate(row.Arrival);
      const endDate = formatDate(row.Departure);

      if (startDate && endDate) {
        const status = row['Reservation Type'] || '';
        
        // Create a unique ID that can be used for deduplication
        const confirmationId = row['Confirmation Number'] || '';
        const uniqueEventId = `${confirmationId}_${property}-${roomId}_${startDate}_${endDate}`;
        
        const eventObj = {
          id: uniqueEventId,
          resourceId: uniqueResourceId,
          title: row.Name || 'Unnamed Reservation',
          start: startDate,
          end: endDate,
          classNames: getReservationClasses(status),
          extendedProps: {
            fileName: fileName,
            confirmationNumber: row['Confirmation Number'],
            roomNumber: roomTrimmed,
            roomType: row['Room Type'],
            status: status,
            nights: row.Nights,
            adults: row.Adults,
            children: row.Children,
            rate: row.Rate,
            source: row.Source,
            travelAgent: row['Travel Agent'] || '',
            property: property,
            url: url,
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Only add iCal if it exists to avoid null values
        if (iCalUrl) {
          eventObj.extendedProps.iCal = iCalUrl;
        }
        
        events.push(eventObj);
      }
    } catch (error) {
      console.error(`Error processing row ${index} in ${fileName}:`, error);
    }
  });

  return { resources: Array.from(roomsMap.values()), events };
}

// Format date from DD.MM.YYYY to YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : null;
}

// Get reservation classes based on status
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

// Merge existing and new calendar data
function mergeCalendarData(existingData, newResources, newEvents, iCalMap) {
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
    // Set or preserve iCal URL
    if (resource.extendedProps && resource.extendedProps.roomNumber) {
      const roomNumber = resource.extendedProps.roomNumber;
      
      // Try to get iCal URL if not already present
      if (!resource.extendedProps.iCal || resource.extendedProps.iCal === 'null') {
        // First check roomMapping
        if (roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
          resource.extendedProps.iCal = roomMapping[roomNumber].iCal;
        }
        // Then check iCalMap directly
        else if (iCalMap && iCalMap[roomNumber]) {
          resource.extendedProps.iCal = iCalMap[roomNumber];
        }
      }
    }
    
    resourceMap.set(resource.id, resource);
  });
  
  // Merge new events with special handling (update existing or add new)
  newEvents.forEach(event => {
    // Add iCal URL to event if missing but available for its room
    if (event.extendedProps && event.extendedProps.roomNumber) {
      const roomNumber = event.extendedProps.roomNumber;
      
      // Try to get iCal URL if not already present
      if (!event.extendedProps.iCal || event.extendedProps.iCal === 'null') {
        // First check roomMapping
        if (roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
          event.extendedProps.iCal = roomMapping[roomNumber].iCal;
        }
        // Then check iCalMap directly
        else if (iCalMap && iCalMap[roomNumber]) {
          event.extendedProps.iCal = iCalMap[roomNumber];
        }
      }
    }
    
    // If we have an existing event with the same ID, update it
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
        
        // Ensure iCal URL is preserved if present in either
        if (existingEvent.extendedProps && existingEvent.extendedProps.iCal && 
            (!mergedEvent.extendedProps.iCal || mergedEvent.extendedProps.iCal === 'null')) {
          mergedEvent.extendedProps.iCal = existingEvent.extendedProps.iCal;
        }
        
        eventMap.set(event.id, mergedEvent);
      } else {
        // No changes, keep existing but ensure iCal is preserved
        // Make sure iCal is preserved in the existing event
        if (event.extendedProps && event.extendedProps.iCal && 
            (!existingEvent.extendedProps.iCal || existingEvent.extendedProps.iCal === 'null')) {
          existingEvent.extendedProps.iCal = event.extendedProps.iCal;
        }
      }
    } else {
      // If it's a new event, add it directly
      eventMap.set(event.id, event);
    }
  });
  
  // Convert maps back to arrays
  return {
    resources: Array.from(resourceMap.values()),
    events: Array.from(eventMap.values())
  };
}

// Final check to ensure iCal URLs are included where available
function ensureICalUrls(data, iCalMap) {
  let icalsAdded = 0;
  
  // For each resource, ensure room with iCal in iCalMap has iCal in the resource
  data.resources.forEach(resource => {
    if (resource.extendedProps && resource.extendedProps.roomNumber) {
      const roomNumber = resource.extendedProps.roomNumber;
      
      // Try to get iCal URL if not already present
      if (!resource.extendedProps.iCal || resource.extendedProps.iCal === 'null') {
        // Check roomMapping first
        if (roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
          resource.extendedProps.iCal = roomMapping[roomNumber].iCal;
          icalsAdded++;
        }
        // Then check iCalMap directly
        else if (iCalMap && iCalMap[roomNumber]) {
          resource.extendedProps.iCal = iCalMap[roomNumber];
          icalsAdded++;
        }
      }
    }
  });
  
  // For each event, ensure the corresponding resource's iCal URL is included
  data.events.forEach(event => {
    if (event.extendedProps && event.extendedProps.roomNumber) {
      const roomNumber = event.extendedProps.roomNumber;
      
      // Try to get iCal URL if not already present
      if (!event.extendedProps.iCal || event.extendedProps.iCal === 'null') {
        // First check if matching resource has iCal
        if (event.resourceId) {
          const matchingResource = data.resources.find(res => res.id === event.resourceId);
          if (matchingResource && matchingResource.extendedProps && matchingResource.extendedProps.iCal) {
            event.extendedProps.iCal = matchingResource.extendedProps.iCal;
            icalsAdded++;
          }
          // If not found in resource, check roomMapping
          else if (roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
            event.extendedProps.iCal = roomMapping[roomNumber].iCal;
            icalsAdded++;
          }
          // Finally check iCalMap directly
          else if (iCalMap && iCalMap[roomNumber]) {
            event.extendedProps.iCal = iCalMap[roomNumber];
            icalsAdded++;
          }
        }
      }
    }
  });
  
  if (icalsAdded > 0) {
    console.log(`Added ${icalsAdded} missing iCal URLs in final validation check`);
  }
  
  return data;
}

// Validation function to check the output
function validateOutput(data) {
  let resourcesWithIcal = 0;
  let eventsWithIcal = 0;
  
  // Count resources with iCal
  data.resources.forEach(resource => {
    if (resource.extendedProps && resource.extendedProps.iCal && resource.extendedProps.iCal !== 'null') {
      resourcesWithIcal++;
    }
  });
  
  // Count events with iCal
  data.events.forEach(event => {
    if (event.extendedProps && event.extendedProps.iCal && event.extendedProps.iCal !== 'null') {
      eventsWithIcal++;
    }
  });
  
  console.log(`
  ---- Validation Summary ----
  Total resources: ${data.resources.length}
  Resources with iCal URLs: ${resourcesWithIcal}
  Total events: ${data.events.length}
  Events with iCal URLs: ${eventsWithIcal}
  `);
  
  return {
    totalResources: data.resources.length,
    resourcesWithIcal,
    totalEvents: data.events.length,
    eventsWithIcal
  };
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
      if (roomMapping[roomId].iCal && roomMapping[roomId].iCal !== 'null') {
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
      if (roomMapping[roomId].iCal && roomMapping[roomId].iCal !== 'null') {
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

// Main execution function
async function main() {
  try {
    console.log('Starting CSV processing with iCal integration...');
    await processAndMergeCSVs();
    console.log('Process completed successfully!');
  } catch (error) {
    console.error('Error in main process:', error);
    console.error(error.stack);
  }
}

// Run the script
main();