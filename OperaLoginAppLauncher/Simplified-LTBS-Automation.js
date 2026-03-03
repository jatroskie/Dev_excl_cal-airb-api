require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

async function createBooking(clientName, firstName, telephoneNumber, roomNumber, 
                          startDate, endDate, airRate, discountCode = 'OTH') {
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
      await page.waitForTimeout(2000);
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
      await page.waitForTimeout(3000);
    }
    
    // Fill out guest profile
    try {
      // Wait for Guest Profile dialog
      const profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
      await profileDialog.waitFor({ state: 'visible', timeout: 10000 });
      
      // Wait before interacting with fields as requested
      await page.waitForTimeout(2000);
      
      // Fill Name     
      console.log('Filling in Last Name...');
      const nameInput = profileDialog.locator('input[id*="name"], input[aria-labelledby*="name"]').nth(0);
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.click();
        await nameInput.fill(clientName);
        console.log(`Set Last Name to: ${clientName}`);
      } else {
        console.log('Last Name field not found, trying alternate selector...');
        // Try using the label-based approach
        const alternateNameInput = profileDialog.getByLabel('Name', { exact: true });
        if (await alternateNameInput.isVisible({ timeout: 3000 })) {
          await alternateNameInput.click();
          await alternateNameInput.fill(clientName);
          console.log(`Set Last Name to: ${clientName} using alternate method`);
        } else {
          console.log('Failed to find Last Name field');
        }
      }

      // Fill First Name field
      console.log('Filling in First Name...');
      const firstNameInput = profileDialog.locator('input[id*="firstName"], input[aria-labelledby*="firstName"]').nth(0);
      
      if (await firstNameInput.isVisible({ timeout: 5000 })) {
        await firstNameInput.click();
        await firstNameInput.fill(firstName);
        console.log(`Set First Name to: ${firstName}`);
      } else {
        console.log('First Name field not found, trying alternate selector...');
        
        // Try the textbox role approach
        const alternateFirstNameInput = profileDialog.getByRole('textbox', { name: 'First Name' }).nth(0);
        if (await alternateFirstNameInput.isVisible({ timeout: 3000 })) {
          await alternateFirstNameInput.click();
          await alternateFirstNameInput.fill(firstName);
          console.log(`Set First Name to: ${firstName} using alternate method`);
        } else {
          console.log('Failed to find First Name field');
        }
      }

      // Find and click the MOBILE row in the Phone section
      console.log('Looking for MOBILE row...');

      // Try multiple approaches to find the mobile entry field
      const mobileRow = profileDialog.getByRole('row', { name: 'MOBILE Communication Type' });
      const mobileCommValue = mobileRow.getByLabel('Communication Value');
      
      if (await mobileCommValue.isVisible({ timeout: 5000 })) {
        // Click on the field to activate it
        await mobileCommValue.click();
        
        try {
          // Try to find the gridcell input field
          const gridCellInput = profileDialog.getByRole('gridcell', { name: 'Communication Value Communication Value' })
                              .getByLabel('Communication Value');
          
          if (await gridCellInput.isVisible({ timeout: 3000 })) {
            await gridCellInput.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using gridcell`);
          } else {
            // Fall back to direct input
            await mobileCommValue.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using direct input`);
          }
        } catch (inputError) {
          // Last resort approach
          console.log('Error with input field, trying direct entry:', inputError.message);
          
          // Try direct fill
          await mobileCommValue.fill(telephoneNumber);
          console.log(`Set telephone number to: ${telephoneNumber} using fallback`);
        }
      } else {
        // Try to locate any visible Communication Value field
        console.log('MOBILE row not found, looking for any Communication Value field...');
        const anyCommValue = profileDialog.locator('input[aria-label*="Communication Value"]').first();
        
        if (await anyCommValue.isVisible({ timeout: 3000 })) {
          await anyCommValue.click();
          await anyCommValue.fill(telephoneNumber);
          console.log(`Set telephone number to: ${telephoneNumber} using generic field`);
        } else {
          console.log('Failed to find any Communication Value field');
        }
      }
          
      // Save and Select Profile
      console.log('Clicking Save and Select Profile button...');
      const saveButton = profileDialog.getByRole('button', { name: 'Save and Select Profile' }).nth(0);
      
      if (await saveButton.isVisible({ timeout: 5000 })) {
        await saveButton.click();
        console.log('Clicked Save and Select Profile button');
      } else {
        console.log('Save and Select Profile button not found, trying alternate selector...');
        
        // Try text-based approach
        const altSaveButton = profileDialog.locator('button:has-text("Save and Select Profile")').first();
        if (await altSaveButton.isVisible({ timeout: 3000 })) {
          await altSaveButton.click();
          console.log('Clicked Save and Select Profile button using alternate method');
        } else {
          throw new Error('Could not find Save and Select Profile button');
        }
      }
      
      // Wait after saving profile as requested
      console.log('Waiting after saving profile...');
      await page.waitForTimeout(2000);
    } catch (profileError) {
      console.log('Error handling Guest Profile dialog:', profileError.message);
      
      // Take error screenshot
      await page.screenshot({ 
        path: path.join(downloadsPath, `profile_error_${Date.now()}.png`) 
      }).catch(e => console.log('Error taking screenshot:', e.message));
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

    // NEW PART: Handle the Room Details dialog
    console.log('Looking for Room Details dialog...');
    const roomDetailsDialog = page.locator('div[role="dialog"][aria-label="Room Details"]');
    const isRoomDetailsVisible = await roomDetailsDialog.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (isRoomDetailsVisible) {
      console.log('Room Details dialog found');
      
      // Check if the room number field is empty and fill it if needed
      try {
        const roomNumberInput = roomDetailsDialog.locator('input[id*="roomId"]').nth(0);
        if (await roomNumberInput.isVisible({ timeout: 3000 })) {
          const currentValue = await roomNumberInput.inputValue();
          if (!currentValue) {
            console.log('Room number field is empty, filling with:', roomNumber);
            await roomNumberInput.fill(roomNumber);
          }
        }
      } catch (roomInputError) {
        console.log('Could not check/fill room number field:', roomInputError.message);
      }
      
      // Click the Search button in the Room Details dialog
      const dialogSearchButton = roomDetailsDialog.getByRole('button', { name: 'Search' }).nth(0);
      if (await dialogSearchButton.isVisible({ timeout: 5000 })) {
        console.log('Clicking Search button in Room Details dialog');
        await dialogSearchButton.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('Search button in Room Details dialog not found');
      }
      
      // Take screenshot after dialog search
      await page.screenshot({ path: path.join(downloadsPath, 'after_dialog_search.png') });
    } else {
      console.log('Room Details dialog not found, continuing with normal flow');
    }
    
    // Handle Do Not Move checkbox if present
    try {
      console.log('Looking for Do Not Move checkbox...');
      // Look in several ways for the checkbox
      const doNotMoveCheckbox = page.locator('input[type="checkbox"][id*="doNotMove"]').nth(0);
      const doNotMoveLabel = page.getByText('Do Not Move').nth(0);
      
      // Try the checkbox first
      if (await doNotMoveCheckbox.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move checkbox, clicking');
        await doNotMoveCheckbox.click();
      } 
      // Then try the label
      else if (await doNotMoveLabel.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move label, clicking');
        await doNotMoveLabel.click();
      } else {
        console.log('Do Not Move option not found');
      }
    } catch (moveError) {
      console.log('Error with Do Not Move option:', moveError.message);
    }
    
    // Look for and click Select Room button - try multiple approaches
    console.log('Looking for Select Room button...');
    
    // Take screenshot to see what's available
    await page.screenshot({ path: path.join(downloadsPath, 'before_select_room.png') });
    
    // Approach 1: Try finding Select Room as a link
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).nth(0);
    if (await selectRoomLink.isVisible({ timeout: 5000 })) {
      console.log('Found Select Room link, clicking');
      await selectRoomLink.click();
      console.log('Clicked Select Room link');
    } 
    // Approach 2: Try finding it as a button
    else {
      const selectRoomButton = page.getByRole('button', { name: 'Select Room' }).nth(0);
      if (await selectRoomButton.isVisible({ timeout: 3000 })) {
        console.log('Found Select Room button, clicking');
        await selectRoomButton.click();
        console.log('Clicked Select Room button');
      } 
      // Approach 3: Look for any element containing "Select Room" text
      else {
        console.log('Looking for any element with "Select Room" text');
        const selectRoomText = page.locator(':text("Select Room")').first();
        if (await selectRoomText.isVisible({ timeout: 3000 })) {
          console.log('Found element with Select Room text, clicking');
          await selectRoomText.click();
        } 
        // Approach 4: Use JavaScript to find and click the element
        else {
          console.log('Using JavaScript to find Select Room element');
          const foundElement = await page.evaluate(() => {
            // Look for elements containing "Select Room" text
            const elements = Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && el.textContent.trim() === 'Select Room');
            
            if (elements.length > 0) {
              console.log(`Found ${elements.length} elements with "Select Room" text`);
              elements[0].click();
              return true;
            }
            
            // Try looking for the button in the bottom area of the dialog
            const bottomElements = Array.from(document.querySelectorAll('button, a'))
              .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.bottom > window.innerHeight * 0.7 && el.textContent.includes('Select');
              });
            
            if (bottomElements.length > 0) {
              console.log('Found button in bottom area, clicking');
              bottomElements[0].click();
              return true;
            }
            
            return false;
          });
          
          if (foundElement) {
            console.log('Found and clicked Select Room with JavaScript');
          } else {
            console.log('Could not find Select Room element');
          }
        }
      }
    }
    
    // Wait after clicking Select Room
    await page.waitForTimeout(3000);
    
    // Take screenshot after clicking Select Room
    await page.screenshot({ path: path.join(downloadsPath, 'after_select_room.png') });
    
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
    
 
// Replace the discount section with this updated code:

