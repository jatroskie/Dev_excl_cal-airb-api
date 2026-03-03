/**
 * Function to sync TBA room availability to Airbnb using Playwright
 */
const { chromium } = require('playwright');
const { roomMapping } = require('./updated-room-mapping');

/**
 * Synchronize unavailable dates from TBA to Airbnb
 * @param {Object} availabilityTracker - RoomAvailabilityTracker instance
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Results of the synchronization
 */
async function syncTBAtoAirbnb(availabilityTracker, options = {}) {
  const {
    headless = false,
    airbnbEmail = process.env.AIRBNB_EMAIL,
    airbnbPassword = process.env.AIRBNB_PASSWORD,
    dryRun = false,
    specificRoomIds = null // If provided, only sync these rooms
  } = options;
  
  // Track results
  const results = {
    success: [],
    failure: [],
    skipped: []
  };
  
  // Get all rooms that should be synced
  const roomsToSync = getRoomsToSync(specificRoomIds);
  
  if (roomsToSync.length === 0) {
    console.log('No rooms to sync');
    return results;
  }
  
  console.log(`Preparing to sync ${roomsToSync.length} rooms`);
  
  // If it's a dry run, just collect the data without updating Airbnb
  if (dryRun) {
    console.log('DRY RUN: No changes will be made to Airbnb');
    
    roomsToSync.forEach(room => {
      const unavailableDates = getUnavailableDatesForRoom(availabilityTracker, room.id);
      results.success.push({
        roomId: room.id,
        airbnbId: room.airbnbId,
        unavailableDates,
        message: `Would sync ${unavailableDates.length} unavailable dates`
      });
    });
    
    return results;
  }
  
  // Launch browser for real run
  console.log('Launching browser...');
  const browser = await chromium.launch({ 
    headless,
    slowMo: 100 // Slow down operations for reliability
  });
  
  try {
    // Login to Airbnb once
    const page = await loginToAirbnb(browser, airbnbEmail, airbnbPassword);
    
    // Process each room
    for (const room of roomsToSync) {
      try {
        console.log(`Processing room ${room.id} (Airbnb: ${room.airbnbId})...`);
        
        // Get unavailable dates for this room
        const unavailableDates = getUnavailableDatesForRoom(availabilityTracker, room.id);
        
        if (unavailableDates.length === 0) {
          console.log(`No unavailable dates found for room ${room.id}`);
          results.skipped.push({
            roomId: room.id,
            airbnbId: room.airbnbId,
            message: 'No unavailable dates'
          });
          continue;
        }
        
        // Navigate to property calendar
        await navigateToPropertyCalendar(page, room.airbnbId);
        
        // Mark dates as unavailable
        await markDatesAsUnavailable(page, unavailableDates);
        
        // Record success
        results.success.push({
          roomId: room.id,
          airbnbId: room.airbnbId,
          unavailableDates,
          message: `Successfully synced ${unavailableDates.length} unavailable dates`
        });
        
        console.log(`Successfully synced room ${room.id}`);
      } catch (error) {
        console.error(`Error syncing room ${room.id}:`, error);
        
        // Record failure
        results.failure.push({
          roomId: room.id,
          airbnbId: room.airbnbId,
          error: error.message
        });
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    await browser.close();
  }
  
  // Log summary
  console.log('\nSync Summary:');
  console.log(`- Successfully synced: ${results.success.length} rooms`);
  console.log(`- Failed to sync: ${results.failure.length} rooms`);
  console.log(`- Skipped: ${results.skipped.length} rooms\n`);
  
  return results;
}

/**
 * Get rooms that should be synced
 * @param {Array} specificRoomIds - Optional array of room IDs to sync
 * @returns {Array} - Array of room objects to sync
 */
function getRoomsToSync(specificRoomIds = null) {
  const rooms = [];
  
  Object.entries(roomMapping).forEach(([roomId, details]) => {
    // Only include rooms that:
    // 1. Have a valid airbnbId
    // 2. Are part of TBA property
    // 3. Match the specific room IDs if provided
    if (
      details.airbnbId && 
      details.property === 'TBA' &&
      (!specificRoomIds || specificRoomIds.includes(roomId))
    ) {
      rooms.push({
        id: roomId,
        airbnbId: details.airbnbId,
        title: details.airbnbTitle
      });
    }
  });
  
  return rooms;
}

/**
 * Get unavailable dates for a specific room
 * @param {Object} availabilityTracker - RoomAvailabilityTracker instance
 * @param {string} roomId - Room ID
 * @returns {Array} - Array of unavailable date strings
 */
function getUnavailableDatesForRoom(availabilityTracker, roomId) {
  // Get the room's availability map
  const roomMap = availabilityTracker.availabilityMap.get(roomId);
  
  if (!roomMap) {
    console.error(`Room ID ${roomId} not found in availability tracker`);
    return []; // Room not found
  }
  
  // Collect all unavailable dates
  const unavailableDates = [];
  roomMap.forEach((isAvailable, date) => {
    if (!isAvailable) {
      unavailableDates.push(date);
    }
  });
  
  return unavailableDates;
}

/**
 * Log in to Airbnb
 * @param {Object} browser - Playwright browser instance
 * @param {string} email - Airbnb login email
 * @param {string} password - Airbnb login password
 * @returns {Object} - Playwright page object
 */
async function loginToAirbnb(browser, email, password) {
  console.log('Logging in to Airbnb...');
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto('https://www.airbnb.com/login');
    
    // Wait for the page to load
    await page.waitForSelector('input[name="email"]');
    
    // Enter email and continue
    await page.fill('input[name="email"]', email);
    await page.click('button[data-testid="signup-login-submit-btn"]');
    
    // Wait for password field and enter password
    await page.waitForSelector('input[name="password"]');
    await page.fill('input[name="password"]', password);
    
    // Submit login form
    await page.click('button[data-testid="signup-login-submit-btn"]');
    
    // Wait for successful login
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    console.log('Successfully logged in to Airbnb');
    return page;
  } catch (error) {
    console.error('Failed to log in to Airbnb:', error);
    throw error;
  }
}

/**
 * Navigate to a property's calendar page
 * @param {Object} page - Playwright page object
 * @param {string} propertyId - Airbnb property ID
 */
async function navigateToPropertyCalendar(page, propertyId) {
  console.log(`Navigating to calendar for property ${propertyId}...`);
  
  try {
    // Go to hosting dashboard
    await page.goto('https://www.airbnb.com/hosting/listings');
    
    // Wait for listings to load
    await page.waitForSelector('[data-testid="listing-card"]', { timeout: 30000 });
    
    // Find the specific property by ID and click manage link
    // Note: Selectors might need adjustment based on Airbnb's actual DOM structure
    const propertySelector = `[data-listing-id="${propertyId}"]`;
    await page.waitForSelector(propertySelector, { timeout: 10000 });
    
    // Click on manage for this property
    const manageLink = await page.locator(propertySelector).locator('a:has-text("Manage")').first();
    await manageLink.click();
    
    // Navigate to the calendar section
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    await page.goto(`https://www.airbnb.com/hosting/listings/${propertyId}/calendar`);
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-table"]', { timeout: 30000 });
    
    console.log(`Successfully navigated to calendar for property ${propertyId}`);
  } catch (error) {
    console.error(`Failed to navigate to property calendar for ${propertyId}:`, error);
    throw error;
  }
}

/**
 * Mark dates as unavailable on Airbnb calendar
 * @param {Object} page - Playwright page object
 * @param {Array} dates - Array of date strings to mark as unavailable
 */
async function markDatesAsUnavailable(page, dates) {
  if (!dates || dates.length === 0) {
    console.log('No dates to mark as unavailable');
    return;
  }
  
  console.log(`Marking ${dates.length} dates as unavailable...`);
  
  try {
    // Group consecutive dates into ranges for more efficient updating
    const dateRanges = groupConsecutiveDates(dates);
    
    for (const range of dateRanges) {
      // Select the start date
      await selectCalendarDate(page, range.start);
      
      if (range.start !== range.end) {
        // If it's a range, select the end date
        await selectCalendarDate(page, range.end, true);
      }
      
      // Click "Block" or "Unavailable" button (may vary based on Airbnb's UI)
      await page.click('button:has-text("Block")');
      
      // Wait for confirmation dialog and confirm
      await page.waitForSelector('button:has-text("Save")');
      await page.click('button:has-text("Save")');
      
      // Wait for update to complete
      await page.waitForSelector('.update-success-message, .calendar-update-success', {
        timeout: 10000,
        state: 'visible'
      }).catch(() => console.log('No success message shown, but continuing...'));
      
      // Add a small delay between operations
      await page.waitForTimeout(1000);
    }
    
    console.log('Successfully marked dates as unavailable');
  } catch (error) {
    console.error('Failed to mark dates as unavailable:', error);
    throw error;
  }
}

/**
 * Select a date on the calendar
 * @param {Object} page - Playwright page object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {boolean} isEndDate - Whether this is the end date of a range
 */
async function selectCalendarDate(page, dateStr, isEndDate = false) {
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();
    
    // Navigate to the correct month/year if needed
    await navigateToYearMonth(page, year, month);
    
    // Click on the date
    // This selector may need to be adjusted based on Airbnb