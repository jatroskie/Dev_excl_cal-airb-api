const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Room mapping between hotel room numbers and Airbnb listings
const roomMapping = {
  // STU-BALC
  "0302": {
    airbnbId: "B302",
    airbnbTitle: "Fabulous studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview302"
  },
  "0303": {
    airbnbId: "B303",
    airbnbTitle: "Spectacular studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview303"
  },
  "0400": {
    airbnbId: "B400",
    airbnbTitle: "Fabulous views in trendy Breë",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview400"
  },
  "0401": {
    airbnbId: "B401",
    airbnbTitle: "Fabulous spacious apartment!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview401"
  },
  "0402": {
    airbnbId: "B402",
    airbnbTitle: "Absolutely fabulous personified!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview402"
  },
  "0501": {
    airbnbId: "B501",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview501"
  },
  "0502": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null
  },
  "0503": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null
  },
  "0514": {
    airbnbId: "B514",
    airbnbTitle: "Fun studio with balcony in Bree",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview514"
  },

  // STU-URB
  "0304": {
    airbnbId: "B404",
    airbnbTitle: "Spacious studio, great views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview404"
  },
  "0305": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0306": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0307": {
    airbnbId: "B307",
    airbnbTitle: "Sublime studio with everything!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview307"
  },
  "0308": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0309": {
    airbnbId: "B309",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview309"
  },
  "0311": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0312": {
    airbnbId: "B312",
    airbnbTitle: "Spacious studio with living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview312"
  },
  "0313": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0314": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0318": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0319": {
    airbnbId: "B319",
    airbnbTitle: "Sunny 1 bed great views & decor",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview319"
  },
  "0320": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0321": {
    airbnbId: "B321",
    airbnbTitle: "Sunny studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview321"
  },
  "0323": {
    airbnbId: "B323",
    airbnbTitle: "Spacious sunny studio with views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview323"
  },
  "0403": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0404": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0405": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0406": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0407": {
    airbnbId: "B407",
    airbnbTitle: "Spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview407"
  },
  "0408": {
    airbnbId: "B408",
    airbnbTitle: "Splendid spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview408"
  },
  "0409": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0411": {
    airbnbId: "B411",
    airbnbTitle: "Super studio with sep living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview411"
  },
  "0412": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0416": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0417": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0418": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0419": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null
  },
  "0420": {
    airbnbId: "B420",
    airbnbTitle: "Sunny studio with fabulous views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview420"
  },

  // 1-BR
  "0315": {
    airbnbId: "B315",
    airbnbTitle: "Fab 1 bed with balcony and views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview315"
  },
  "0317": {
    airbnbId: "B317",
    airbnbTitle: "Great 1 bed with balcony & views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview317"
  },
  "0413": {
    airbnbId: "B413",
    airbnbTitle: "Fabulous 1 bed with balcony & views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview413"
  },
  "0415": {
    airbnbId: "S415",
    airbnbTitle: "Sunny spacious 1 bed with views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityviews415"
  },

  // STU-LUX
  "0504": {
    airbnbId: "B504",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview504"
  },
  "0506": {
    airbnbId: "B506",
    airbnbTitle: "City Views with all the comfort",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview506"
  },
  "0507": {
    airbnbId: "B507",
    airbnbTitle: "Stunning studio with views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview507"
  },
  "0508": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0509": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0511": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0516": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0517": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0518": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0519": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null
  },
  "0520": {
    airbnbId: "B520",
    airbnbTitle: "Sunny studio & fabulous views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview520"
  },

  // 2-BR
  "0513": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "2-BR",
    url: null
  },
  "0515": {
    airbnbId: "B515",
    airbnbTitle: "Fabulous finishes, views & space!",
    roomType: "2-BR",
    url: "airbnb.co.za/h/cityview515"
  },

  // Additional rooms from PDF not in your room types
  "G102": {
    airbnbId: "G102",
    airbnbTitle: "Exceptional Waterfront Living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g102"
  },
  "G205": {
    airbnbId: "G205",
    airbnbTitle: "Fabulous waterfront lifestyle!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g205"
  },
  "H003": {
    airbnbId: "H003",
    airbnbTitle: "Fabulous waterfront living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-h003"
  }
};

