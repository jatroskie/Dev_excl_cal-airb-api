# Opera to Airbnb iCal Sync - Complete Operating Manual

## Introduction

This manual provides comprehensive instructions for operating the Opera to Airbnb iCal synchronization system. The system pulls reservation data from Opera Property Management System and makes it available in iCal format for Airbnb to import, ensuring your Airbnb calendar stays synchronized with Opera bookings.

## System Overview

The Opera to Airbnb iCal sync system consists of:

1. A **CSV processing script** that converts Opera CSV exports to JSON
2. A **Firestore database** that stores room and reservation data
3. **Cloud Functions** that provide dynamic iCal endpoints
4. **Static iCal files** hosted on Firebase Hosting
5. **Scripts** to manage the data synchronization process

## Directory Structure

```
fcRoomDiary/                    # CSV processing directory
├── process-csv.js              # CSV processing script
├── app5.js                     # Automated CSV extraction script
├── extractor5.9.1.js           # Helper for CSV extraction
├── login3.js                   # Opera login handler
├── .env                        # Environment file with Opera credentials
├── downloads/                  # Directory for Opera CSV files
├── calendar-data.json          # Processed data
├── opera_data.json             # Same data for opera-sync.js
└── room-mappings.json          # Simplified mapping data

cal-airb-api/                   # Firebase project root
├── firebase.json               # Firebase configuration
├── service-account-key.json    # Firebase credentials
├── opera_data.json             # Your Opera data (from fcRoomDiary)
├── opera-sync.js               # Main sync script
├── generate-static-icals.js    # Static file generator
├── ical-metadata.json          # Generated metadata file (tracks changes)
├── functions/                  # Cloud Functions directory
│   ├── package.json
│   └── index.js                # Cloud Functions code
└── public/                     # Firebase Hosting directory
    ├── index.html              # Main dashboard
    └── static-icals/           # Generated iCal files
        ├── TBA-0302.ics
        ├── TBA-0303.ics
        └── ...
```

## Initial Setup (One-Time)

### 1. Set Up Directory Structure

1. Create necessary directories:
   ```bash
   mkdir -p fcRoomDiary/downloads
   mkdir -p cal-airb-api/public/static-icals
   ```

2. Install required dependencies for CSV processing:
   ```bash
   cd fcRoomDiary
   npm install papaparse fs path
   
   # For automated CSV extraction (optional but recommended)
   npm install playwright dotenv
   ```

3. Install required dependencies for Firebase integration:
   ```bash
   cd ../cal-airb-api
   npm install axios firebase-admin ical-generator
   ```

### 2. Firebase Setup

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase project**:
   ```bash
   cd cal-airb-api
   firebase init
   ```
   Select "Hosting" and "Functions" when prompted.

4. **Create Firebase project configuration**:
   Create `firebase.json` with the following content:
   ```json
   {
     "hosting": {
       "public": "public",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "headers": [
         {
           "source": "**/*.ics",
           "headers": [
             {
               "key": "Content-Type",
               "value": "text/calendar"
             },
             {
               "key": "Content-Disposition",
               "value": "attachment; filename=calendar.ics"
             },
             {
               "key": "Access-Control-Allow-Origin",
               "value": "*"
             }
           ]
         }
       ],
       "rewrites": [
         {
           "source": "/api/**",
           "function": "api"
         }
       ]
     },
     "functions": {
       "source": "functions"
     }
   }
   ```

5. **Get Firebase service account key**:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `service-account-key.json` in your project root

6. **Set up Cloud Functions**:
   ```bash
   cd functions
   npm install express cors ical-generator
   cd ..
   ```

### 3. Create Scripts

1. **Create Required Script Files**:
   - Create these files in your `fcRoomDiary` directory:
     - `process-csv.js`: For processing CSV files (use our updated script)
     - `app5.js`: For automated CSV extraction from Opera
     - `extractor5.9.1.js`: Helper for CSV extraction
     - `login3.js`: Opera login handler
     - `.env`: Environment file with Opera credentials

2. **Add Opera Login Credentials**:
   Create a `.env` file in your `fcRoomDiary` directory with:
   ```
   OPERA_USERNAME=your_opera_username
   OPERA_PASSWORD=your_opera_password
   ```

