# Setup Guide: iCal to Firestore with Airbnb Scraping

This guide walks you through setting up an automated system to sync your Airbnb and Booking.com calendars to Firestore and extract guest information.

## Prerequisites

- Node.js (v14+)
- Firebase project with Firestore enabled
- Airbnb and Booking.com iCal URLs for your properties
- Airbnb host account credentials (for scraping additional information)

## Installation

1. **Create a new project folder:**
   ```
   mkdir property-calendar-sync
   cd property-calendar-sync
   ```

2. **Initialize a Node.js project:**
   ```
   npm init -y
   ```

3. **Install required dependencies:**
   ```
   npm install firebase-admin node-ical axios puppeteer node-cron express ejs
   ```

4. **Set up Firebase Service Account:**
   - Go to the Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file
   - Rename it to `firebase-service-account.json` and place it in your project folder

5. **Create project files:**
   - Copy the code from the provided artifacts into separate files:
     - `ical-firestore-sync.js`
     - `firestore-setup.js`
     - `reservation-dashboard.js`

6. **Create views folder for the dashboard:**
   ```
   mkdir -p views public/css public/js
   ```

7. **Create a basic dashboard template (views/dashboard.ejs):**
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title><%= title %></title>
     <link rel="stylesheet" href="/css/styles.css">
   </head>
   <body>
     <header>
       <h1>Property Reservations Dashboard</h1>
       <button id="sync-button">Sync Now</button>
     </header>
     
     <main>
       <section class="filters">
         <div>
           <label for="property-select">Property:</label>
           <select id="property-select">
             <option value="all">All Properties</option>
             <option value="27-bellair">27 Bellair</option>
           </select>
         </div>
         
         <div>
           <label for="date-from">From:</label>
           <input type="date" id="date-from">
         </div>
         
         <div>
           <label for="date-to">To:</label>
           <input type="date" id="date-to">
         </div>
         
         <button id="filter-button">Apply Filters</button>
       </section>
       
       <section class="reservations">
         <table id="reservations-table">
           <thead>
             <tr>
               <th>Property</th>
               <th>Source</th>
               <th>Check-in</th>
               <th>Check-out</th>
               <th>Guest</th>
               <th>Contact</th>
               <th>Details</th>
             </tr>
           </thead>
           <tbody id="reservations-body">
             <!-- Reservations will be loaded here -->
           </tbody>
         </table>
       </section>
     </main>
     
     <script src="/js/dashboard.js"></script>
   </body>
   </html>
   ```

8. **Create a basic dashboard JS file (public/js/dashboard.js):**
   ```javascript
   document.addEventListener('DOMContentLoaded', function() {
     // Load reservations on page load
     loadReservations();
     
     // Set up event listeners
     document.getElementById('sync-button').addEventListener('click', triggerSync);
     document.getElementById('filter-button').addEventListener('click', loadReservations);
     
     // Function to load reservations
     function loadReservations() {
       const propertySelect = document.getElementById('property-select');
       const dateFrom = document.getElementById('date-from');
       const dateTo = document.getElementById('date-to');
       
       // Build query params
       const params = new URLSearchParams();
       if (propertySelect.value !== 'all') {
         params.append('property', propertySelect.value);
       }
       if (dateFrom.value) {
         params.append('startDate', dateFrom.value);
       }
       if (dateTo.value) {
         params.append('endDate', dateTo.value);
       }
       
       // Fetch reservations
       fetch(`/api/reservations?${params.toString()}`)
         .then(response => response.json())
         .then(data => {
           displayReservations(data.reservations);
         })
         .catch(error => {
           console.error('Error loading reservations:', error);
         });
     }
     
     // Function to display reservations
     function displayReservations(reservations) {
       const tbody = document.getElementById('reservations-body');
       tbody.innerHTML = '';
       
       if (reservations.length === 0) {
         const row = document.createElement('tr');
         row.innerHTML = '<td colspan="7" style="text-align: center;">No reservations found</td>';
         tbody.appendChild(row);
         return;
       }
       
       // Sort reservations by start date
       reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
       
       reservations.forEach(reservation => {
         const row = document.createElement('tr');
         
         // Format dates
         const startDate = new Date(reservation.start).toLocaleDateString();
         const endDate = new Date(reservation.end).toLocaleDateString();
         
         // Get guest info
         const guestName = reservation.guestInfo?.fullName || 'Not available';
         const guestContact = reservation.guestInfo?.phoneNumber || 
                             (reservation.description.includes('Phone Number') ? 
                              'Last digits: ' + reservation.description.match(/Phone Number \(Last 4 Digits\): (\d+)/)?.[1] : 
                              'Not available');
         
         row.innerHTML = `
           <td>${reservation.propertyId}</td>
           <td>${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}</td>
           <td>${startDate}</td>
           <td>${endDate}</td>
           <td>${guestName}</td>
           <td>${guestContact}</td>
           <td>
             ${reservation.reservationId ? 
               `<a href="https://www.airbnb.com/hosting/reservations/details/${reservation.reservationId}" target="_blank">View</a>` : 
               'N/A'}
           </td>
         `;
         
         tbody.appendChild(row);
       });
     }
     
     // Function to trigger manual sync
     function triggerSync() {
       const syncButton = document.getElementById('sync-button');
       syncButton.disabled = true;
       syncButton.textContent = 'Syncing...';
       
       fetch('/api/sync', {
         method: 'POST'
       })
         .then(response => response.json())
         .then(data => {
           alert('Sync started successfully. This may take a few minutes.');
           setTimeout(() => {
             syncButton.disabled = false;
             syncButton.textContent = 'Sync Now';
             loadReservations();
           }, 5000);
         })
         .catch(error => {
           console.error('Error triggering sync:', error);
           syncButton.disabled = false;
           syncButton.textContent = 'Sync Now';
           alert('Error starting sync');
         });
     }
   });
   ```

9. **Create a basic CSS file (public/css/styles.css):**
   ```css
   body {
     font-family: Arial, sans-serif;
     margin: 0;
     padding: 0;
     line-height: 1.6;
   }
   
   header {
     background-color: #f4f4f4;
     padding: 1rem;
     display: flex;
     justify-content: space-between;
     align-items: center;
   }
   
   main {
     padding: 1rem;
   }
   
   .filters {
     display: flex;
     gap: 1rem;
     margin-bottom: 1rem;
     padding: 1rem;
     background-color: #f9f9f9;
     border-radius: 4px;
   }
   
   table {
     width: 100%;
     border-collapse: collapse;
   }
   
   table th, table td {
     padding: 0.5rem;
     border: 1px solid #ddd;
     text-align: left;
   }
   
   table th {
     background-color: #f4f4f4;
   }
   
   button {
     padding: 0.5rem 1rem;
     cursor: pointer;
     background-color: #4CAF50;
     color: white;
     border: none;
     border-radius: 4px;
   }
   
   button:hover {
     background-color: #45a049;
   }
   
   button:disabled {
     background-color: #cccccc;
     cursor: not-allowed;
   }
   ```

## Configuration

1. **Update the configuration in `ical-firestore-sync.js`:**
   - Replace `YOUR_AIRBNB_ICAL_ID` with your actual Airbnb iCal ID
   - Replace `YOUR_BOOKING_ICAL_ID` with your actual Booking.com iCal ID
   - Update the email and password for your Airbnb account
   - Add more properties as needed

2. **Configure the Firestore schema:**
   ```
   node firestore-setup.js
   ```

## Running the System

1. **Start the dashboard and sync service:**
   ```
   node reservation-dashboard.js
   ```

2. **Access the dashboard:**
   Open your browser and navigate to `http://localhost:3000`

