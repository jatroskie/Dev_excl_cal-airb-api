// parser.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function parseDate(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('.');
  return `${yyyy}-${mm}-${dd}`;
}

function getStatusClass(status) {
  if (status.includes('Cancelled')) return ['reservation-cancelled'];
  if (status.includes('Non - Guarantee')) return ['reservation-nonguarantee'];
  if (status.includes('Guaranteed')) return ['reservation-guaranteed'];
  if (status.includes('Checked Out')) return [];
  return [];
}

async function parseCSVsToJSON(roomsFile, downloadsDir, property = 'WFV') {
  const rooms = fs.readFileSync(roomsFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const resources = [];
  const events = [];
  const roomTypes = {}; // Cache roomType per room from CSVs

  for (const room of rooms) {
    const csvPath = path.join(downloadsDir, `${room}.csv`);
    if (!fs.existsSync(csvPath)) continue;

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', row => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length > 0) {
      roomTypes[room] = rows[0]['Room Type'] || 'Unknown';
    }

    rows.forEach(row => {
      if (!row.Arrival || !row.Departure) return;
      const start = parseDate(row.Arrival);
      const end = parseDate(row.Departure);
      const id = `${row['Confirmation Number']}_${property}-${room}_${start}_${end}`;
      events.push({
        id,
        resourceId: `${property}-${room}`,
        title: row.Name || 'NO NAME',
        start,
        end,
        classNames: getStatusClass(row['Reservation Status'] || row.Status || ''),
        extendedProps: {
          fileName: `${room}.csv`,
          confirmationNumber: row['Confirmation Number'],
          roomNumber: room,
          roomType: roomTypes[room],
          status: row['Reservation Status'] || row.Status || 'Unknown',
          nights: row.Nights,
          adults: row.Adults,
          children: row.Children,
          rate: row.Rate,
          source: row.Source,
          travelAgent: row['Travel Agent'],
          property,
          url: null, // As per your note, null for WFV
          iCal: null,
          lastUpdated: new Date().toISOString()
        }
      });
    });
  }

  rooms.forEach(room => {
    resources.push({
      id: `${property}-${room}`,
      title: `${room}-${roomTypes[room] || 'Unknown'}`,
      extendedProps: {
        roomNumber: room,
        roomType: roomTypes[room] || 'Unknown',
        property,
        url: null,
        iCal: null
      }
    });
  });

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const json = { resources, events };
  const jsonPath = path.join(downloadsDir, `WFV_${timestamp.slice(0,8)}_${timestamp.slice(8)}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  return jsonPath;
}

module.exports = { parseCSVsToJSON };