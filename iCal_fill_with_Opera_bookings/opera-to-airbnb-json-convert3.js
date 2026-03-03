// This script is a Node.js script that reads Opera JSON data, processes it to extract rooms with Airbnb listings and their reservations, 
// and generates iCal files for each room. It also hosts these iCal files via a simple web server for easy access and sharing.
// Opera to Airbnb iCal Sync - JavaScript Version
// no longer using the calendar - sending icals to a new hosted site for each room.
// This script requires the 'ical-generator' package to generate iCal files.
// To install the package, run: npm install ical-generator
// The script also uses the built-in 'http' module to create a simple web server for hosting iCal files.
// The script assumes that the Opera JSON data file is available at a specific path and that the iCal files will be stored in a specific directory.



const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// Fix the ical-generator import
const { default: ical } = require('ical-generator');

// Configuration with absolute paths to avoid directory issues
const config = {
  // Path to your Opera JSON data file
  operaDataPath: path.join(__dirname, 'opera_data.json'),
  
  // Directory to store generated iCal files
  icalOutputDir: path.join(__dirname, 'ical_files'),
  
  // Web server config for hosting iCal files
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  }
};

// Function to load Opera data from JSON file
function loadOperaData() {
  try {
    // Check if file exists before trying to read it
    if (!fs.existsSync(config.operaDataPath)) {
      throw new Error(`Opera data file not found at: ${config.operaDataPath}`);
    }
    
    const data = fs.readFileSync(config.operaDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading Opera data:', error.message);
    throw error;
  }
}

// Function to extract rooms with Airbnb listings and their reservations
function processOperaData(data) {
  const rooms = {};
  
  // Process resources (rooms)
  if (data.resources && Array.isArray(data.resources)) {
    data.resources.forEach(room => {
      // Only process rooms that have an Airbnb URL
      if (room.extendedProps && room.extendedProps.url && room.extendedProps.url !== "null") {
        rooms[room.id] = {
          id: room.id,
          roomNumber: room.extendedProps.roomNumber,
          roomType: room.extendedProps.roomType,
          property: room.extendedProps.property,
          airbnbUrl: room.extendedProps.url,
          reservations: []
        };
      }
    });
  }
  
  // Process events (reservations)
  if (data.events && Array.isArray(data.events)) {
    data.events.forEach(event => {
      const roomId = event.resourceId;
      
      // Skip if room has no Airbnb URL or reservation is cancelled
      if (!rooms[roomId] || (event.classNames && event.classNames.includes('reservation-cancelled'))) {
        return;
      }
      
      // Add reservation to the room
      rooms[roomId].reservations.push({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        status: event.extendedProps?.status || 'Unknown',
        confirmationNumber: event.extendedProps?.confirmationNumber || '',
        adults: event.extendedProps?.adults || '1',
        children: event.extendedProps?.children || '0'
      });
    });
  }
  
  // Convert to array and filter out rooms with no Airbnb URL or no reservations
  return Object.values(rooms).filter(room => 
    room.airbnbUrl && room.airbnbUrl !== 'null' && room.reservations.length > 0
  );
}

// Function to create iCal files for each room
function createIcalFiles(rooms) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(config.icalOutputDir)) {
    fs.mkdirSync(config.icalOutputDir, { recursive: true });
  }
  
  const icals = {};
  
  rooms.forEach(room => {
    // Create a compound identifier that includes property and room number
    const roomIdentifier = `${room.property}-${room.roomNumber}`;
    
    // Create a new calendar for this room
    const calendar = ical({
      name: `${room.property} Room ${room.roomNumber} (${room.roomType})`,
      prodId: `-//Opera-Airbnb-Sync//${roomIdentifier}//EN`,
      timezone: 'Africa/Johannesburg'
    });
    
    // Add each reservation as a busy/unavailable event
    room.reservations.forEach(reservation => {
      calendar.createEvent({
        start: new Date(reservation.start),
        end: new Date(reservation.end),
        summary: `Booked: ${reservation.status}`,
        description: `Reservation #${reservation.confirmationNumber}\nGuests: ${reservation.adults} adults, ${reservation.children} children`,
        uid: `${reservation.id}@opera-sync`,
        busystatus: 'BUSY'  // Mark the time as busy/unavailable in calendars
      });
    });
    
    // Generate filename based on property and room number
    const filename = `${roomIdentifier}.ics`;
    const filePath = path.join(config.icalOutputDir, filename);
    
    // Write calendar to file
    fs.writeFileSync(filePath, calendar.toString());
    
    // Store iCal info for web server
    icals[roomIdentifier] = {
      filename,
      filePath,
      url: `http://${config.server.host}:${config.server.port}/${filename}`,
      airbnbUrl: room.airbnbUrl,
      room: room
    };
    
    console.log(`Generated iCal for ${roomIdentifier} with ${room.reservations.length} reservations`);
  });
  
  return icals;
}

