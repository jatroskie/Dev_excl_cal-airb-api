// proxy-server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint for iCal feeds
app.get('/proxy-ical', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    console.log(`Fetching iCal data from: ${url}`);
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Calendar/1.0)'
      }
    });
    
    // Set appropriate content type for iCal data
    res.set('Content-Type', 'text/calendar');
    res.send(response.data);
    console.log(`Successfully proxied iCal data from ${url}`);
  } catch (error) {
    console.error(`Error fetching iCal data: ${error.message}`);
    res.status(500).send(`Error fetching iCal data: ${error.message}`);
  }
});

// Endpoint to map room IDs to iCal URLs
app.get('/api/room-ical-mappings', (req, res) => {
  // This would typically come from a database
  // For now, we'll use a hardcoded example
  const mappings = {
    // Example: Map Airbnb listings to room IDs in your system
    'Room101': 'https://www.airbnb.com/calendar/ical/12345.ics',
    'Room102': 'https://www.airbnb.com/calendar/ical/67890.ics',
    // Add more mappings as needed
  };
  
  res.json(mappings);
});

// Admin endpoint to update room-to-iCal mappings
app.post('/api/room-ical-mappings', express.json(), (req, res) => {
  // In a production app, this would update a database
  // For demo purposes, we just acknowledge the request
  console.log('Received mapping update:', req.body);
  res.json({ success: true, message: 'Mappings received (demo only)' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