3. **Create Static File Generator**:
   Create `generate-static-icals.js` in the cal-airb-api project root (see the full script in the original manual).

4. **Create Sync Script**:
   Create `opera-sync.js` in the cal-airb-api project root (see the full script in the original manual).

5. **Deploy to Firebase**:
   ```bash
   firebase deploy
   ```

## Regular Operation (Daily/Weekly)

### 1. Extract Data from Opera

There are two methods to extract data from Opera:

#### Method 1: Automated CSV Extraction with Playwright

This method uses a script to automatically log in to Opera and extract reservation data for multiple rooms.

1. Make sure you have the required dependencies:
   ```bash
   npm install playwright dotenv
   ```

2. Create a `.env` file with your Opera credentials:
   ```
   OPERA_USERNAME=your_username
   OPERA_PASSWORD=your_password
   ```

3. Run the app script with the desired date range:
   ```bash
   node app5.js --extractReservations --downloadCsv --startDate=01.01.2024 --endDate=31.07.2025
   ```

   Or to be prompted for date range:
   ```bash
   node app5.js --extractReservations --downloadCsv --useCustomDates
   ```

4. The script will:
   - Log in to Opera Cloud
   - Search for each room
   - Download reservation data as CSV files to the `downloads` folder
   - Track progress and handle errors automatically

#### Method 2: Manual Export from Opera

If the automated method doesn't work, you can export CSV files manually:

1. Login to Opera PMS and navigate to the Reports section.

2. Export reservation data for each room as CSV files:
   - Select rooms you want to export
   - Choose the date range
   - Export as CSV format
   - Save files to your `fcRoomDiary/downloads` directory

### 2. Process CSV Files

1. Navigate to your CSV processing directory:
   ```bash
   cd fcRoomDiary
   ```

2. Run the CSV processing script:
   ```bash
   node process-csv.js
   ```

3. The script will:
   - Process all CSV files in the `downloads` folder
   - Merge the data with existing information
   - Add iCal references from the room mapping
   - Create/update three files:
     - `calendar-data.json` (main data file)
     - `opera_data.json` (identical data for opera-sync.js)
     - `room-mappings.json` (simplified mapping for reference)

4. Review the console output for any errors or warnings.

### 3. Run the Sync Process

1. Copy or move `opera_data.json` to the cal-airb-api directory if necessary.

2. Navigate to your API project directory:
   ```bash
   cd ../cal-airb-api
   ```

3. Run the sync script:
   ```bash
   node opera-sync.js
   ```

4. The script will automatically:
   - Read the `opera_data.json` file 
   - Upload the Opera data to Firebase Firestore
   - Generate static iCal files for rooms with changes
   - Deploy updated files to Firebase Hosting (if any changes were detected)

5. Monitor the console output for any errors or important messages.

### 4. Airbnb Calendar Sync

Note: Airbnb no longer allows manual calendar imports. The system now uses the iCal URLs obtained from Airbnb's API and stored in your room mapping to sync calendars automatically.

## Data Structure

### Opera Data JSON Format

The system uses the following JSON format:

```json
{
  "resources": [
    {
      "id": "TBA-0302",
      "title": "0302-STU-BALC",
      "extendedProps": {
        "roomNumber": "0302",
        "roomType": "STU-BALC",
        "property": "TBA",
        "url": "airbnb.co.za/h/cityview302",
        "iCal": "https://www.airbnb.co.za/calendar/ical/1248396969254246587.ics?s=f215a94176d9ae47f5df44f1a81d5ce0"
      }
    },
    ...
  ],
  "events": [
    {
      "id": "246346977_TBA-0302_2024-01-21_2024-01-22",
      "resourceId": "TBA-0302",
      "title": "Lethu, Tembalethu",
      "start": "2024-01-21",
      "end": "2024-01-22",
      "classNames": ["reservation-cancelled"],
      "extendedProps": {
        "confirmationNumber": "246346977",
        "roomNumber": "0302",
        "roomType": "STU-BALC",
        "status": "Cancelled",
        "nights": "1",
        "adults": "1",
        "children": "0",
        "property": "TBA",
        "url": "airbnb.co.za/h/cityview302",
        "iCal": "https://www.airbnb.co.za/calendar/ical/1248396969254246587.ics?s=f215a94176d9ae47f5df44f1a81d5ce0"
      }
    },
    ...
  ]
}
```