// Function to host iCal files via web server
function hostIcalFiles(icals) {
  const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname.substring(1); // Remove leading slash
    
    if (pathname === '' || pathname === 'index.html') {
      // Generate a simple index page with links to all iCal files
      const roomIds = Object.keys(icals).sort();
      const links = roomIds.map(roomId => {
        const ical = icals[roomId];
        const room = ical.room;
        return `
          <tr>
            <td>${room.property}</td>
            <td>${room.roomNumber}</td>
            <td>${room.roomType}</td>
            <td><a href="${ical.filename}" target="_blank">${ical.filename}</a></td>
            <td><a href="${ical.airbnbUrl}" target="_blank">Airbnb Listing</a></td>
            <td>
              <ol>
                <li>Go to your Airbnb listing</li>
                <li>Click "Calendar" → "Availability settings"</li>
                <li>Under "Sync calendars", click "Import calendar"</li>
                <li>Enter this URL: <code>${ical.url}</code></li>
              </ol>
            </td>
          </tr>
        `;
      }).join('');
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Opera to Airbnb iCal Sync</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
              ol { margin: 0; padding-left: 20px; }
            </style>
          </head>
          <body>
            <h1>Opera to Airbnb iCal Sync</h1>
            <p>Below are the iCal feeds for each room. Use these URLs to sync your Airbnb calendars.</p>
            <p><strong>Last updated:</strong> ${new Date().toLocaleString()}</p>
            <table>
              <tr>
                <th>Property</th>
                <th>Room</th>
                <th>Type</th>
                <th>iCal File</th>
                <th>Airbnb Listing</th>
                <th>Instructions</th>
              </tr>
              ${links}
            </table>
          </body>
        </html>
      `);
    } else if (Object.values(icals).some(ical => ical.filename === pathname)) {
      // Serve the requested iCal file
      const filePath = path.join(config.icalOutputDir, pathname);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('File not found');
          return;
        }
        
        res.writeHead(200, {
          'Content-Type': 'text/calendar',
          'Content-Disposition': `attachment; filename="${pathname}"`
        });
        res.end(data);
      });
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
  });
  
  server.listen(config.server.port, () => {
    console.log(`iCal server running at http://${config.server.host}:${config.server.port}/`);
    console.log('Access this URL to see all available iCal feeds');
  });
}

// Main function
async function syncOperaToAirbnb() {
  try {
    // 1. Load Opera data from JSON file
    const operaData = loadOperaData();
    console.log('Successfully loaded Opera data');
    
    // 2. Process data to extract rooms and reservations
    const rooms = processOperaData(operaData);
    console.log(`Processed ${rooms.length} rooms with Airbnb listings`);
    
    // 3. Create iCal files for each room
    const icals = createIcalFiles(rooms);
    
    // 4. Host iCal files via web server
    hostIcalFiles(icals);
    
    console.log('Sync process completed successfully');
    
    return {
      roomsProcessed: rooms.length,
      totalReservations: rooms.reduce((sum, room) => sum + room.reservations.length, 0)
    };
  } catch (error) {
    console.error('Sync process failed:', error);
    throw error;
  }
}

// Helper function to save Opera JSON data to a file (can be used to save data from API)
function saveOperaData(jsonData, filePath = config.operaDataPath) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    console.log(`Opera data saved to ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error saving Opera data:', error.message);
    return false;
  }
}

// Run the sync process
syncOperaToAirbnb().then(stats => {
  console.log(`Sync completed for ${stats.roomsProcessed} rooms with ${stats.totalReservations} reservations`);
}).catch(error => {
  console.error('Sync process error:', error);
});

// To run this as a scheduled task, you can use setInterval:
// Example of running every 6 hours:
// setInterval(syncOperaToAirbnb, 6 * 60 * 60 * 1000);