// Extract the Opera rate from the screen
console.log('Extracting Opera rate from screen...');
let operaRate = 0;

try {
    // Try to find the rate display element - look for multiple possible selectors
    const rateElements = [
      page.locator('text="Rate"').first().locator('xpath=following-sibling::*'),
      page.locator('.x1zp:has-text("ZAR")').first(),
      page.locator('div[id*="rate"]').first(),  // Fixed missing quote
      page.locator('text="1,"').first(),
      page.locator('text=",00 ZAR"').first().locator('xpath=..'),
      page.locator('div:has-text(",00 ZAR")').first()
    ];
  
  // Try each rate element until we find one
  for (const rateElement of rateElements) {
    if (await rateElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      const rateText = await rateElement.textContent();
      console.log(`Found rate text: ${rateText}`);
      
      // Extract numeric value using regex to handle formats like "1,600.00 ZAR"
      const rateMatch = rateText.match(/[\d,.]+/);
      if (rateMatch) {
        // Clean up the number (remove commas, handle decimals)
        let rateString = rateMatch[0].replace(/,/g, '');
        operaRate = parseFloat(rateString);
        console.log(`Extracted Opera rate: ${operaRate}`);
        break;
      }
    }
  }
  
  // If we couldn't find the rate with specific selectors, try a more general approach
  if (operaRate === 0) {
    console.log('Trying JavaScript approach to find rate...');
    operaRate = await page.evaluate(() => {
      // Look for elements with ZAR and numeric content
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent && 
                el.textContent.includes('ZAR') && 
                /[\d,.]+/.test(el.textContent));
      
      if (elements.length > 0) {
        const rateText = elements[0].textContent;
        const rateMatch = rateText.match(/[\d,.]+/);
        if (rateMatch) {
          return parseFloat(rateMatch[0].replace(/,/g, ''));
        }
      }
      
      return 0;
    });
    
    console.log(`Found Opera rate using JavaScript: ${operaRate}`);
  }
  
  // Take a screenshot of the rate section
  await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction.png') });
} catch (rateError) {
  console.log('Error extracting Opera rate:', rateError.message);
}

// If we couldn't extract the rate, log a warning but continue
if (operaRate === 0) {
  console.log('WARNING: Could not extract Opera rate from screen. Using default value of 0.');
}

// Convert airRate from string to number
const airRateNum = parseFloat(airRate);
console.log(`Air rate (converted to number): ${airRateNum}`);



// Calculate discount
let discountAmount = 0;
const discountAmount = operaRate - (airRateNum * 0.77);
const roundedDiscount = Math.round(discountAmount);
console.log(`Calculated discount: ${discountAmount} (rounded to ${roundedDiscount})`);

// Fill Discount Amount
const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).nth(0);
if (await discountAmountInput.isVisible({ timeout: 5000 })) {
  await discountAmountInput.click();
  await discountAmountInput.fill(roundedDiscount.toString());
  console.log(`Set discount amount to ${roundedDiscount}`);
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
