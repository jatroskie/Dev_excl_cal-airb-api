// Import the Firebase Admin SDK
// script to add fields to firestore collections
// This script is intended to be run in a Node.js environment
// and requires the Firebase Admin SDK to be installed and configured.
// Ensure you have the Firebase Admin SDK installed:
// npm install firebase-admin
const admin = require('firebase-admin');

// --- IMPORTANT: Replace with the actual path to your service account key file ---
const serviceAccount = require('./service-account-key.json');
// ---------------------------------------------------------------------------

// Initialize the Firebase Admin App
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Optional: Add your databaseURL if needed, usually inferred from the key
        // databaseURL: "https://cal-airb-api.firebaseio.com"
    });
    console.log('Firebase Admin SDK Initialized Successfully.');
} catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    process.exit(1); // Exit if initialization fails
}


// Get a reference to the Firestore database
const db = admin.firestore();

// Get Firestore Timestamp utility
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue; // For serverTimestamp

// --- Sample Data Definitions ---

const sampleProperties = [
    {
        name: "Cozy Beach Cottage",
        propertyCode: "CBC-001",
        description: "A lovely cottage just steps from the beach. Perfect for a weekend getaway.",
        address: {
            street: "12 Beach Road",
            city: "Cape Town",
            province: "Western Cape",
            postalCode: "8001",
            country: "South Africa",
            latitude: -33.9249, // Example coordinates
            longitude: 18.4241,
        },
        pricePerNight: 1200, // Example price in ZAR
        capacity: 4,
        bedrooms: 2,
        bathrooms: 1.5,
        amenities: ["wifi", "kitchen", "tv", "patio", "braai"],
        imageUrls: [
            "https://example.com/images/cottage1.jpg", // Replace with actual URLs later
            "https://example.com/images/cottage2.jpg",
            "https://example.com/images/cottage3.jpg",
        ],
        ownerId: "user-owner-1", // Reference to a sample owner user ID
        isActive: true,
        // createdAt and updatedAt will be set by the server
    },
    {
        name: "Luxury Urban Apartment",
        propertyCode: "LUA-015",
        description: "Modern apartment in the heart of the city with stunning views.",
        address: {
            street: "100 Main Street, Apt 15",
            city: "Johannesburg",
            province: "Gauteng",
            postalCode: "2001",
            country: "South Africa",
            latitude: -26.2041, // Example coordinates
            longitude: 28.0473,
        },
        pricePerNight: 2500, // Example price in ZAR
        capacity: 2,
        bedrooms: 1,
        bathrooms: 1,
        amenities: ["wifi", "kitchen", "aircon", "gym", "pool", "secure parking"],
        imageUrls: [
            "https://example.com/images/apt1.jpg", // Replace with actual URLs later
            "https://example.com/images/apt2.jpg",
        ],
        ownerId: "user-owner-1", // Reference to a sample owner user ID
        isActive: true,
        // createdAt and updatedAt will be set by the server
    },
];

const sampleReservations = [
    // Note: Ideally, propertyId should be the actual Firestore ID generated
    // when adding properties. For this script, we'll use placeholders or
    // the propertyCode, assuming you might query by that later, though
    // linking by actual Firestore ID is best practice.
    {
        propertyId: "PLACEHOLDER_FOR_CBC-001_ID", // ** Replace later **
        propertyCode: "CBC-001",
        propertyName: "Cozy Beach Cottage",
        userId: "user-guest-1", // Reference to a sample guest user ID
        guestName: "Alice Wonderland",
        guestEmail: "alice@example.com",
        guestPhone: "+27820001111",
        startDate: Timestamp.fromDate(new Date("2024-08-10T00:00:00Z")), // Check-in 10th Aug
        endDate: Timestamp.fromDate(new Date("2024-08-15T00:00:00Z")),   // Check-out 15th Aug (booked nights 10,11,12,13,14)
        numberOfGuests: 2,
        totalPrice: 6000, // 1200 * 5 nights
        currency: "ZAR",
        paymentStatus: "paid",
        paymentIntentId: "pi_SAMPLE123abc", // Example Stripe/Paystack ID
        bookingStatus: "confirmed",
        // createdAt will be set by the server
    },
    {
        propertyId: "PLACEHOLDER_FOR_LUA-015_ID", // ** Replace later **
        propertyCode: "LUA-015",
        propertyName: "Luxury Urban Apartment",
        userId: "user-guest-2", // Reference to another sample guest user ID
        guestName: "Bob The Builder",
        guestEmail: "bob@example.com",
        guestPhone: "+27830002222",
        startDate: Timestamp.fromDate(new Date("2024-09-01T00:00:00Z")), // Check-in 1st Sep
        endDate: Timestamp.fromDate(new Date("2024-09-08T00:00:00Z")),   // Check-out 8th Sep
        numberOfGuests: 1,
        totalPrice: 17500, // 2500 * 7 nights
        currency: "ZAR",
        paymentStatus: "pending",
        paymentIntentId: null, // No payment attempted yet
        bookingStatus: "pending_payment",
        // createdAt will be set by the server
    },
];

