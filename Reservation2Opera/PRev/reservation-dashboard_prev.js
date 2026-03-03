// reservation-dashboard.js
const express = require('express');
const admin = require('firebase-admin');
const { syncCalendars } = require('./ical-firestore-sync');
const path = require('path');

console.log('Starting server initialization...');

// Initialize Firebase Admin SDK if not already initialized
try {
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase...');
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized successfully');
  } else {
    console.log('Firebase already initialized');
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // Log the error but don't crash the application
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Main dashboard route
app.get('/', async (req, res) => {
  try {
    res.render('dashboard', {
      title: 'Property Reservations Dashboard'
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API route to get all reservations
app.get('/api/reservations', async (req, res) => {
  try {
    const { property, startDate, endDate, needsGuestInfo } = req.query;
    let query = db.collection('reservations');
    
    // Filter by property if provided
    if (property && property !== 'all') {
      query = query.where('propertyId', '==', property);
    }
    
    // Filter by guest info needed status if provided
    if (needsGuestInfo === 'true') {
      query = query.where('needsGuestInfo', '==', true);
    } else if (needsGuestInfo === 'false') {
      query = query.where('needsGuestInfo', '==', false);
    }
    
    // Get results
    const snapshot = await query.get();
    let reservations = [];
    
    snapshot.forEach(doc => {
      // Skip schema document
      if (doc.id === '_schema') return;
      
      reservations.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Filter by date range if provided (doing this in memory since we can't combine it with other queries)
    if (startDate) {
      const startDateObj = new Date(startDate).toISOString();
      reservations = reservations.filter(r => r.start >= startDateObj);
    }
    
    if (endDate) {
      const endDateObj = new Date(endDate).toISOString();
      reservations = reservations.filter(r => r.start <= endDateObj);
    }
    
    // Sort by check-in date
    reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    res.json({ reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// API route to trigger manual sync
app.post('/api/sync', async (req, res) => {
  try {
    // Start the sync process
    syncCalendars()
      .then(() => console.log('Manual sync completed'))
      .catch(error => console.error('Error in manual sync:', error));
    
    // Respond immediately without waiting for completion
    res.json({ message: 'Sync started successfully' });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

// API route to get a single reservation
app.get('/api/reservations/:id', async (req, res) => {
  try {
    const docRef = db.collection('reservations').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json({
      id: doc.id,
      ...doc.data()
    });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

// API route to update guest information
app.post('/api/reservations/:id/guestInfo', async (req, res) => {
  try {
    const docRef = db.collection('reservations').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    const { fullName, phoneNumber, email, notes } = req.body;
    
    await docRef.update({
      guestInfo: {
        fullName: fullName || 'Not provided',
        phoneNumber: phoneNumber || 'Not provided',
        email: email || 'Not provided',
        notes: notes || '',
        source: 'manual entry',
        updatedAt: new Date().toISOString()
      },
      needsGuestInfo: false,
      updated: new Date().toISOString()
    });
    
    res.json({ message: 'Guest information updated successfully' });
  } catch (error) {
    console.error('Error updating guest information:', error);
    res.status(500).json({ error: 'Failed to update guest information' });
  }
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});