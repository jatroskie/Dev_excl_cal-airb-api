// Description: This script processes CSV files downloaded from the FC Room Diary
// and merges them into a single JSON file for use in a FullCalendar scheduler.
// It also adds additional properties to the resources and events based on a room mapping.
// The script includes iCal URLs from the fixed-resources file.

const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

// Room mapping with Airbnb URLs and iCal references
const roomMapping = {
  // STU-BALC
  "0302": {
    airbnbId: "B302",
    airbnbTitle: "Fabulous studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview302",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1248396969254246587.ics?s=f215a94176d9ae47f5df44f1a81d5ce0"
  },
  "0303": {
    airbnbId: "B303",
    airbnbTitle: "Spectacular studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview303",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1247731029392182354.ics?s=9b0c6e03ab2210297ba5ab3ec90dd22a"
  },
  "0400": {
    airbnbId: "B400",
    airbnbTitle: "Fabulous views in trendy Breë",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview400",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1209304586053489362.ics?s=1e6f02ef61b5172628143028a3769a45"
  },
  "0401": {
    airbnbId: "B401",
    airbnbTitle: "Fabulous spacious apartment!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview401",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1228303256651219056.ics?s=5d0e220d38a54ce3fb6df27fe8ce4002"
  },
  "0402": {
    airbnbId: "B402",
    airbnbTitle: "Absolutely fabulous personified!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview402",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1228276893037734445.ics?s=daa1d92d478d2eb70388545833ae1bcd"
  },
  "0501": {
    airbnbId: "B501",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview501",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1248669755951945227.ics?s=e197c90f042c9dae11ca3f39e30b99a3"
  },
  "0502": {
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null,
    iCal: null
  },
  "0503": {
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null,
    iCal: null
  },
  "0514": {
    airbnbId: "B514",
    airbnbTitle: "Fun studio with balcony in Bree",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview514",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1221693800160287643.ics?s=2972a50a8e4277c45de99ad553033944"
  },
  // STU-URB
  "0304": {
    airbnbId: "B404",
    airbnbTitle: "Spacious studio, great views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview404",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1231797570482523951.ics?s=a9794695b377f7350d83c7d2cb195996"
  },
  "0307": {
    airbnbId: "B307",
    airbnbTitle: "Sublime studio with everything!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview307",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1231301095469221059.ics?s=a8d15a54340c17c23d67ce537e5e9977"
  },
  "0309": {
    airbnbId: "B309",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview309",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1229590273883233451.ics?s=714b2c07dac299d78ce0d5c739ea63b0"
  },
  "0312": {
    airbnbId: "B312",
    airbnbTitle: "Spacious studio with living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview312",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1231279072193286203.ics?s=287ac4863e3e1f46f57e48a365c128d5"
  },
  "0319": {
    airbnbId: "B319",
    airbnbTitle: "Sunny 1 bed great views & decor",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview319",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1212358372296730196.ics?s=4c1a84bb707478eb99ccefa8e64f5418"
  },
  "0321": {
    airbnbId: "B321",
    airbnbTitle: "Sunny studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview321",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1221657676388110334.ics?s=b91f16ef14ad7a9bafea0e41d9c78939"
  },
  "0323": {
    airbnbId: "B323",
    airbnbTitle: "Spacious sunny studio with views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview323",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1221670892542894285.ics?s=a4412a8c4b354b8cf4168a80db584c6c"
  },
  "0407": {
    airbnbId: "B407",
    airbnbTitle: "Spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview407",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1224994790515851136.ics?s=6d5a2a29d3c96c219acb3d7bec827a39"
  },
  "0408": {
    airbnbId: "B408",
    airbnbTitle: "Splendid spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview408",
    property: "TBA",
    iCal: null
  },
  "0411": {
    airbnbId: "B411",
    airbnbTitle: "Super studio with sep living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview411",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1231608210658786295.ics?s=1d6e40be7bfe32941e397554e9a4ee0e"
  },
  "0420": {
    airbnbId: "B420",
    airbnbTitle: "Sunny studio with fabulous views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview420",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1221716931721025193.ics?s=8e77b0f039b0131646b2e8bba07b7613"
  },
  // 1-BR
  "0315": {
    airbnbId: "B315",
    airbnbTitle: "Fab 1 bed with balcony and views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview315",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1231204448340426544.ics?s=0b15075180678b7f4477f25990715f46"
  },
  "0317": {
    airbnbId: "B317",
    airbnbTitle: "Great 1 bed with balcony & views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview317",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1212347449286873783.ics?s=9ed8f1213f87e4ac6d8d4cdad35f32c2"
  },
  "0413": {
    airbnbId: "B413",
    airbnbTitle: "Fabulous 1 bed with balcony & views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview413",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1263658461196930695.ics?s=e38ca36ecfd41ee3ddecccba5a07eb65"
  },
  "0415": {
    airbnbId: "S415",
    airbnbTitle: "Sunny spacious 1 bed with views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityviews415",
    property: "TTBH",
    iCal: null
  },
  // STU-LUX
  "0504": {
    airbnbId: "B504",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview504",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1228322903507358655.ics?s=a9c396912f768aa93dce5a780d604656"
  },
  "0506": {
    airbnbId: "B506",
    airbnbTitle: "City Views with all the comfort",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview506",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1211317367250046383.ics?s=e697fbd4bf85f9e0a8583afb02c7a697"
  },
  "0507": {
    airbnbId: "B507",
    airbnbTitle: "Stunning studio with views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview507",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1228676934909732817.ics?s=456467007b241e83f2be7cd79b9627a4"
  },
  "0520": {
    airbnbId: "B520",
    airbnbTitle: "Sunny studio & fabulous views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview520",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1211338228155057949.ics?s=5da0b66c3496167c283f944dbbe872e0"
  },
  // 2-BR
  "0515": {
    airbnbId: "B515",
    airbnbTitle: "Fabulous finishes, views & space!",
    roomType: "2-BR",
    url: "airbnb.co.za/h/cityview515",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1212401688791962038.ics?s=a7ad362d416504edfe75243967dd35d5"
  },
  // Additional rooms - waterfront
  "G102": {
    airbnbId: "G102",
    airbnbTitle: "Exceptional Waterfront Living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g102",
    property: "WFV",
    iCal: "https://www.airbnb.co.za/calendar/ical/1225013720851311501.ics?s=73dd16813e2b3ef9384dad4d124a4146"
  },
  "G205": {
    airbnbId: "G205",
    airbnbTitle: "Fabulous waterfront lifestyle!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g205",
    property: "WFV",
    iCal: "https://www.airbnb.co.za/calendar/ical/1226585159048320019.ics?s=70d25ff88df21f8312fdb415c3e1e41c"
  },
  "H003": {
    airbnbId: "H003",
    airbnbTitle: "Fabulous waterfront living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-h003",
    property: "WFV",
    iCal: "https://www.airbnb.co.za/calendar/ical/1227248080634159829.ics?s=42d357bf612c32b2252a315df53c7007"
  },
  // Additional rooms from fixed-resources.js
  "0513": {
    airbnbId: "B513",
    airbnbTitle: "Spacious 2 bedroom with views",
    roomType: "2-BR",
    url: "airbnb.co.za/h/cityview513",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1273908503357043458.ics?s=1a06935ca97d1e8b2b0dd27c957c1c17"
  },
  "F104": {
    airbnbId: "F104",
    airbnbTitle: "Luxurious 1 bedroom waterfront",
    roomType: "1-BR-LUX",
    url: "airbnb.co.za/h/cityviewf104",
    property: "WFV",
    iCal: "https://www.airbnb.co.za/calendar/ical/1329019802755184020.ics?s=83627472021f5ce790143912e980b7ea"
  },
  "T202": {
    airbnbId: "T202",
    airbnbTitle: "Cozy studio in trendy neighborhood",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt202",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1299153500898642202.ics?s=f21e30c5e9ebe69b7b1b884e96b037de"
  },
  "T302": {
    airbnbId: "T302",
    airbnbTitle: "Modern studio with great amenities",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt302",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1299131184723668977.ics?s=f8b8471b20585596355433c5e8917082"
  },
  "B514A": {
    airbnbId: "B514A",
    airbnbTitle: "Studio with balcony in great location",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview514a",
    property: "TBA",
    iCal: null
  },
  "T201": {
    airbnbId: "T201",
    airbnbTitle: "Comfortable studio in central location",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt201",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1297713377500685821.ics?s=2bb58758919cb021889cd34ae98ef5af"
  },
  "T103": {
    airbnbId: "T103",
    airbnbTitle: "Cozy studio in popular area",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt103",
    property: "TBA",
    iCal: "https://www.airbnb.co.za/calendar/ical/1307158669123962781.ics?s=99b697fbb9630732dc0e7fc811c45249"
  },
  "T203": {
    airbnbId: "T203",
    airbnbTitle: "Bright studio with modern amenities",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt203",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1299242518045151769.ics?s=e90c4376880650ea2e6a23639b509490"
  },
  "T101": {
    airbnbId: "T101",
    airbnbTitle: "Stylish studio in great location",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt101",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1296318897242601996.ics?s=329bdf26c26000e7a733af4bae51f6e0"
  },
  "T303": {
    airbnbId: "T303",
    airbnbTitle: "Urban studio with city access",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt303",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1299108896114505703.ics?s=323521320504e019cf4f4949431019b7"
  },
  "T301": {
    airbnbId: "T301",
    airbnbTitle: "Contemporary studio with amenities",
    roomType: "STU",
    url: "airbnb.co.za/h/cityviewt301",
    property: "TTBH",
    iCal: "https://www.airbnb.co.za/calendar/ical/1299362489926115061.ics?s=cdceccff4ca15474352fc4bb3eb8f7d5"
  },
  "27Bellair": {
    airbnbId: "27Bellair",
    airbnbTitle: "Spacious 2 bedroom apartment",
    roomType: "2-BR",
    url: "airbnb.co.za/h/27bellair",
    property: "NOTTPF",
    iCal: "https://www.airbnb.co.za/calendar/ical/1228276893037734445.ics?s=daa1d92d478d2eb70388545833ae1bcd"
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
    
    // Get URL and iCal from room mapping if available
    const roomData = roomMapping[roomId.trim()];
    const url = roomData ? roomData.url : null;
    const iCal = roomData ? roomData.iCal : null;
    
    // Create the new unique ID combining property and room number
    const roomTrimmed = roomId.trim();
    const uniqueResourceId = `${property}-${roomTrimmed}`;
    
    if (!roomsMap.has(uniqueResourceId)) {
      roomsMap.set(uniqueResourceId, {
        id: uniqueResourceId, // New unique ID format: property-room
        title: `${roomTrimmed}-${roomType}`, // Keep the original title format
        extendedProps: { 
          roomNumber: roomTrimmed, // Store the original room number
          roomType: roomType,
          property: property,
          url: url,  // Adding URL to resource extended properties
          iCal: iCal // Adding iCal to resource extended properties
        }
      });
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
        
        events.push({
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
            iCal: iCal, // Adding iCal to event extended properties
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
    // If resource already exists, make sure we preserve iCal if it exists
    if (resourceMap.has(resource.id)) {
      const existingResource = resourceMap.get(resource.id);
      // If the existing resource has iCal but new one doesn't, keep the existing iCal
      if (existingResource.extendedProps.iCal && (!resource.extendedProps.iCal || resource.extendedProps.iCal === null)) {
        resource.extendedProps.iCal = existingResource.extendedProps.iCal;
      }
    }
    
    // Get iCal from roomMapping if available
    const roomNumber = resource.extendedProps.roomNumber;
    if (roomNumber && roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
      resource.extendedProps.iCal = roomMapping[roomNumber].iCal;
    }
    
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
      
      // If the existing event has iCal but new one doesn't, keep the existing iCal
      if (existingEvent.extendedProps.iCal && 
          (!event.extendedProps.iCal || event.extendedProps.iCal === null)) {
        event.extendedProps.iCal = existingEvent.extendedProps.iCal;
      }
      
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
      
      // If the event is associated with a room that has an iCal in roomMapping
      const roomNumber = event.extendedProps.roomNumber;
      if (roomNumber && roomMapping[roomNumber] && roomMapping[roomNumber].iCal) {
        event.extendedProps.iCal = roomMapping[roomNumber].iCal;
      }
      
      eventMap.set(event.id, event);
    }
  });
  
  //