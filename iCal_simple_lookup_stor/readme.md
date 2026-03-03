# iCal Availability Lookup

This script fetches availability data from Airbnb iCal feeds for your properties and generates a JSON file containing booking and availability information.

## Setup

1. Convert the fixed resources array to a proper JSON file:

```javascript
// save-resources.js
const fs = require('fs');
const resources = [ /* Copy the entire resources array here */ ];
fs.writeFileSync('fixed-resources.json', JSON.stringify(resources, null, 2));
```

Run this script once to create the JSON file:
```bash
node save-resources.js
```

2. Install dependencies:

```bash
npm init -y
npm install axios node-ical
```

3. Run the script:

```bash
node ical-availability-script.js
```

## Features

- Fetches iCal data for the 27Bellair property (or all properties with iCal feeds)
- Parses the iCal feed to extract booking information
- Generates a 6-month availability calendar
- Marks dates as available or unavailable
- Identifies check-in and check-out dates
- Saves availability data as structured JSON

## Output Format

The script generates a JSON file with the following structure:

```json
{
  "property": {
    "id": "27Bellair",
    "title": "27Bellair-2-BR",
    "roomNumber": "27Bellair",
    "roomType": "2-BR",
    "url": "airbnb.co.za/h/27bellair"
  },
  "lastUpdated": "2025-03-17T15:30:45.123Z",
  "bookings": [
    {
      "start": "2025-03-20",
      "end": "2025-03-25",
      "summary": "Booked"
    },
    // Additional bookings...
  ],
  "availability": {
    "2025-03-17": {
      "date": "2025-03-17",
      "available": true,
      "booking": null
    },
    "2025-03-20": {
      "date": "2025-03-20",
      "available": false,
      "booking": {
        "checkIn": true,
        "checkOut": false,
        "summary": "Booked"
      }
    },
    // Additional dates...
  }
}
```

## Processing All Properties

To process all properties with iCal feeds, uncomment the `processAllProperties()` line at the end of the script. This will create an `all-properties-availability.json` file with availability data for all properties.
