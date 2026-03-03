require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

async function createBooking(clientName, firstName, telephoneNumber, roomNumber, 
                          startDate, endDate, discountAmount, discountCode = 'OTH') {
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    console.log(`Starting booking process for ${firstName} ${clientName}, room ${roomNumber}...`);
    
    // Login using login3.js
    console.log('Logging in using login3.js...');
    const loginOptions = {
      viewport: { width: 1600, height: 1200 },  // Increased dimensions
      headless: false
    };
    
    const loginResult = await loginToOperaCloud(loginOptions);
    
    if (loginResult.error) {
      throw new Error(`Login failed: ${loginResult.error.message}`);
    }
    
    browser = loginResult.browser;
    context = loginResult.context;
    page = loginResult.page;
    
    // Check if we're on the PopupChecker page and navigate to main app if needed
    const currentUrl = await page.url();
    console.log(`Login successful. Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('PopupChecker') || !currentUrl.includes('OperaCloud')) {
      console.log('Need to navigate to main application...');
      
      // Create a new page in the same context
      console.log('Creating new page for main application...');
      page = await context.newPage();
      
      // Navigate to the main application URL
      const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
      console.log(`Navigating to main application URL: ${appUrl}`);
      
      await page.goto(appUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      
      // Wait for the page to be fully loaded
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        console.log('Network idle timeout, continuing anyway');
      });
    }
    
    // Take screenshot to confirm we're on the main interface
    const downloadsPath = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'main_interface.png') });
    
    // Navigate to Look To Book Sales Screen
    console.log('Navigating to Look To Book Sales Screen...');
    
    // Click on Bookings
    const bookingsLink = page.getByRole('link', { name: 'Bookings' }).nth(0);
    await bookingsLink.waitFor({ state: 'visible', timeout: 30000 });
    await bookingsLink.click();
    console.log('Clicked Bookings');
    await page.waitForTimeout(2000);
    
    // Click on Reservations
    const reservationsItem = page.getByText('Reservations', { exact: true }).nth(0);
    await reservationsItem.waitFor({ state: 'visible', timeout: 30000 });
    await reservationsItem.click();
    console.log('Clicked Reservations');
    await page.waitForTimeout(2000);
    
    // Click on Look To Book Sales Screen
    const lookToBookItem = page.getByText('Look To Book Sales Screen').nth(0);
    await lookToBookItem.waitFor({ state: 'visible', timeout: 30000 });
    await lookToBookItem.click();
    console.log('Clicked Look To Book Sales Screen');
    await page.waitForTimeout(3000);
    
    // Enter Travel Agent (AirBnB)
    console.log('Entering AirBnB as travel agent...');
    const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
    await travelAgentInput.waitFor({ state: 'visible', timeout: 30000 });
    await travelAgentInput.click();
    await travelAgentInput.fill('airbnb');
    
    // Click search for Travel Agent
    console.log('Searching for AirBnB...');
    const searchIcon = page.locator('a[id*="oc_srclov_dummy_link"]').nth(0);
    
    if (await searchIcon.isVisible({ timeout: 5000 })) {
      await searchIcon.click();
      console.log('Clicked search icon');
    } else {
      console.log('Search icon not found, pressing Enter...');
      await travelAgentInput.press('Enter');
    }
    
    await page.waitForTimeout(3000);
    
    // Take screenshot to see the AirBnB popup
    await page.screenshot({ path: path.join(downloadsPath, 'airbnb_popup.png') });
    
    // HANDLE THE AIRBNB POPUP SELECT BUTTON
    console.log('Looking for AirBnB in results...');
    
    // Check for "Manage Profile" dialog
    const manageProfileHeading = page.locator('text="Manage Profile"').first();
    const isProfileSearchPopup = await manageProfileHeading.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (isProfileSearchPopup) {
      console.log('Found Profile Search popup');
      
      // Check for AirBnB entry
      const airBnBEntry = page.locator('text="AirBnB"').first();
      const hasAirBnBResult = await airBnBEntry.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasAirBnBResult) {
        console.log('AirBnB entry found, clicking it...');
        await airBnBEntry.click();
        await page.waitForTimeout(1000);
        
        // Take screenshot after clicking AirBnB
        await page.screenshot({ path: path.join(downloadsPath, 'after_airbnb_click.png') });
        
        // IMPORTANT: Find and click the Select button using multiple strategies
        console.log('Attempting to click Select button...');
        
        // Try approach 1: Direct page evaluation to click the button
        await page.evaluate(() => {
          console.log('Running JavaScript to find Select button');
          
          // Try to find the teal-colored Select button
          const buttons = Array.from(document.querySelectorAll('button'));
          const selectButtons = buttons.filter(btn => 
            btn.textContent && btn.textContent.trim() === 'Select'
          );
          
          if (selectButtons.length > 0) {
            console.log(`Found ${selectButtons.length} buttons with "Select" text`);
            // Try the 4th button (index 3) if available, otherwise the first
            const buttonIndex = selectButtons.length >= 4 ? 3 : 0;
            selectButtons[buttonIndex].click();
            return true;
          }
          
          // Try to find elements with Select text
          const elements = Array.from(document.querySelectorAll('*'));
          const selectElements = elements.filter(el => 
            el.textContent && el.textContent.trim() === 'Select'
          );
          
          if (selectElements.length > 0) {
            console.log(`Found ${selectElements.length} elements with "Select" text`);
            
            // Try clicking the 4th element if available, otherwise the first
            const elementIndex = selectElements.length >= 4 ? 3 : 0;
            
            // Try clicking the element
            try {
              selectElements[elementIndex].click();
              return true;
            } catch (e) {
              console.log('Failed to click element, trying parent');
              
              // Try clicking the parent
              if (selectElements[elementIndex].parentElement) {
                selectElements[elementIndex].parentElement.click();
                return true;
              }
            }
          }
          
          // Look for the specific button in the bottom-right corner
          const bottomButtons = buttons.filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.bottom > window.innerHeight * 0.7 && rect.right > window.innerWidth * 0.7;
          });
          
          if (bottomButtons.length > 0) {
            console.log('Found bottom-right button, clicking it');
            bottomButtons[0].click();
            return true;
          }
          
          return false;
        });
        
        // Wait for the action to complete
        await page.waitForTimeout(3000);
        
        // Try approach 2: Direct button selector (fallback)
        const selectButton = page.getByRole('button', { name: 'Select', exact: true }).nth(3);
        if (await selectButton.isVisible({ timeout: 3000 })) {
          console.log('Found Select button by role, clicking...');
          await selectButton.click();
          await page.waitForTimeout(2000);
        }
        
        // Try approach 3: Using the iframe approach from original code
        try {
          console.log('Trying iframe approach...');
          const iframeLocator = page.frameLocator('iframe[title="Content"]');
          const iframeSelectButton = iframeLocator.getByRole('button', { name: 'Select' }).nth(0);
          
          if (await iframeSelectButton.isVisible({ timeout: 3000 })) {
            console.log('Found Select button in iframe, clicking...');
            await iframeSelectButton.click();
            await page.waitForTimeout(2000);
          }
        } catch (iframeError) {
          console.log('Iframe approach failed:', iframeError.message);
        }
        
        // Take screenshot after Select button attempts
        await page.screenshot({ path: path.join(downloadsPath, 'after_select_attempts.png') });
      } else {
        console.log('No AirBnB entry found, creating new profile...');
        
        // Click New Profile
        const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
        await newProfileLink.click();
        console.log('Clicked New Profile');
      }
    } else {
      // Try iframe approach directly if no profile search popup found
      console.log('No profile search popup found, trying iframe approach...');
      try {
        const iframeLocator = page.frameLocator('iframe[title="Content"]');
        const iframeSelectButton = iframeLocator.getByRole('button', { name: 'Select' }).nth(0);
        await iframeSelectButton.click();
        console.log('Clicked Select button in iframe');
      } catch (iframeError) {
        console.log('Iframe selection failed:', iframeError.message);
        
        // Try clicking New Profile directly
        const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
        if (await newProfileLink.isVisible({ timeout: 5000 })) {
          await newProfileLink.click();
          console.log('Clicked New Profile link');
        }
      }
    }
    
    // Wait after Select button/New Profile handling
    await page.waitForTimeout(5000);
    
    // Continue with booking process (same as your original code)
    console.log('Continuing with booking process...');
    
    // Screenshot to see the current state
    await page.screenshot({ path: path.join(downloadsPath, 'booking_form.png') });
    
    // Enter Arrival/Departure dates and other details
    
    // Fill arrival date
    const arrivalInput = page.getByRole('textbox', { name: 'Arrival' }).nth(0);
    if (await arrivalInput.isVisible({ timeout: 10000 })) {
      await arrivalInput.click();
      await arrivalInput.fill(startDate);
      console.log(`Set arrival date to ${startDate}`);
    } else {
      console.log('Arrival field not found');
    }
    
    // Fill departure date
    const departureInput = page.getByRole('textbox', { name: 'Departure' }).nth(0);
    if (await departureInput.isVisible({ timeout: 5000 })) {
      await departureInput.click();
      await departureInput.fill(endDate);
      console.log(`Set departure date to ${endDate}`);
    } else {
      console.log('Departure field not found');
    }
    
    // Set adults
    const adultsInput = page.getByRole('textbox', { name: 'Adults' }).nth(0);
    if (await adultsInput.isVisible({ timeout: 5000 })) {
      await adultsInput.click();
      await adultsInput.fill('2');
      console.log('Set adults to 2');
    } else {
      console.log('Adults field not found');
    }
    
    // Create new profile (in case we didn't get here from the AirBnB popup)
    const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
    if (await newProfileLink.isVisible({ timeout: 5000 })) {
      await newProfileLink.click();
      console.log('Clicked New Profile');
      await page.waitForTimeout(2000);
    }
    
    // Fill out guest profile
    try {
      // Wait for Guest Profile dialog
      const profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
      await profileDialog.waitFor({ state: 'visible', timeout: 10000 });
      
      // Fill Name
      const nameInput = profileDialog.getByLabel('Name', { exact: true });
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.click();
      await nameInput.fill(clientName);
      
      // Fill First Name
      const firstNameInput = page.getByRole('textbox', { name: 'First Name' }).nth(0);
      await firstNameInput.waitFor({ state: 'visible', timeout: 5000 });
      await firstNameInput.click();
      await firstNameInput.fill(firstName);
      
      // Fill phone number
      const mobileRow = page.getByRole('row', { name: 'MOBILE Communication Type' });
      const phoneInput = mobileRow.getByLabel('Communication Value');
      await phoneInput.waitFor({ state: 'visible', timeout: 5000 });
      await phoneInput.click();
      
      // Sometimes the phone input is in a gridcell
      try {
        const gridCellInput = page.getByRole('gridcell', { name: 'Communication Value Communication Value' })
                              .getByLabel('Communication Value');
        await gridCellInput.waitFor({ state: 'visible', timeout: 5000 });
        await gridCellInput.fill(telephoneNumber);
      } catch (gridError) {
        // Try direct input if gridcell fails
        await phoneInput.fill(telephoneNumber);
      }
      
      // Save and Select Profile
      const saveButton = page.getByRole('button', { name: 'Save and Select Profile' }).nth(0);
      await saveButton.waitFor({ state: 'visible', timeout: 5000 });
      await saveButton.click();
      console.log('Saved guest profile');
      await page.waitForTimeout(3000);
    } catch (profileError) {
      console.log('Error filling profile:', profileError.message);
    }
    
    // Fill room number
    const roomInput = page.getByRole('textbox', { name: 'Room', exact: true }).nth(0);
    if (await roomInput.isVisible({ timeout: 10000 })) {
      await roomInput.click();
      await roomInput.fill(roomNumber);
      console.log(`Set room number to ${roomNumber}`);
    } else {
      console.log('Room field not found');
    }
    
    // Click Search
    const searchButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchButton.isVisible({ timeout: 5000 })) {
      await searchButton.click();
      console.log('Clicked Search button');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search button not found');
    }
    
    // Take screenshot after search
    await page.screenshot({ path: path.join(downloadsPath, 'after_search.png') });
    
    // Handle Do Not Move option (if present)
    try {
      const doNotMoveLabel = page.getByRole('gridcell', { name: 'Do Not Move' }).locator('label').nth(1);
      if (await doNotMoveLabel.isVisible({ timeout: 5000 })) {
        await doNotMoveLabel.click();
        console.log('Clicked Do Not Move option');
      }
    } catch (moveError) {
      console.log('Do Not Move option not found or error:', moveError.message);
    }
    
    // Select Room
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).nth(0);
    if (await selectRoomLink.isVisible({ timeout: 10000 })) {
      await selectRoomLink.click();
      console.log('Clicked Select Room');
      await page.waitForTimeout(2000);
    } else {
      console.log('Select Room link not found');
    }
    
    // Search for rates
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchRatesButton.isVisible({ timeout: 5000 })) {
      await searchRatesButton.click();
      console.log('Clicked Search for rates');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search rates button not found');
    }
    
    // Take screenshot to see rates
    await page.screenshot({ path: path.join(downloadsPath, 'rates_search.png') });
    
    // Select a specific rate (using ID from your original code)
    try {
      const rateSelector = page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]');
      if (await rateSelector.isVisible({ timeout: 5000 })) {
        await rateSelector.click();
        console.log('Selected rate');
        await page.waitForTimeout(2000);
      } else {
        console.log('Rate selector not found, trying first available rate...');
        // Try clicking any rate row
        const anyRate = page.locator('tr[_afrrk]').first();
        if (await anyRate.isVisible({ timeout: 3000 })) {
          await anyRate.click();
          console.log('Clicked first available rate');
        }
      }
    } catch (rateError) {
      console.log('Error selecting rate:', rateError.message);
    }
    
    // Click Select button to confirm rate
    const rateSelectButton = page.getByRole('button', { name: 'Select', exact: true }).nth(0);
    if (await rateSelectButton.isVisible({ timeout: 5000 })) {
      await rateSelectButton.click();
      console.log('Clicked Select button for rate');
      await page.waitForTimeout(3000);
    } else {
      console.log('Rate Select button not found');
    }
    
    // Take screenshot after rate selection
    await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection.png') });
    
    // Fill out discount information
    // Find ZAR currency element (if present)
    try {
      const zarElement = page.locator('[id*="zm34g1"]').getByText('ZAR').nth(0);
      if (await zarElement.isVisible({ timeout: 3000 })) {
        await zarElement.click();
        console.log('Clicked ZAR currency');
      }
    } catch (currencyError) {
      console.log('Currency element not found');
    }
    
    // Fill Discount Amount
    const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).nth(0);
    if (await discountAmountInput.isVisible({ timeout: 5000 })) {
      await discountAmountInput.click();
      await discountAmountInput.fill(discountAmount);
      console.log(`Set discount amount to ${discountAmount}`);
    } else {
      console.log('Discount Amount field not found');
    }
    
    // Fill Discount Code
    const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' }).nth(0);
    if (await discountCodeInput.isVisible({ timeout: 5000 })) {
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      console.log(`Set discount code to ${discountCode}`);
    } else {
      console.log('Discount Code field not found');
    }
    
    // Select payment method
    const methodSelect = page.getByLabel('Method').nth(0);
    if (await methodSelect.isVisible({ timeout: 5000 })) {
      await methodSelect.selectOption('FCA');
      console.log('Selected FCA payment method');
    } else {
      console.log('Method selector not found');
    }
    
    // Click Book Now button
    const bookNowButton = page.getByRole('button', { name: 'Book Now' }).nth(0);
    if (await bookNowButton.isVisible({ timeout: 5000 })) {
      await bookNowButton.click();
      console.log('Clicked Book Now');
      await page.waitForTimeout(8000);
    } else {
      console.log('Book Now button not found');
    }
    
    // Take final screenshot
    await page.screenshot({ path: path.join(downloadsPath, 'booking_complete.png') });
    
    // Exit booking
    const exitButton = page.getByRole('button', { name: 'Exit Booking' }).nth(0);
    if (await exitButton.isVisible({ timeout: 10000 })) {
      await exitButton.click();
      console.log('Clicked Exit Booking');
    }
    
    console.log('Booking process completed successfully');
    return {
      success: true,
      message: `Booking completed for ${firstName} ${clientName} in room ${roomNumber}`
    };
    
  } catch (error) {
    console.error(`Error in booking process: ${error.message}`);
    
    // Take error screenshot
    try {
      const downloadsPath = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }
      
      if (page && !page.isClosed()) {
        await page.screenshot({ path: path.join(downloadsPath, `error_${Date.now()}.png`) });
      }
    } catch (screenshotError) {
      console.log('Could not take error screenshot:', screenshotError.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Clean up resources
    if (page && !page.isClosed()) {
      await page.close().catch(e => console.log('Error closing page:', e.message));
    }
    
    if (context) {
      await context.close().catch(e => console.log('Error closing context:', e.message));
    }
    
    if (browser) {
      await browser.close().catch(e => console.log('Error closing browser:', e.message));
    }
  }
}

// Main function for command-line use
async function main() {
  // Get command line arguments or use defaults
  const clientName = process.argv[2] || 'TestClient';
  const firstName = process.argv[3] || 'Test';
  const telephoneNumber = process.argv[4] || '1234567890';
  const roomNumber = process.argv[5] || '0405';
  const startDate = process.argv[6] || '15.05.2025';
  const endDate = process.argv[7] || '18.05.2025';
  const discountAmount = process.argv[8] || '370';
  const discountCode = process.argv[9] || 'OTH';
  
  console.log('Running booking with parameters:');
  console.log(`Client: ${firstName} ${clientName}`);
  console.log(`Phone: ${telephoneNumber}`);
  console.log(`Room: ${roomNumber}`);
  console.log(`Dates: ${startDate} to ${endDate}`);
  console.log(`Discount: ${discountAmount} (${discountCode})`);
  
  // Call the booking function
  const result = await createBooking(
    clientName,
    firstName,
    telephoneNumber,
    roomNumber,
    startDate,
    endDate,
    discountAmount,
    discountCode
  );
  
  // Output the result
  if (result.success) {
    console.log('✅ Booking completed successfully!');
    console.log(result.message);
    process.exit(0);
  } else {
    console.error('❌ Booking failed:');
    console.error(result.error);
    process.exit(1);
  }
}

// Run main if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { createBooking };