## Troubleshooting

### CSV Processing Issues

If you encounter issues during CSV processing:

1. Check the CSV file format matches what the script expects
2. Verify that the room numbers in the CSV match those in the room mapping
3. Make sure the CSV files are properly saved in the downloads directory
4. Check for any errors in the console output

### Automated CSV Extraction Issues

If you encounter issues with the automated CSV extraction:

1. **Browser Automation Failures**:
   - Check that Playwright is installed: `npm install playwright`
   - Ensure your .env file has correct Opera credentials
   - Try running with visible browser: `node app5.js --extractReservations --downloadCsv --useCustomDates`

2. **Login Problems**:
   - Check your Opera login credentials in the .env file
   - Look at the screenshots in the downloads folder for clues
   - The login process may be affected by Opera Cloud UI changes

3. **CSV Download Failures**:
   - Check console output for specific error messages
   - Look at error screenshots saved in the downloads folder
   - Try adjusting the date range to a narrower period
   - You can retry specific rooms by modifying the room list in app5.js

4. **Process Always Fails at Same Point**:
   - The script has built-in retry and recovery logic
   - If certain rooms consistently fail, consider skipping them:
     - Modify the room list in app5.js to exclude problematic rooms

### Check iCal File Validity

If Airbnb reports issues with an iCal file:

1. Open the iCal URL in your browser (it should download as a .ics file)
2. Validate the file at https://icalendar.org/validator.html
3. Inspect the content for formatting issues

### Check for Errors in Logs

If the sync process fails:

1. Check Firebase Cloud Functions logs:
   ```bash
   firebase functions:log
   ```

2. Check the console output from the sync script for error messages

### Error: "Cannot GET /simple-ical/TBA-0302.ics"

If you're getting errors when trying to access the iCal files:

1. Make sure the files are being generated correctly in `public/static-icals/`
2. Check that you've deployed the Firebase hosting with `firebase deploy --only hosting`
3. Verify that the file exists in the Firebase Hosting dashboard

### Error: "This site can't be reached" or "ERR_INVALID_RESPONSE"

If you see these errors when trying to access the iCal URLs:

1. Try using the static iCal files instead of the dynamic endpoints
2. Check the Firebase Function logs for errors
3. Ensure your Cloud Function has been deployed correctly

### Generate Static Files Manually

If you need to force regeneration of all static files:

1. Delete the metadata file:
   ```bash
   rm ical-metadata.json
   ```

2. Run the generator script:
   ```bash
   node generate-static-icals.js
   ```

3. Deploy the files:
   ```bash
   firebase deploy --only hosting
   ```

## Reference URLs

- **Firebase Project Console**: https://console.firebase.google.com/project/cal-airb-api/overview
- **Dashboard**: https://cal-airb-api.web.app
- **Cloud Functions URL**: https://us-central1-cal-airb-api.cloudfunctions.net/api
- **Static iCal Base URL**: https://cal-airb-api.web.app/static-icals/

## Maintenance Tasks

### Updating Room Information

If room details change (e.g., Airbnb URLs or iCal references):
1. Update the room mapping in the CSV processing script
2. Run the processing script to generate updated JSON files
3. Run the sync script as usual

### Adding New Rooms

New rooms will be automatically included if they:
1. Appear in the Opera CSV data
2. Have entries in the room mapping with Airbnb URLs and iCal references

### Automating the Complete Process

To automate the entire workflow, you can create a single script that:

1. Extracts data from Opera
2. Processes CSV files
3. Syncs with Firebase
4. Updates Airbnb

