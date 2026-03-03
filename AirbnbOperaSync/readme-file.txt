 Airbnb Availability Updater

This tool automatically updates your Airbnb listing availability based on your hotel reservation system data. It reads booking information from your calendar-data.json file and marks corresponding dates as "Blocked" on Airbnb.

## Features

- Reads hotel reservations from your calendar-data.json file
- Maps hotel room numbers to Airbnb listings
- Automatically logs in to Airbnb
- Updates availability for each listing
- Handles batch processing to avoid overloading
- Provides detailed logging and error reporting
- Supports dry-run mode for testing without making changes

## Prerequisites

- Node.js (v14 or later)
- Playwright
- A valid Airbnb host account
- An up-to-date calendar-data.json file from your hotel system

## Installation

1. Clone this repository or download the files
2. Install dependencies:

```bash
npm install playwright
```

3. Update the configuration in `config.js` with your Airbnb credentials and other settings

## Configuration

The `config.js` file contains all settings for the updater:

```javascript
module.exports = {
  // Path to your calendar-data.json file
  calendarDataPath: 'C:\\Users\\jatro\\Dev\\fcRoomDiary\\calendar-data.json',
  
  // Airbnb login credentials
  airbnbEmail: 'your.email@example.com',
  airbnbPassword: 'your-password',
  
  // Date range to update
  updateDays: 180, // Update availability for the next 6 months
  
  // How many listings to update in one run
  batchSize: 5,
  
  // Delay between actions (in milliseconds)
  actionDelay: 1000,
  
  // Enable headless mode for production use
  headless: false, // Set to true for server usage
  
  // Set to false to actually update Airbnb (true = simulation only)
  dryRun: true
};
```

## Room Mapping

The script uses a mapping between your hotel room numbers and Airbnb listings. This mapping is defined in the `roomMapping` object in the main script.

Each entry maps a hotel room number to:
- `airbnbId`: The Airbnb listing ID/room number
- `airbnbTitle`: The title of the Airbnb listing
- `roomType`: The room type category
- `url`: The Airbnb listing URL

## Usage

1. Make sure your calendar-data.json file is up to date
2. Update the configuration in config.js
3. Run the script:

```bash
node airbnb-availability-updater.js
```

4. Check the console output for results and any errors

## Dry Run Mode

By default, the script runs in "dry run" mode, which means it will simulate updating Airbnb but won't actually make any changes. This is useful for testing.

To actually update Airbnb, set `dryRun: false` in config.js.

## Scheduling Regular Updates

You can set up a cron job or scheduled task to run this script regularly:

### Using cron (Linux/Mac):

```bash
# Run every day at 2 AM
0 2 * * * cd /path/to/script && node airbnb-availability-updater.js >> /path/to/logfile.log 2>&1
```

### Using Task Scheduler (Windows):

1. Open Task Scheduler
2. Create a new Basic Task
3. Set the trigger (e.g., Daily at 2 AM)
4. Set the action to "Start a program"
5. Program/script: `node`
6. Arguments: `C:\path\to\airbnb-availability-updater.js`
7. Complete the wizard

## Troubleshooting

- **Login issues**: Make sure your Airbnb credentials are correct
- **Mapping issues**: Verify the room mapping is correct
- **Calendar data issues**: Check the format of your calendar-data.json file
- **Airbnb website changes**: If Airbnb updates their website, the selectors in the script may need to be updated

## Error Handling

The script will create screenshots when errors occur, which can help with debugging.

## Security Considerations

- Store your Airbnb credentials securely
- Consider using environment variables for sensitive information
- Run the script on a secure machine

## License

MIT

## Author

Your Name

## Acknowledgements

- Uses Playwright for browser automation
- Inspired by the need to sync hotel reservations with Airbnb listings
