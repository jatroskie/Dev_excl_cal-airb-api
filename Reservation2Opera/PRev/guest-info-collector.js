// guest-info-collector.js
const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Function to update guest information manually
async function updateGuestInfo(reservationId, guestInfo) {
  try {
    // Query for the reservation by reservationId
    const querySnapshot = await db.collection('reservations')
      .where('reservationId', '==', reservationId)
      .limit(1)
      .get();
    
    if (querySnapshot.empty) {
      console.error(`No reservation found with ID: ${reservationId}`);
      return false;
    }
    
    // Update the reservation with the new guest info
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      guestInfo: guestInfo,
      needsGuestInfo: false,
      updated: new Date().toISOString()
    });
    
    console.log(`Updated guest information for reservation: ${reservationId}`);
    return true;
  } catch (error) {
    console.error(`Error updating guest information: ${error.message}`);
    return false;
  }
}

// Function to list reservations that need guest info
async function listReservationsNeedingGuestInfo() {
  try {
    const querySnapshot = await db.collection('reservations')
      .where('needsGuestInfo', '==', true)
      .orderBy('start')
      .get();
    
    if (querySnapshot.empty) {
      console.log('No reservations need guest information.');
      return [];
    }
    
    const reservations = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      reservations.push({
        id: doc.id,
        reservationId: data.reservationId || 'N/A',
        source: data.source,
        property: data.propertyId,
        start: new Date(data.start).toLocaleDateString(),
        end: new Date(data.end).toLocaleDateString(),
        partialPhone: data.partialPhone || 'N/A'
      });
    });
    
    console.log('\n=== Reservations Needing Guest Information ===');
    reservations.forEach((res, index) => {
      console.log(`${index + 1}. ${res.property} | ${res.source} | ${res.start} to ${res.end} | Res ID: ${res.reservationId} | Phone: ${res.partialPhone}`);
    });
    
    return reservations;
  } catch (error) {
    console.error(`Error listing reservations: ${error.message}`);
    return [];
  }
}

// Parse email content to extract guest information
function parseEmailContent(emailContent) {
  const guestInfo = {
    fullName: null,
    phoneNumber: null,
    email: null,
    source: 'email'
  };
  
  // Example patterns to extract information from the email
  const namePattern = /Guest name:?\s+([^\n]+)/i;
  const phonePattern = /Phone:?\s+([^\n]+)/i;
  const emailPattern = /Email:?\s+([^\n]+)/i;
  
  const nameMatch = emailContent.match(namePattern);
  if (nameMatch && nameMatch[1]) {
    guestInfo.fullName = nameMatch[1].trim();
  }
  
  const phoneMatch = emailContent.match(phonePattern);
  if (phoneMatch && phoneMatch[1]) {
    guestInfo.phoneNumber = phoneMatch[1].trim();
  }
  
  const emailMatch = emailContent.match(emailPattern);
  if (emailMatch && emailMatch[1]) {
    guestInfo.email = emailMatch[1].trim();
  }
  
  return guestInfo;
}

// Interactive CLI for updating guest information
async function runCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== 27 Bellair Guest Information Collector ===\n');
  
  // Main menu function
  async function showMainMenu() {
    console.log('\nMAIN MENU:');
    console.log('1. List reservations needing guest information');
    console.log('2. Update guest information manually');
    console.log('3. Update guest information from email file');
    console.log('4. Exit');
    
    rl.question('\nSelect an option (1-4): ', async (answer) => {
      switch (answer) {
        case '1':
          await listReservationsNeedingGuestInfo();
          showMainMenu();
          break;
          
        case '2':
          updateGuestManually();
          break;
          
        case '3':
          updateGuestFromEmail();
          break;
          
        case '4':
          rl.close();
          process.exit(0);
          break;
          
        default:
          console.log('Invalid option, please try again.');
          showMainMenu();
      }
    });
  }
  
  // Function to manually update guest info
  function updateGuestManually() {
    rl.question('\nEnter reservation ID: ', (reservationId) => {
      if (!reservationId) {
        console.log('Reservation ID is required.');
        showMainMenu();
        return;
      }
      
      rl.question('Enter guest name: ', (name) => {
        rl.question('Enter guest phone number: ', (phone) => {
          rl.question('Enter guest email: ', async (email) => {
            const guestInfo = {
              fullName: name || 'Not provided',
              phoneNumber: phone || 'Not provided',
              email: email || 'Not provided',
              source: 'manual entry'
            };
            
            const success = await updateGuestInfo(reservationId, guestInfo);
            if (success) {
              console.log('Guest information updated successfully!');
            }
            showMainMenu();
          });
        });
      });
    });
  }
  
  // Function to update guest info from email file
  function updateGuestFromEmail() {
    rl.question('\nEnter path to email file: ', (filePath) => {
      if (!filePath) {
        console.log('File path is required.');
        showMainMenu();
        return;
      }
      
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file: ${err.message}`);
          showMainMenu();
          return;
        }
        
        const guestInfo = parseEmailContent(data);
        console.log('\nExtracted information:');
        console.log(`Name: ${guestInfo.fullName || 'Not found'}`);
        console.log(`Phone: ${guestInfo.phoneNumber || 'Not found'}`);
        console.log(`Email: ${guestInfo.email || 'Not found'}`);
        
        rl.question('\nEnter reservation ID to update: ', async (reservationId) => {
          if (!reservationId) {
            console.log('Reservation ID is required.');
            showMainMenu();
            return;
          }
          
          const success = await updateGuestInfo(reservationId, guestInfo);
          if (success) {
            console.log('Guest information updated successfully!');
          }
          showMainMenu();
        });
      });
    });
  }
  
  // Start the CLI
  showMainMenu();
}

// If run directly
if (require.main === module) {
  runCLI();
}

// Export functions for use in other modules
module.exports = {
  updateGuestInfo,
  listReservationsNeedingGuestInfo,
  parseEmailContent
};