**On Windows (Task Scheduler)**:
1. Create a .bat file with:
   ```
   @echo off
   echo Starting Opera to Airbnb sync process...
   
   echo Step 1: Extracting CSV files from Opera...
   cd C:\path\to\fcRoomDiary
   node app5.js --extractReservations --downloadCsv --startDate=01.01.2024 --endDate=31.07.2025
   
   echo Step 2: Processing CSV files...
   node process-csv.js
   
   echo Step 3: Syncing with Firebase and updating Airbnb...
   cd C:\path\to\cal-airb-api
   node opera-sync.js
   
   echo Sync process completed!
   ```

2. Schedule it to run daily or weekly using Windows Task Scheduler

**On Linux/Mac (Cron)**:
```
0 1 * * * cd /path/to/fcRoomDiary && node app5.js --extractReservations --downloadCsv --startDate=01.01.2024 --endDate=31.07.2025 && node process-csv.js && cd /path/to/cal-airb-api && node opera-sync.js >> sync-log.txt 2>&1
```
This will run the complete sync process daily at 1:00 AM.

## How It Works (Technical Details)

### Data Flow

1. **Opera → CSV Files (Automated or Manual)**:
   - Automated: app5.js script logs into Opera and downloads CSV files
   - Manual: Export reservation data from Opera UI as CSV files
   - Both methods save files to the `fcRoomDiary/downloads` directory

2. **CSV → JSON**: 
   - The CSV processing script converts and merges data into JSON files
   - Adds iCal references from room mapping data

3. **JSON → Firestore**: 
   - The `opera-sync.js` script uploads data to Firebase Firestore

4. **Firestore → Static Files**: 
   - The `generate-static-icals.js` script creates iCal files

5. **Static Files → Airbnb**: 
   - Airbnb imports the iCal files to update calendars

### Selective Updates

The system only updates iCal files when necessary:

1. It tracks which rooms have changes using the `ical-metadata.json` file
2. It compares the current reservations with the previously processed ones
3. It only generates new iCal files for rooms with changes
4. It only deploys to Firebase Hosting when at least one file has changed

### Static vs. Dynamic Files

The system provides two options for iCal files:

1. **Static iCal Files** (recommended for Airbnb):
   - Pre-generated and stored in Firebase Hosting
   - More reliable and compatible with Airbnb
   - Available at: `https://cal-airb-api.web.app/static-icals/ROOM-ID.ics`

2. **Dynamic iCal Endpoints** (for testing):
   - Generated on-demand by Cloud Functions
   - Useful for debugging and testing
   - Available at: `https://us-central1-cal-airb-api.cloudfunctions.net/api/simple-ical/ROOM-ID.ics`

## Script Descriptions

### app5.js (Opera CSV Extraction Script)

This script:
- Automates the process of logging into Opera Cloud
- Searches for each room in the system
- Downloads reservation data for each room as CSV files
- Handles errors and retries automatically
- Takes screenshots for debugging in case of errors
- Supports custom date ranges for reservation data
- Can be run with command line arguments or interactive prompts

### extractor5.9.1.js

This script:
- Acts as a helper library for the app5.js script
- Handles the actual interaction with the Opera Cloud interface
- Contains functions for navigating the interface, searching for rooms
- Manages the CSV download process
- Provides session management and error recovery

### login3.js

This script:
- Handles the authentication process for Opera Cloud
- Manages browser initialization and navigation
- Handles various login scenarios and edge cases
- Contains robust error handling for login issues

### process-csv.js (CSV Processing Script)

This script:
- Processes CSV files exported from Opera PMS
- Merges the data with room mapping information
- Adds iCal references from fixed-resources data
- Generates consolidated JSON files for further processing
- Creates multiple output files for different purposes

### opera-sync.js

This script:
- Reads the processed Opera data from `opera_data.json`
- Uploads the data to Firebase via an API endpoint
- Runs the static iCal file generator
- Deploys updated files to Firebase Hosting

### generate-static-icals.js

This script:
- Reads reservation data from Firestore
- Generates static iCal files for rooms with Airbnb URLs
- Only updates files for rooms with changes
- Tracks changes using a metadata file

## Final Notes

- The system is designed to be efficient by only updating iCal files when necessary
- Both static files (for reliability) and dynamic endpoints (for testing) are available
- The static file approach is recommended for Airbnb integration
- Make sure to maintain the system by regularly running the sync process
- Monitor the logs for any errors or issues that might affect the sync process