// Config
const CONFIG = {
  // Path to your calendar-data.json file
  calendarDataPath: 'C:\\Users\\jatro\\Dev\\fcRoomDiary\\calendar-data.json',
  
  // Airbnb login credentials
  airbnbEmail: 'your.email@example.com',
  airbnbPassword: 'your-password',
  
  // Date range to update
  updateDays: 180, // Update availability for this many days in the future
  
  // How many listings to update in one run
  batchSize: 5,
  
  // Delay between actions to avoid being flagged as bot (in milliseconds)
  actionDelay: 1000,
  
  // Enable headless mode for production use
  headless: false, // Set to true for server usage
  
  // Set to false to actually update Airbnb (true = simulation only)
  dryRun: true
};

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper function to add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to format "March 15, 2025" for comparison with Airbnb's date format
function formatDateForAirbnb(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Process the calendar data to determine availability for each room
async function processCalendarData() {
  // Load the calendar data
  console.log(`Loading calendar data from ${CONFIG.calendarDataPath}`);
  const data = await fs.readFile(CONFIG.calendarDataPath, 'utf8');
  const calendarData = JSON.parse(data);
  
  // Create availability object for each room
  const availability = {};
  
  // Process each event in the calendar data
  calendarData.events.forEach(event => {
    const roomId = event.resourceId;
    
    // Skip if this room isn't in our mapping or doesn't have Airbnb info
    if (!roomMapping[roomId] || !roomMapping[roomId].airbnbId) {
      return;
    }
    
    // Initialize room availability if not already done
    if (!availability[roomId]) {
      availability[roomId] = {};
    }
    
    // Mark dates as unavailable
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    
    // Loop through dates and mark as unavailable
    // Note: In reservation systems, end date is typically checkout date (available)
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateString = formatDate(currentDate);
      availability[roomId][dateString] = 'blocked';
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return availability;
}

// Update Airbnb availability for all mapped rooms
async function updateAirbnbAvailability(availability) {
  console.log('Starting Airbnb availability update process...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: CONFIG.headless,
    slowMo: 500 // Slow down operations to make them more visible and avoid detection
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    // Login to Airbnb
    await loginToAirbnb(page);
    
    // Process rooms in batches
    const rooms = Object.keys(availability).filter(roomId => 
      roomMapping[roomId] && roomMapping[roomId].airbnbId
    );
    
    console.log(`Found ${rooms.length} rooms with mappings to update on Airbnb`);
    
    // Process in batches
    for (let i = 0; i < rooms.length; i += CONFIG.batchSize) {
      const batch = rooms.slice(i, i + CONFIG.batchSize);
      console.log(`Processing batch ${Math.floor(i/CONFIG.batchSize) + 1} of ${Math.ceil(rooms.length/CONFIG.batchSize)}`);
      
      for (const roomId of batch) {
        const roomInfo = roomMapping[roomId];
        const roomAvailability = availability[roomId];
        
        await updateRoomAvailability(page, roomId, roomInfo, roomAvailability);
      }
    }
    
    console.log('Airbnb availability update completed successfully!');
  } catch (error) {
    console.error('Error during Airbnb update:', error);
    
    // Take a screenshot on error
    const errorScreenshotPath = path.join(__dirname, 'error_screenshot.png');
    await page.screenshot({ path: errorScreenshotPath, fullPage: true });
    console.log(`Error screenshot saved to: ${errorScreenshotPath}`);
  } finally {
    // Close browser
    await browser.close();
  }
}

// Login to Airbnb
async function loginToAirbnb(page) {
  try {
    console.log('Navigating to Airbnb login page...');
    await page.goto('https://www.airbnb.co.za/login');
    
    // Check if we need to dismiss any modals
    try {
      const closeButton = page.locator('button[aria-label="Close"]').first();
      if (await closeButton.isVisible({ timeout: 5000 })) {
        console.log('Dismissing modal...');
        await closeButton.click();
      }
    } catch (error) {
      console.log('No modal to dismiss or error dismissing modal');
    }
    
    console.log('Entering email...');
    await page.fill('input[name="email"]', CONFIG.airbnbEmail);
    
    // Click continue button
    await page.click('button[data-testid="signup-login-submit-btn"]');
    await page.waitForTimeout(2000);
    
    console.log('Entering password...');
    await page.fill('input[name="password"]', CONFIG.airbnbPassword);
    
    // Click login button
    await page.click('button[data-testid="signup-login-submit-btn"]');
    
    // Wait for login to complete
    console.log('Waiting for login to complete...');
    await page.waitForNavigation({ timeout: 30000 });
    
    // Verify we're logged in
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('Login failed - still on login page');
    }
    
    console.log('Successfully logged in to Airbnb');
    return true;
  } catch (error) {
    console.error('Error logging in to Airbnb:', error);
    throw error;
  }
}

// Update availability for a single room
async function updateRoomAvailability(page, roomId, roomInfo, roomAvailability) {
  try {
    console.log(`\nUpdating availability for room ${roomId} (Airbnb: ${roomInfo.airbnbTitle})`);
    
    // Skip if in dry run mode and log what would happen
    if (CONFIG.dryRun) {
      console.log(`DRY RUN: Would update ${roomInfo.airbnbTitle} (${roomInfo.airbnbId})`);
      
      // Log a few sample dates
      const blockedDates = Object.keys(roomAvailability).filter(date => roomAvailability[date] === 'blocked');
      console.log(`Would block ${blockedDates.length} dates, including: ${blockedDates.slice(0, 5).join(', ')}${blockedDates.length > 5 ? '...' : ''}`);
      
      return;
    }
    
    // Construct the URL for the calendar page
    // Get the exact URL to edit availability
    const listingUrl = `https://${roomInfo.url}`;
    const calendarUrl = `${listingUrl}/availability`;
    
    console.log(`Navigating to calendar page: ${calendarUrl}`);
    await page.goto(calendarUrl);
    await page.waitForTimeout(3000);
    
    // Wait for the calendar to load
    await page.waitForSelector('div[data-testid="availability-calendar"]', { timeout: 30000 });
    
    // Calculate date range to update
    const today = new Date();
    const endDate = addDays(today, CONFIG.updateDays);
    
    // Get all dates that need to be blocked
    const datesToBlock = [];
    let currentDate = new Date(today);
    
    while (currentDate <= endDate) {
      const dateString = formatDate(currentDate);
      const needsBlocking = roomAvailability[dateString] === 'blocked';
      
      if (needsBlocking) {
        datesToBlock.push(dateString);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`Found ${datesToBlock.length} dates to block for ${roomInfo.airbnbTitle}`);
    
    // Update dates in batches (calendar typically shows 1-2 months at a time)
    let processedDates = 0;
    
    // Process until all dates are done or we reach the end date
    while (processedDates < datesToBlock.length) {
      // Get visible dates on screen
      const visibleDateElements = await page.$$('td[data-testid^="calendar-day-"]');
      
      if (visibleDateElements.length === 0) {
        console.log('No dates visible on screen, moving to next month');
        // Click next month button
        await page.click('button[data-testid="calendar-next-month-button"]');
        await page.waitForTimeout(1000);
        continue;
      }
      
      // For each visible date, check if it needs blocking
      for (const dateElement of visibleDateElements) {
        // Get the date from the element
        const ariaLabel = await dateElement.getAttribute('aria-label');
        if (!ariaLabel) continue;
        
        // Convert the Airbnb date format to our format
        // "March 15, 2025" -> "2025-03-15"
        const dateParts = ariaLabel.match(/(\w+) (\d+), (\d+)/);
        if (!dateParts) continue;
        
        const months = {
          'January': '01', 'February': '02', 'March': '03', 'April': '04',
          'May': '05', 'June': '06', 'July': '07', 'August': '08',
          'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        
        const month = months[dateParts[1]];
        const day = dateParts[2].padStart(2, '0');
        const year = dateParts[3];
        
        if (!month || !day || !year) continue;
        
        const formattedDate = `${year}-${month}-${day}`;
        
        // Check if this date needs blocking
        if (datesToBlock.includes(formattedDate)) {
          // Check if the date is already blocked
          const isBlocked = await dateElement.evaluate(el => 
            el.classList.contains('blocked') || 
            el.getAttribute('data-testid').includes('blocked') ||
            el.getAttribute('aria-label').includes('Unavailable')
          );
          
          if (!isBlocked) {
            console.log(`Blocking date: ${formattedDate}`);
            
            // Click the date to open the editing dialog
            await dateElement.click();
            await page.waitForTimeout(1000);
            
            // Click "Blocked" option
            const blockedOption = page.locator('label:has-text("Blocked")');
            if (await blockedOption.isVisible({ timeout: 5000 })) {
              await blockedOption.click();
              await page.waitForTimeout(500);
              
              // Click Save button
              const saveButton = page.locator('button:has-text("Save")');
              if (await saveButton.isVisible({ timeout: 3000 })) {
                await saveButton.click();
                await page.waitForTimeout(1000);
              }
            }
          } else {
            console.log(`Date ${formattedDate} is already blocked`);
          }
          
          // Mark as processed
          processedDates++;
        }
      }
      
      // Move to next month if we haven't processed all dates
      if (processedDates < datesToBlock.length) {
        console.log('Moving to next month...');
        await page.click('button[data-testid="calendar-next-month-button"]');
        await page.waitForTimeout(1000);
      }
    }
    
    console.log(`Completed updating ${roomInfo.airbnbTitle}`);
    return true;
  } catch (error) {
    console.error(`Error updating room ${roomId}:`, error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  console.log('Starting Airbnb availability update script');
  console.log('======================================');
  
  try {
    // Process calendar data to determine availability
    const availability = await processCalendarData();
    
    // Update Airbnb availability
    await updateAirbnbAvailability(availability);
    
    console.log('======================================');
    console.log('Airbnb availability update completed!');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
main().catch(console.error);
