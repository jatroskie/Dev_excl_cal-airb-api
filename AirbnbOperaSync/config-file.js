// Airbnb Availability Updater Configuration

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
  
  // Delay between actions to avoid being flagged as bot (in milliseconds)
  actionDelay: 1000,
  
  // Enable headless mode for production use
  headless: false, // Set to true for server usage
  
  // Set to false to actually update Airbnb (true = simulation only)
  dryRun: true,
  
  // Log level: 'debug', 'info', 'warn', 'error'
  logLevel: 'info',
  
  // Enable taking screenshots for debugging
  screenshots: true,
  
  // Screenshot directory
  screenshotDir: './screenshots',
  
  // Date format used by Airbnb in your locale (for parsing calendar dates)
  dateFormat: 'MMMM D, YYYY', // e.g., "March 15, 2025"
  
  // Only process specific rooms (leave empty to process all)
  // Example: ['0302', '0303', '0304']
  specificRooms: []
};
