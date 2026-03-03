// server.js - Server for Property Reservations Dashboard
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Sample data for the reservations API
let reservationsData = {
  reservations: [
    {
      id: "r1001",
      propertyId: "WFV",
      source: "booking.com",
      start: "2025-03-22",
      end: "2025-03-27",
      guestInfo: {
        fullName: "John Smith",
        phoneNumber: "555-123-4567",
        email: "john.smith@example.com",
        notes: "Arriving late, after 8pm"
      },
      needsGuestInfo: false,
      operaConfirmation: "OP-12345",
      reservationUrl: "https://example.com/booking/12345"
    },
    {
      id: "r1002",
      propertyId: "WFV",
      source: "airbnb",
      start: "2025-04-01",
      end: "2025-04-05",
      guestInfo: null,
      needsGuestInfo: true,
      partialPhone: "7890",
      operaConfirmation: "",
      reservationUrl: "https://example.com/airbnb/7890"
    },
    {
      id: "r1003",
      propertyId: "CRY",
      source: "expedia",
      start: "2025-03-25",
      end: "2025-03-30",
      guestInfo: {
        fullName: "Jane Doe",
        phoneNumber: "555-987-6543",
        email: "jane.doe@example.com",
        notes: ""
      },
      needsGuestInfo: false,
      operaConfirmation: "OP-67890",
      reservationUrl: "https://example.com/expedia/67890"
    },
    {
      id: "r1004",
      propertyId: "HES",
      source: "direct",
      start: "2025-04-10",
      end: "2025-04-15",
      guestInfo: null,
      needsGuestInfo: true,
      operaConfirmation: "",
      reservationUrl: null
    },
    {
      id: "r1005",
      propertyId: "LAW",
      source: "booking.com",
      start: "2025-03-18",
      end: "2025-03-22",
      guestInfo: {
        fullName: "Robert Johnson",
        phoneNumber: "555-555-5555",
        email: "robert.j@example.com",
        notes: "Needs extra towels"
      },
      needsGuestInfo: false,
      operaConfirmation: "OP-34567",
      reservationUrl: "https://example.com/booking/34567"
    },
    {
      id: "r1006",
      propertyId: "MPA",
      source: "airbnb",
      start: "2025-04-05",
      end: "2025-04-12",
      guestInfo: null,
      needsGuestInfo: true,
      partialPhone: "1122",
      operaConfirmation: "",
      reservationUrl: "https://example.com/airbnb/1122"
    },
    {
      id: "r1007",
      propertyId: "TBA",
      source: "expedia",
      start: "2025-03-15",
      end: "2025-03-20",
      guestInfo: {
        fullName: "Alice Williams",
        phoneNumber: "555-222-3333",
        email: "alice.w@example.com",
        notes: ""
      },
      needsGuestInfo: false,
      operaConfirmation: "OP-45678",
      reservationUrl: "https://example.com/expedia/45678"
    },
    {
      id: "r1008",
      propertyId: "TQA",
      source: "direct",
      start: "2025-04-15",
      end: "2025-04-20",
      guestInfo: null,
      needsGuestInfo: true,
      operaConfirmation: "",
      reservationUrl: null
    },
    {
      id: "r1009",
      propertyId: "TTBH",
      source: "booking.com",
      start: "2025-03-20",
      end: "2025-03-25",
      guestInfo: {
        fullName: "Mark Brown",
        phoneNumber: "555-444-7777",
        email: "mark.b@example.com",
        notes: "Business traveler"
      },
      needsGuestInfo: false,
      operaConfirmation: "OP-56789",
      reservationUrl: "https://example.com/booking/56789"
    }
  ]
};

// Property sync status tracking
const propertySyncStatus = {};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the public directory exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}
if (!fs.existsSync(path.join(__dirname, 'public/css'))) {
  fs.mkdirSync(path.join(__dirname, 'public/css'));
}
if (!fs.existsSync(path.join(__dirname, 'public/js'))) {
  fs.mkdirSync(path.join(__dirname, 'public/js'));
}

// Copy the static files to the public directory on server start
// Copy index.html
try {
  fs.writeFileSync(
    path.join(__dirname, 'public', 'index.html'),
    fs.readFileSync(path.join(__dirname, 'dashboard.html'))
  );
} catch (error) {
  console.error('Error copying dashboard.html:', error);
}

// Copy CSS
try {
  fs.writeFileSync(
    path.join(__dirname, 'public/css', 'dashboard.css'),
    fs.readFileSync(path.join(__dirname, 'dashboard.css'))
  );
} catch (error) {
  console.error('Error copying dashboard.css:', error);
}

// Copy JS
try {
  fs.writeFileSync(
    path.join(__dirname, 'public/js', 'dashboard.js'),
    fs.readFileSync(path.join(__dirname, 'dashboard.js'))
  );
} catch (error) {
  console.error('Error copying dashboard.js:', error);
}

// API Routes

// Get reservations with optional filters
app.get('/api/reservations', (req, res) => {
  let filteredReservations = [...reservationsData.reservations];
  
  // Apply property filter
  if (req.query.property) {
    filteredReservations = filteredReservations.filter(
      r => r.propertyId === req.query.property
    );
  }
  
  // Apply date filters
  if (req.query.startDate) {
    const startDate = new Date(req.query.startDate);
    filteredReservations = filteredReservations.filter(
      r => new Date(r.start) >= startDate
    );
  }
  
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    filteredReservations = filteredReservations.filter(
      r => new Date(r.end) <= endDate
    );
  }
  
  // Apply guest info filter
  if (req.query.needsGuestInfo === 'true') {
    filteredReservations = filteredReservations.filter(
      r => r.needsGuestInfo === true
    );
  } else if (req.query.needsGuestInfo === 'false') {
    filteredReservations = filteredReservations.filter(
      r => r.needsGuestInfo === false
    );
  }
  
  res.json({ reservations: filteredReservations });
});

// Get a specific reservation
app.get('/api/reservations/:id', (req, res) => {
  const reservation = reservationsData.reservations.find(
    r => r.id === req.params.id
  );
  
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  res.json(reservation);
});

// Update guest info for a reservation
app.post('/api/reservations/:id/guestInfo', (req, res) => {
  const { fullName, phoneNumber, email, notes } = req.body;
  const reservationId = req.params.id;
  
  const reservationIndex = reservationsData.reservations.findIndex(
    r => r.id === reservationId
  );
  
  if (reservationIndex === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  // Update the reservation
  reservationsData.reservations[reservationIndex].guestInfo = {
    fullName,
    phoneNumber,
    email,
    notes
  };
  reservationsData.reservations[reservationIndex].needsGuestInfo = false;
  
  res.json({ success: true, message: 'Guest information updated successfully' });
});

// Trigger sync for a property or all properties
app.post('/api/sync', (req, res) => {
  const propertyId = req.body.propertyId;
  
  if (propertyId) {
    // Sync for a specific property
    propertySyncStatus[propertyId] = {
      lastSync: new Date().toISOString(),
      status: 'success'
    };
    
    res.json({
      success: true,
      message: `Sync started for property ${propertyId}`,
      syncTime: propertySyncStatus[propertyId].lastSync
    });
  } else {
    // Sync for all properties
    const uniquePropertyIds = [...new Set(reservationsData.reservations.map(r => r.propertyId))];
    
    uniquePropertyIds.forEach(id => {
      propertySyncStatus[id] = {
        lastSync: new Date().toISOString(),
        status: 'success'
      };
    });
    
    res.json({
      success: true,
      message: 'Sync started for all properties',
      syncTime: new Date().toISOString()
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}`);
});