3. **For production deployment:**
   - Consider running as a service using PM2 or similar
   - Set up proper authentication for the dashboard
   - Store credentials securely using environment variables

## Customization Options

### Adding WhatsApp Notifications

To add WhatsApp notifications when new reservations are detected:

1. Install the WhatsApp Business API Client or use a service like Twilio
2. Add a notification function to the `processAndStoreEvents` function in `ical-firestore-sync.js`

### Extracting More Detailed Information

To extract more detailed guest information:

1. Update the Puppeteer scraping function with more specific selectors
2. Add additional fields to the Firestore schema

### Setting Up as a Cloud Function

To run this as a Firebase Cloud Function:

1. Initialize a Firebase Cloud Functions project
2. Move the sync logic to scheduled functions
3. Update the dashboard to use Firebase Hosting

## Troubleshooting

- **iCal Parsing Issues:** Double-check your iCal URLs and ensure they're publicly accessible
- **Scraping Failures:** Puppeteer selectors may need updates if Airbnb changes their website structure
- **Firebase Permissions:** Ensure your service account has the necessary permissions

## Security Considerations

- **Store credentials securely** using environment variables
- **Implement authentication** for the dashboard
- **Use Firestore security rules** to protect your reservation data
- **Consider rate limiting** for the Airbnb scraping to avoid account flags
