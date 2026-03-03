// firestore-setup.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Define the Firestore schema for reservations
async function setupFirestoreSchema() {
  try {
    // Create the reservations collection with an initial document to ensure it exists
    await db.collection('reservations').doc('_schema').set({
      description: 'Collection for property reservations from Airbnb and Booking.com',
      fields: {
        propertyId: 'String - Unique identifier for the property',
        source: 'String - airbnb or booking',
        summary: 'String - Event summary from iCal',
        start: 'ISO String - Reservation start date/time',
        end: 'ISO String - Reservation end date/time',
        description: 'String - Original description from iCal',
        reservationId: 'String - Platform-specific reservation ID',
        guestInfo: 'Object - Additional guest information (name, phone, email)',
        created: 'ISO String - When this record was created',
        updated: 'ISO String - When this record was last updated'
      }
    });

    // Create indexes for common queries
    // Note: Firestore indexes are usually created in the Firebase console or using firebase.json
    console.log('Firestore schema setup complete.');
    
    // You would typically create indexes for:
    // - propertyId, start (for finding upcoming reservations for a property)
    // - source, start (for finding all upcoming reservations from a specific source)
    
  } catch (error) {
    console.error(`Error setting up Firestore schema: ${error.message}`);
  }
}

// Create a test document to validate the schema
async function createTestReservation() {
  try {
    const testData = {
      propertyId: '27-bellair',
      source: 'airbnb',
      summary: 'Reserved',
      start: new Date('2025-03-23').toISOString(),
      end: new Date('2025-04-01').toISOString(),
      description: 'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMZPRSD5KH Phone Number (Last 4 Digits): 8579',
      reservationId: 'HMZPRSD5KH',
      guestInfo: {
        fullName: 'Test Guest',
        phoneNumber: '+1234567890',
        email: 'guest@example.com'
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    await db.collection('reservations').doc('test-reservation').set(testData);
    console.log('Test reservation created successfully.');
  } catch (error) {
    console.error(`Error creating test reservation: ${error.message}`);
  }
}

// Run setup functions
async function runSetup() {
  await setupFirestoreSchema();
  await createTestReservation();
  console.log('Firestore setup completed.');
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  runSetup();
}

module.exports = {
  setupFirestoreSchema,
  createTestReservation
};
