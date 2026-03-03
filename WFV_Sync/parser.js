// parser.js - Updated to parse all *-*.csv in downloads, group by property prefix (WFV/LAW), set property in JSON
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

async function parseCSVsToJSON(downloadsDir) {
  const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.csv') && f.includes('-'));
  const resources = [];
  const events = [];
  const roomTypes = {}; // Cache roomType per room/property

  for (const file of files) {
    const [property, room] = file.replace('.csv', '').split('-');
    if (!property || !room) continue;

    const csvPath = path.join(downloadsDir, file);
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', row => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length > 0) {
      roomTypes[`${property}-${room}`] = rows[0]['Room Type'] || 'Unknown';
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
          fileName: file,
          confirmationNumber: row['Confirmation Number'],
          roomNumber: room,
          roomType: roomTypes[`${property}-${room}`],
          status: row['Reservation Status'] || row.Status || 'Unknown',
          nights: row.Nights,
          adults: row.Adults,
          children: row.Children,
          rate: row.Rate,
          source: row.Source,
          travelAgent: row['Travel Agent'],
          property,
          url: null,
          iCal: null,
          lastUpdated: new Date().toISOString()
        }
      });
    });
  }

  // Build resources from unique property-room combos
  const uniqueRooms = [...new Set(files.map(f => f.replace('.csv', '')))];
  uniqueRooms.forEach(prRoom => {
    const [property, room] = prRoom.split('-');
    resources.push({
      id: `${property}-${room}`,
      title: `${room}-${roomTypes[prRoom] || 'Unknown'}`,
      extendedProps: {
        roomNumber: room,
        roomType: roomTypes[prRoom] || 'Unknown',
        property,
        url: null,
        iCal: null
      }
    });
  });

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const json = { resources, events };
  const jsonPath = path.join(downloadsDir, `ALL_${timestamp.slice(0,8)}_${timestamp.slice(8)}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  return jsonPath;
}

module.exports = { parseCSVsToJSON };