const sampleUsers = [
    // Use specific IDs that could potentially match Firebase Auth UIDs later
    // Or just use descriptive IDs for seeding purposes.
    {
        id: "user-guest-1", // Custom document ID
        data: {
            email: "alice@example.com",
            displayName: "Alice W.",
            role: "guest",
            // createdAt will be set by the server
        }
    },
    {
        id: "user-guest-2", // Custom document ID
        data: {
            email: "bob@example.com",
            displayName: "Bob B.",
            role: "guest",
            // createdAt will be set by the server
        }
    },
    {
        id: "user-owner-1", // Custom document ID
        data: {
            email: "owner@vprop.co.za", // Example owner email
            displayName: "Property Owner",
            role: "owner",
            // createdAt will be set by the server
        }
    },
];

// --- Function to Add Data ---

async function addData() {
    console.log("Starting Firestore data seeding...");

    // Add Properties
    console.log("\nAdding Properties...");
    const propertyPromises = sampleProperties.map(async (prop) => {
        try {
            const docRef = await db.collection('properties').add({
                ...prop,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`Added property "${prop.name}" with ID: ${docRef.id}`);
            // ** Important **: You might want to store these generated IDs
            // to update the sampleReservations 'propertyId' fields accurately.
            // For simplicity here, we're leaving them as placeholders.
            return { code: prop.propertyCode, id: docRef.id };
        } catch (error) {
            console.error(`Error adding property "${prop.name}":`, error);
            return null;
        }
    });
    const addedProperties = (await Promise.all(propertyPromises)).filter(p => p !== null);
    console.log("Finished adding properties.");

    // Create a map of propertyCode to Firestore ID for linking reservations
    const propertyIdMap = addedProperties.reduce((map, prop) => {
        map[prop.code] = prop.id;
        return map;
    }, {});


    // Add Reservations (Update propertyId using the map)
    console.log("\nAdding Reservations...");
    const reservationPromises = sampleReservations.map(async (res) => {
        const actualPropertyId = propertyIdMap[res.propertyCode];
        if (!actualPropertyId) {
            console.warn(`Skipping reservation for property code ${res.propertyCode} as the property was not found or failed to add.`);
            return;
        }
        try {
             // Replace placeholder with actual ID
            const reservationData = {
                ...res,
                propertyId: actualPropertyId,
                createdAt: FieldValue.serverTimestamp(),
            };
            const docRef = await db.collection('reservations').add(reservationData);
            console.log(`Added reservation for property "${res.propertyName}" (ID: ${docRef.id})`);
        } catch (error) {
            console.error(`Error adding reservation for "${res.propertyName}":`, error);
        }
    });
    await Promise.all(reservationPromises);
    console.log("Finished adding reservations.");


    // Add Users (using specific IDs)
    console.log("\nAdding Users...");
    const userPromises = sampleUsers.map(async (user) => {
        try {
            await db.collection('users').doc(user.id).set({
                ...user.data,
                 createdAt: FieldValue.serverTimestamp(),
            });
            console.log(`Added user with ID: ${user.id} (${user.data.email})`);
        } catch (error) {
            console.error(`Error adding user ID ${user.id}:`, error);
        }
    });
    await Promise.all(userPromises);
    console.log("Finished adding users.");


    console.log("\nFirestore data seeding complete!");
}

// --- Execute the function ---
addData().catch(error => {
    console.error("An error occurred during the data seeding process:", error);
});