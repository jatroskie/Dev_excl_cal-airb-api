require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3');

// Timeout configuration
const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
  EXTRA_LONG: 60000
};

async function createBooking(clientName, firstName, telephoneNumber, roomNumber, 
                          startDate, endDate, airRate, discountCode = 'OTH') {
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    console.log(`Starting booking process for ${firstName} ${clientName}, room ${roomNumber}...`);
    
    console.log('Logging in using login3.js...');
    const loginOptions = {
      viewport: { width: 1600, height: 1200 },
      headless: false
    };
    
    const loginResult = await loginToOperaCloud(loginOptions);
    
    if (loginResult.error) {
      throw new Error(`Login failed: ${loginResult.error.message}`);
    }
    
    browser = loginResult.browser;
    context = loginResult.context;
    page = loginResult.page;
    
    const currentUrl = await page.url();
    console.log(`Login successful. Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('PopupChecker') || !currentUrl.includes('OperaCloud')) {
      console.log('Need to navigate to main application...');
      console.log('Creating new page for main application...');
      page = await context.newPage();
      
      const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
      console.log(`Navigating to main application URL: ${appUrl}`);
      
      await page.goto(appUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.EXTRA_LONG 
      });
      
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.LONG }).catch(() => {
        console.log('Network idle timeout, continuing anyway');
      });
    }
    
    const downloadsPath = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'main_interface.png') });
    
    console.log('Navigating to Look To Book Sales Screen...');
    const bookingsLink = page.getByRole('link', { name: 'Bookings' }).nth(0);
    await bookingsLink.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
    await bookingsLink.click();
    console.log('Clicked Bookings');
    await page.waitForTimeout(2000);
    
    const reservationsItem = page.getByText('Reservations', { exact: true }).nth(0);
    await reservationsItem.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
    await reservationsItem.click();
    console.log('Clicked Reservations');
    await page.waitForTimeout(2000);
    
    const lookToBookItem = page.getByText('Look To Book Sales Screen').nth(0);
    await lookToBookItem.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
    await lookToBookItem.click();
    console.log('Clicked Look To Book Sales Screen');
    await page.waitForTimeout(3000);
    console.log('Current URL after navigating to Look To Book Sales Screen:', page.url());
    
    console.log('Entering AirBnB as travel agent...');
    const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
    await travelAgentInput.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
    await travelAgentInput.click();
    await travelAgentInput.fill('airbnb');
    
    console.log('Searching for AirBnB...');
    const searchIcon = page.locator('a[id*="oc_srclov_dummy_link"]').nth(0);
    
    if (await searchIcon.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await page.waitForTimeout(5000);
      await searchIcon.click();
      console.log('Clicked search icon');
    } else {
      console.log('Search icon not found, pressing Enter...');
      await travelAgentInput.press('Enter');
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(downloadsPath, 'airbnb_popup.png') });
    
    console.log('Looking for AirBnB in results...');
    const manageProfileHeading = page.locator('text="Manage Profile"').first();
    const isProfileSearchPopup = await manageProfileHeading.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false);
    
    if (isProfileSearchPopup) {
      console.log('Found Profile Search popup');
      
      const airBnBEntry = page.locator('text="AirBnB"').first();
      const hasAirBnBResult = await airBnBEntry.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);
      
      if (hasAirBnBResult) {
        console.log('AirBnB entry found, clicking it...');
        await airBnBEntry.click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: path.join(downloadsPath, 'after_airbnb_click.png') });
        
        console.log('Attempting to click Select button...');
        
        const selectButtonStrategies = [
          async () => {
            const button = page.getByRole('button', { name: 'Select', exact: true }).nth(3);
            if (await button.isVisible({ timeout: 3000 })) {
              await button.click();
              console.log('Clicked Select button using role strategy');
              return true;
            }
            return false;
          },
          async () => {
            const iframeLocator = page.frameLocator('iframe[title="Content"]');
            const iframeButton = iframeLocator.getByRole('button', { name: 'Select' }).nth(0);
            if (await iframeButton.isVisible({ timeout: 3000 })) {
              await iframeButton.click();
              console.log('Clicked Select button using iframe strategy');
              return true;
            }
            return false;
          },
          async () => {
            const success = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const selectButtons = buttons.filter(btn => 
                btn.textContent && btn.textContent.trim() === 'Select'
              );
              if (selectButtons.length > 0) {
                const buttonIndex = selectButtons.length >= 4 ? 3 : 0;
                selectButtons[buttonIndex].click();
                return true;
              }
              return false;
            });
            if (success) {
              console.log('Clicked Select button using JS evaluation');
            }
            return success;
          }
        ];

        let selectClicked = false;
        for (const strategy of selectButtonStrategies) {
          try {
            selectClicked = await strategy();
            if (selectClicked) break;
          } catch (e) {
            console.log('Select button strategy failed:', e.message);
          }
        }

        if (!selectClicked) {
          console.log('Warning: Could not click Select button with any strategy');
        }
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(downloadsPath, 'after_select_attempts.png') });
      } else {
        console.log('No AirBnB entry found, creating new profile...');
        const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
        await newProfileLink.click();
        console.log('Clicked New Profile');
      }
    } else {
      console.log('No profile search popup found, trying iframe approach...');
      try {
        const iframeLocator = page.frameLocator('iframe[title="Content"]');
        const iframeSelectButton = iframeLocator.getByRole('button', { name: 'Select' }).nth(0);
        await iframeSelectButton.click();
        console.log('Clicked Select button in iframe');
      } catch (iframeError) {
        console.log('Iframe selection failed:', iframeError.message);
        const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
        if (await newProfileLink.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await newProfileLink.click();
          console.log('Clicked New Profile link');
        }
      }
    }
    
    await page.waitForTimeout(5000);
    console.log('Continuing with booking process...');
    await page.screenshot({ path: path.join(downloadsPath, 'booking_form.png') });
    
    const arrivalInput = page.getByRole('textbox', { name: 'Arrival' }).nth(0);
    if (await arrivalInput.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      await arrivalInput.click();
      await arrivalInput.fill(startDate);
      console.log(`Set arrival date to ${startDate}`);
    } else {
      console.log('Arrival field not found');
      await page.screenshot({ path: path.join(downloadsPath, `arrival_input_not_found_${Date.now()}.png`) });
    }
    
    const departureInput = page.getByRole('textbox', { name: 'Departure' }).nth(0);
    if (await departureInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await departureInput.click();
      await departureInput.fill(endDate);
      console.log(`Set departure date to ${endDate}`);
    } else {
      console.log('Departure field not found');
      await page.screenshot({ path: path.join(downloadsPath, `departure_input_not_found_${Date.now()}.png`) });
    }
    
    const adultsInput = page.getByRole('textbox', { name: 'Adults' }).nth(0);
    if (await adultsInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await adultsInput.click();
      await adultsInput.fill('2');
      console.log('Set adults to 2');
    } else {
      console.log('Adults field not found');
      await page.screenshot({ path: path.join(downloadsPath, `adults_input_not_found_${Date.now()}.png`) });
    }
    
    console.log('Looking for New Profile link to create guest profile...');
    let newProfileClicked = false;

    // Strategy 1: Use class-based selector with text validation
    const newProfileLink = page.locator('span.x43p.x20 > a.xt1.p_AFTextOnly').getByText('New Profile').first();
    if (await newProfileLink.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      await newProfileLink.scrollIntoViewIfNeeded();
      await newProfileLink.click();
      console.log('Clicked New Profile link using class and text selector');
      newProfileClicked = true;
    } else {
      console.log('New Profile link not found with class and text selector');
    }

    // Fallback 1: Use role-based locator with class filter
    if (!newProfileClicked) {
      const newProfileLinkFallback1 = page.getByRole('link', { name: 'New Profile' }).filter({ has: page.locator('.xt1.p_AFTextOnly') }).first();
      if (await newProfileLinkFallback1.isVisible({ timeout: TIMEOUTS.SHORT })) {
        await newProfileLinkFallback1.scrollIntoViewIfNeeded();
        await newProfileLinkFallback1.click();
        console.log('Clicked New Profile link using role-based locator with class filter');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with role-based locator and class filter');
      }
    }

    // Fallback 2: Use attribute-based selector
    if (!newProfileClicked) {
      const newProfileLinkFallback2 = page.locator('span.x43p.x20 > a[data-afr-tlen="11"]').first();
      if (await newProfileLinkFallback2.isVisible({ timeout: TIMEOUTS.SHORT })) {
        await newProfileLinkFallback2.scrollIntoViewIfNeeded();
        await newProfileLinkFallback2.click();
        console.log('Clicked New Profile link using attribute-based selector)');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with attribute-based selector');
      }
    }

    // Fallback 3: Use JavaScript to find and click
    if (!newProfileClicked) {
      console.log('Using JavaScript to find and click New Profile link...');
      const clicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('span.x43p.x20 > a.xt1.p_AFTextOnly'))
          .filter(el => el.textContent && el.textContent.trim() === 'New Profile');
        if (elements.length > 0) {
          elements[0].scrollIntoView();
          elements[0].click();
          return true;
        }
        return false;
      });
      if (clicked) {
        console.log('Clicked New Profile link using JavaScript');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with JavaScript');
      }
    }

    // Final check and screenshot if not clicked
    if (!newProfileClicked) {
      console.log('ERROR: Could not click New Profile link with any strategy');
      await page.screenshot({ path: path.join(downloadsPath, `new_profile_error_${Date.now()}.png`) });
    } else {
      // Validate that the click worked by checking for the Guest Profile dialog
      console.log('Verifying that Guest Profile dialog appeared after clicking New Profile...');
      const profileDialog = page.locator('[role="dialog"][aria-label*="Guest Profile"], [role="dialog"][aria-label*="Profile"], [aria-label*="Guest Profile"]').first();
      if (await profileDialog.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
        console.log('Guest Profile dialog appeared successfully');
      } else {
        console.log('WARNING: Guest Profile dialog did not appear after clicking New Profile');
        await page.screenshot({ path: path.join(downloadsPath, `guest_profile_dialog_missing_${Date.now()}.png`) });
      }
      await page.waitForTimeout(3000); // Wait for the popup to fully load
    }

    // Handle the Guest Profile dialog if the New Profile link was clicked
    if (newProfileClicked) {
      try {
        console.log('Waiting for Guest Profile dialog to appear...');
        // Wait for the page to stabilize
        await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.MEDIUM }).catch(() => {
          console.log('Network idle timeout, continuing anyway');
        });

        // Retry mechanism for the dialog
        let dialogFound = false;
        let profileDialog;
        for (let attempt = 1; attempt <= 3; attempt++) {
          console.log(`Attempt ${attempt} to find Guest Profile dialog...`);
          profileDialog = page.locator('[role="dialog"][aria-label*="Guest Profile"], [role="dialog"][aria-label*="Profile"], [aria-label*="Guest Profile"]').first();
          if (await profileDialog.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
            dialogFound = true;
            // Log the dialog's attributes to debug its role and name
            const dialogAttributes = await profileDialog.evaluate(el => ({
              role: el.getAttribute('role'),
              ariaLabel: el.getAttribute('aria-label')
            }));
            console.log('Guest Profile dialog found with attributes:', dialogAttributes);
            break;
          } else {
            console.log('Guest Profile dialog not found on attempt', attempt);
            await page.waitForTimeout(5000); // Wait before retrying
          }
        }

        if (!dialogFound) {
          console.log('ERROR: Guest Profile dialog did not appear after 3 attempts');
          // Check for any error messages on the page
          const errorMessages = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && /error|failed|invalid/i.test(el.textContent));
            return elements.map(el => el.textContent.trim());
          });
          console.log('Potential error messages on the page:', errorMessages);
          await page.screenshot({ path: path.join(downloadsPath, `guest_profile_dialog_error_${Date.now()}.png`) });
          throw new Error('Guest Profile dialog not found after clicking New Profile');
        }

        await page.waitForTimeout(2000);

        console.log('Filling in Last Name...');
        const nameInput = profileDialog.locator('input[id*="name"], input[aria-labelledby*="name"]').nth(0);
        if (await nameInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await nameInput.click();
          await nameInput.fill(clientName);
          console.log(`Set Last Name to: ${clientName}`);
        } else {
          console.log('Last Name field not found, trying alternate selector...');
          const alternateNameInput = profileDialog.getByLabel('Name', { exact: true });
          if (await alternateNameInput.isVisible({ timeout: 3000 })) {
            await alternateNameInput.click();
            await alternateNameInput.fill(clientName);
            console.log(`Set Last Name to: ${clientName} using alternate method`);
          } else {
            console.log('Last Name field not found with alternate selector');
          }
        }

        console.log('Filling in First Name...');
        const firstNameInput = profileDialog.locator('input[id*="firstName"], input[aria-labelledby*="firstName"]').nth(0);
        if (await firstNameInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await firstNameInput.click();
          await firstNameInput.fill(firstName);
          console.log(`Set First Name to: ${firstName}`);
        } else {
          console.log('First Name field not found, trying alternate selector...');
          const alternateFirstNameInput = profileDialog.getByRole('textbox', { name: 'First Name' }).nth(0);
          if (await alternateFirstNameInput.isVisible({ timeout: 3000 })) {
            await alternateFirstNameInput.click();
            await alternateFirstNameInput.fill(firstName);
            console.log(`Set First Name to: ${firstName} using alternate method`);
          } else {
            console.log('First Name field not found with alternate selector');
          }
        }

        console.log('Looking for MOBILE row...');
        const mobileRow = profileDialog.getByRole('row', { name: 'MOBILE Communication Type' });
        const mobileCommValue = mobileRow.getByLabel('Communication Value');
        
        if (await mobileCommValue.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await mobileCommValue.click();
          try {
            const gridCellInput = profileDialog.getByRole('gridcell', { name: 'Communication Value Communication Value' })
                              .getByLabel('Communication Value');
            if (await gridCellInput.isVisible({ timeout: 3000 })) {
              await gridCellInput.fill(telephoneNumber);
              console.log(`Set telephone number to: ${telephoneNumber} using gridcell`);
            } else {
              await mobileCommValue.fill(telephoneNumber);
              console.log(`Set telephone number to: ${telephoneNumber} using direct input`);
            }
          } catch (inputError) {
            console.log('Error with input field, trying direct entry:', inputError.message);
            await mobileCommValue.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using fallback`);
          }
        } else {
          console.log('MOBILE row not found, looking for any Communication Value field...');
          const anyCommValue = profileDialog.locator('input[aria-label*="Communication Value"]').first();
          if (await anyCommValue.isVisible({ timeout: 3000 })) {
            await anyCommValue.click();
            await anyCommValue.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using generic field`);
          } else {
            console.log('Communication Value field not found');
          }
        }
            
        console.log('Clicking Save and Select Profile button...');
        const saveButton = profileDialog.getByRole('button', { name: 'Save and Select Profile' }).nth(0);
        if (await saveButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await saveButton.click();
          console.log('Clicked Save and Select Profile button');
        } else {
          console.log('Save and Select Profile button not found, trying alternate selector...');
          const altSaveButton = profileDialog.locator('button:has-text("Save and Select Profile")').first();
          if (await altSaveButton.isVisible({ timeout: 3000 })) {
            await altSaveButton.click();
            console.log('Clicked Save and Select Profile button using alternate method');
          } else {
            throw new Error('Could not find Save and Select Profile button');
          }
        }
        
        console.log('Waiting after saving profile...');
        await page.waitForTimeout(2000);
      } catch (profileError) {
        console.log('Error handling Guest Profile dialog:', profileError.message);
        await page.screenshot({ 
          path: path.join(downloadsPath, `profile_dialog_error_${Date.now()}.png`) 
        }).catch(e => console.log('Error taking screenshot:', e.message));
        throw profileError; // Re-throw to fail the script if this step fails
      }
    } else {
      console.log('Skipping Guest Profile dialog handling because New Profile link was not clicked');
      throw new Error('Failed to click New Profile link, cannot proceed with guest profile creation');
    }

    // Set the room number
    const roomInput = page.getByRole('textbox', { name: 'Room', exact: true }).nth(0);
    if (await roomInput.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      await roomInput.click();
      await roomInput.fill(roomNumber);
      console.log(`Set room number to ${roomNumber}`);
    } else {
      console.log('Room field not found');
      await page.screenshot({ path: path.join(downloadsPath, `room_input_not_found_${Date.now()}.png`) });
    }

    // Click the Search button
    const searchButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await searchButton.click();
      console.log('Clicked Search button');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search button not found');
      await page.screenshot({ path: path.join(downloadsPath, `search_button_not_found_${Date.now()}.png`) });
    }

    // Look for Room Details dialog
    console.log('Looking for Room Details dialog...');
    const roomDetailsDialog = page.locator('[role="dialog"][aria-label*="Room Details"], [aria-label*="Room Details"]').first();
    const isRoomDetailsVisible = await roomDetailsDialog.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false);
    
    if (isRoomDetailsVisible) {
      console.log('Room Details dialog found');
      // Log the dialog's attributes to debug
      const dialogAttributes = await roomDetailsDialog.evaluate(el => ({
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      }));
      console.log('Room Details dialog attributes:', dialogAttributes);

      try {
        const roomNumberInput = roomDetailsDialog.locator('input[id*="roomId"]').nth(0);
        if (await roomNumberInput.isVisible({ timeout: 3000 })) {
          const currentValue = await roomNumberInput.inputValue();
          if (!currentValue) {
            console.log('Room number field is empty, filling with:', roomNumber);
            await roomNumberInput.fill(roomNumber);
          } else {
            console.log('Room number field already filled with:', currentValue);
          }
        } else {
          console.log('Room number input field not found in dialog');
        }
      } catch (roomInputError) {
        console.log('Could not check/fill room number field:', roomInputError.message);
      }
      
      const dialogSearchButton = roomDetailsDialog.getByRole('button', { name: 'Search' }).nth(0);
      if (await dialogSearchButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
        console.log('Clicking Search button in Room Details dialog');
        await dialogSearchButton.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('Search button in Room Details dialog not found');
      }
      
      await page.screenshot({ path: path.join(downloadsPath, 'after_dialog_search.png') });
    } else {
      console.log('Room Details dialog not found, continuing with normal flow');
      await page.screenshot({ path: path.join(downloadsPath, `room_details_dialog_not_found_${Date.now()}.png`) });
    }
    
    // Look for Do Not Move checkbox
    try {
      console.log('Looking for Do Not Move checkbox...');
      const doNotMoveCheckbox = page.locator('input[type="checkbox"][id*="doNotMove"], input[type="checkbox"][id*="DoNotMove"]').nth(0);
      const doNotMoveLabel = page.locator('text=/Do Not Move/i').nth(0);
      
      if (await doNotMoveCheckbox.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move checkbox, clicking');
        await doNotMoveCheckbox.click();
      } else if (await doNotMoveLabel.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move label, clicking');
        await doNotMoveLabel.click();
      } else {
        console.log('Do Not Move option not found');
        await page.screenshot({ path: path.join(downloadsPath, `do_not_move_not_found_${Date.now()}.png`) });
      }
    } catch (moveError) {
      console.log('Error with Do Not Move option:', moveError.message);
    }
    
    // Look for Select Room button
    console.log('Looking for Select Room button...');
    await page.screenshot({ path: path.join(downloadsPath, 'before_select_room.png') });
    
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).nth(0);
    if (await selectRoomLink.isVisible({ timeout: TIMEOUTS.SHORT })) {
      console.log('Found Select Room link, clicking');
      await selectRoomLink.click();
      console.log('Clicked Select Room link');
    } else {
      const selectRoomButton = page.getByRole('button', { name: 'Select Room' }).nth(0);
      if (await selectRoomButton.isVisible({ timeout: 3000 })) {
        console.log('Found Select Room button, clicking');
        await selectRoomButton.click();
        console.log('Clicked Select Room button');
      } else {
        console.log('Looking for any element with "Select Room" text');
        const selectRoomText = page.locator(':text("Select Room")').first();
        if (await selectRoomText.isVisible({ timeout: 3000 })) {
          console.log('Found element with Select Room text, clicking');
          await selectRoomText.click();
        } else {
          console.log('Using JavaScript to find Select Room element');
          const foundElement = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && el.textContent.trim() === 'Select Room');
            if (elements.length > 0) {
              elements[0].click();
              return true;
            }
            return false;
          });
          if (foundElement) {
            console.log('Found and clicked Select Room with JavaScript');
          } else {
            console.log('Could not find Select Room element');
            await page.screenshot({ path: path.join(downloadsPath, `select_room_not_found_${Date.now()}.png`) });
          }
        }
      }
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(downloadsPath, 'after_select_room.png') });
    
    // Search for rates
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchRatesButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await searchRatesButton.click();
      console.log('Clicked Search for rates');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search rates button not found');
      await page.screenshot({ path: path.join(downloadsPath, `search_rates_button_not_found_${Date.now()}.png`) });
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'rates_search.png') });

    // Select the rate (avoid clicking "Fixed Rate" checkbox unless necessary)
    try {
      // First, select the rate row (not the checkbox)
      const rateRow = page.locator('tr[_afrrk]').first();
      if (await rateRow.isVisible({ timeout: TIMEOUTS.SHORT })) {
        await rateRow.click();
        console.log('Clicked rate row');
        await page.waitForTimeout(2000);
      } else {
        console.log('Rate row not found, trying specific rate selector...');
        const rateSelector = page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]').first();
        if (await rateSelector.isVisible({ timeout: 3000 })) {
          // Check if this is a checkbox (likely "Fixed Rate")
          const isCheckbox = await rateSelector.evaluate(el => el.tagName.toLowerCase() === 'input' && el.type === 'checkbox');
          if (!isCheckbox) {
            await rateSelector.click();
            console.log('Selected rate (not a checkbox)');
            await page.waitForTimeout(2000);
          } else {
            console.log('Skipping click on Fixed Rate checkbox to avoid changing rate display');
          }
        } else {
          console.log('Rate selector not found');
        }
      }
    } catch (rateError) {
      console.log('Error selecting rate:', rateError.message);
    }

    // Look for the "Select" button to confirm the rate
    let rateSelected = false;
    const rateSelectButton = page.getByRole('button', { name: /Select/i }).first();
    if (await rateSelectButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await rateSelectButton.click();
      console.log('Clicked Select button for rate');
      rateSelected = true;
      await page.waitForTimeout(3000);
    } else {
      console.log('Rate Select button not found, trying alternate selector...');
      const altRateSelectButton = page.locator('button:has-text("Select")').first();
      if (await altRateSelectButton.isVisible({ timeout: 3000 })) {
        await altRateSelectButton.click();
        console.log('Clicked Select button for rate using alternate selector');
        rateSelected = true;
        await page.waitForTimeout(3000);
      } else {
        console.log('Rate Select button not found with alternate selector, trying JavaScript...');
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
            .filter(btn => btn.textContent && /Select/i.test(btn.textContent));
          if (buttons.length > 0) {
            buttons[0].click();
            return true;
          }
          return false;
        });
        if (clicked) {
          console.log('Clicked Select button for rate using JavaScript');
          rateSelected = true;
          await page.waitForTimeout(3000);
        } else {
          console.log('Rate Select button not found with any method');
          await page.screenshot({ path: path.join(downloadsPath, `rate_select_button_not_found_${Date.now()}.png`) });
        }
      }
    }

    await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection.png') });
    
    // Extract the rate
    console.log('Extracting rate from screen...');
    let operaRate = 0;

    // Wait for the page to stabilize
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.MEDIUM }).catch(() => {
      console.log('Network idle timeout during rate extraction, continuing anyway');
    });

    try {
      // Primary locator: Target the span containing the rate directly
      const rateElement = page.locator('span.x2d7').getByText(/[\d,]+\.\d{2}\s*ZAR/).first();
      if (await rateElement.isVisible({ timeout: TIMEOUTS.SHORT })) {
        const rateText = await rateElement.textContent();
        console.log(`Found rate text: ${rateText}`);

        const rateMatch = rateText.match(/[\d,.]+/);
        if (rateMatch) {
          const rateString = rateMatch[0].replace(/,/g, '');
          operaRate = parseFloat(rateString);
          console.log(`Extracted Opera rate: ${operaRate}`);
        } else {
          console.log('Could not extract numeric value from rate text');
        }
      } else {
        console.log('Rate element not found with primary selector, trying alternate approach...');
        
        // Fallback: Use a partial ID match for the <a> tag
        const rateElementFallback = page.locator('a[id*="feNetAmnt:estmtdtotal"]').getByText(/[\d,]+\.\d{2}\s*ZAR/).first();
        if (await rateElementFallback.isVisible({ timeout: 3000 })) {
          const rateText = await rateElementFallback.textContent();
          console.log(`Found rate text with fallback: ${rateText}`);
          
          const rateMatch = rateText.match(/[\d,.]+/);
          if (rateMatch) {
            const rateString = rateMatch[0].replace(/,/g, '');
            operaRate = parseFloat(rateString);
            console.log(`Extracted Opera rate with fallback: ${operaRate}`);
          } else {
            console.log('Could not extract numeric value from fallback rate text');
          }
        } else {
          console.log('Rate element not found with fallback selector');
        }
      }

      // JavaScript fallback: Search for a span with class="x2d7" containing a number and "ZAR"
      if (operaRate === 0) {
        console.log('Trying JavaScript approach to find rate...');
        operaRate = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('span.x2d7'))
            .filter(el => el.textContent && /[\d,]+\.\d{2}\s*ZAR/.test(el.textContent));
          
          if (elements.length > 0) {
            const rateText = elements[0].textContent;
            const rateMatch = rateText.match(/[\d,.]+/);
            if (rateMatch) {
              const cleanedRate = rateMatch[0].replace(/,/g, '');
              const parsedRate = parseFloat(cleanedRate);
              if (!isNaN(parsedRate)) {
                return parsedRate;
              }
            }
          }
          return 0;
        });
        console.log(`Found Opera rate using JavaScript: ${operaRate}`);
      }

      // Debug: Check if any element with "ZAR" exists on the page
      if (operaRate === 0) {
        console.log('Debugging: Checking for any elements with "ZAR" on the page...');
        const zarElements = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'))
            .filter(el => el.textContent && el.textContent.includes('ZAR'))
            .map(el => ({
              text: el.textContent,
              tag: el.tagName,
              class: el.className,
              id: el.id
            }));
          return elements;
        });
        console.log('Elements with "ZAR":', zarElements);
      }

      await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction.png') });
    } catch (rateError) {
      console.log('Error extracting rate:', rateError.message);
    }

    if (operaRate === 0) {
      console.log('WARNING: Could not extract rate from screen. Using default value of 0.');
    }

    // Calculate discount
    const airRateNum = parseFloat(airRate);
    console.log(`Air rate (converted to number): ${airRateNum}`);

    let discountAmount = 0;
    if (!isNaN(operaRate) && !isNaN(airRateNum)) {
      discountAmount = operaRate - (airRateNum * 0.77);
    } else {
      console.log('WARNING: Invalid rates for discount calculation. Using 0 as discount.');
    }

    const roundedDiscount = Math.round(discountAmount);
    console.log(`Calculated discount: ${discountAmount} (rounded to ${roundedDiscount})`);

    // Apply discount and complete booking
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.MEDIUM }).catch(() => {
      console.log('Network idle timeout during final steps, continuing anyway');
    });

    const discountAmountInput = page.getByRole('textbox', { name: /Discount Amount/i }).nth(0);
    if (await discountAmountInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await discountAmountInput.click();
      await discountAmountInput.fill(roundedDiscount.toString());
      console.log(`Set discount amount to ${roundedDiscount}`);
    } else {
      console.log('Discount Amount field not found');
      await page.screenshot({ path: path.join(downloadsPath, `discount_amount_not_found_${Date.now()}.png`) });
    }

    const discountCodeInput = page.getByRole('textbox', { name: /Discount Code/i }).nth(0);
    if (await discountCodeInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      console.log(`Set discount code to ${discountCode}`);
    } else {
      console.log('Discount Code field not found');
      await page.screenshot({ path: path.join(downloadsPath, `discount_code_not_found_${Date.now()}.png`) });
    }

    const methodSelect = page.getByLabel(/Method/i).nth(0);
    if (await methodSelect.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await methodSelect.selectOption('FCA');
      console.log('Selected FCA payment method');
    } else {
      console.log('Method selector not found');
      await page.screenshot({ path: path.join(downloadsPath, `method_selector_not_found_${Date.now()}.png`) });
    }

    const bookNowButton = page.getByRole('button', { name: /Book Now/i }).nth(0);
    if (await bookNowButton.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await bookNowButton.click();
      console.log('Clicked Book Now');
      await page.waitForTimeout(8000);
    } else {
      console.log('ERROR: Book Now button not found');
      await page.screenshot({ path: path.join(downloadsPath, `book_now_not_found_${Date.now()}.png`) });
      throw new Error('Book Now button not found, cannot complete booking');
    }

    // Validate booking completion
    console.log('Validating booking completion...');
    const confirmationMessage = page.locator('text=/Booking Confirmed|Reservation Created/i').first();
    if (await confirmationMessage.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      console.log('Booking confirmation message found:', await confirmationMessage.textContent());
    } else {
      console.log('WARNING: Booking confirmation message not found');
      await page.screenshot({ path: path.join(downloadsPath, `booking_confirmation_missing_${Date.now()}.png`) });
    }

    await page.screenshot({ path: path.join(downloadsPath, 'booking_complete.png') });

    // Click Exit Booking
    const exitButton = page.getByRole('button', { name: /Exit Booking/i }).nth(0);
    if (await exitButton.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      await exitButton.click();
      console.log('Clicked Exit Booking');
    } else {
      console.log('Exit Booking button not found');
      await page.screenshot({ path: path.join(downloadsPath, `exit_booking_not_found_${Date.now()}.png`) });
    }
    
    console.log('Booking process completed successfully');

    // Booking summary
    console.log('=== Booking Summary ===');
    console.log(`Guest: ${firstName} ${clientName}`);
    console.log(`Room: ${roomNumber}`);
    console.log(`Dates: ${startDate} to ${endDate}`);
    console.log(`Telephone: ${telephoneNumber}`);
    console.log(`Opera Rate: ${operaRate} ZAR`);
    console.log(`Air Rate: ${airRateNum} ZAR`);
    console.log(`Discount Amount: ${roundedDiscount} ZAR`);
    console.log(`Discount Code: ${discountCode}`);
    console.log(`Payment Method: FCA`);
    console.log('======================');

    return {
      success: true,
      message: `Booking completed for ${firstName} ${clientName} in room ${roomNumber}`,
      details: {
        operaRate,
        airRate: airRateNum,
        discountAmount: roundedDiscount,
        discountCode
      }
    };
    
  } catch (error) {
    console.error(`Error in booking process: ${error.message}`);
    
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

async function main() {
  const clientName = process.argv[2] || 'TestClient';
  const firstName = process.argv[3] || 'Test';
  const telephoneNumber = process.argv[4] || '1234567890';
  const roomNumber = process.argv[5] || '0405';
  const startDate = process.argv[6] || '15.05.2025';
  const endDate = process.argv[7] || '18.05.2025';
  const airRate = process.argv[8] || '1850';
  const discountCode = process.argv[9] || 'OTH';

  // Input validation
  const errors = [];

  if (!clientName || clientName.trim() === '') {
    errors.push('Client name is required and cannot be empty');
  }
  if (!firstName || firstName.trim() === '') {
    errors.push('First name is required and cannot be empty');
  }
  if (!telephoneNumber || !/^\d+$/.test(telephoneNumber)) {
    errors.push('Telephone number is required and must contain only digits');
  }
  if (!roomNumber || roomNumber.trim() === '') {
    errors.push('Room number is required and cannot be empty');
  }
  if (!startDate || !/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)) {
    errors.push('Start date is required and must be in the format DD.MM.YYYY');
  }
  if (!endDate || !/^\d{2}\.\d{2}\.\d{4}$/.test(endDate)) {
    errors.push('End date is required and must be in the format DD.MM.YYYY');
  }
  if (!airRate || isNaN(parseFloat(airRate)) || parseFloat(airRate) <= 0) {
    errors.push('Air rate is required and must be a positive number');
  }
  if (!discountCode || discountCode.trim() === '') {
    errors.push('Discount code is required and cannot be empty');
  }

  // Validate that end date is after start date
  const startDateObj = new Date(startDate.split('.').reverse().join('-'));
  const endDateObj = new Date(endDate.split('.').reverse().join('-'));
  if (startDateObj >= endDateObj) {
    errors.push('End date must be after start date');
  }

  if (errors.length > 0) {
    console.error('❌ Input validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Running booking with parameters:');
  console.log(`Client: ${firstName} ${clientName}`);
  console.log(`Phone: ${telephoneNumber}`);
  console.log(`Room: ${roomNumber}`);
  console.log(`Dates: ${startDate} to ${endDate}`);
  console.log(`Air Rate: ${airRate} (Discount Code: ${discountCode})`);
  
  const result = await createBooking(
    clientName,
    firstName,
    telephoneNumber,
    roomNumber,
    startDate,
    endDate,
    airRate,
    discountCode
  );
  
  if (result.success) {
    console.log('✅ Booking completed successfully!');
    console.log(result.message);
    console.log('Booking Details:', result.details);
    process.exit(0);
  } else {
    console.error('❌ Booking failed:');
    console.error(result.error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { createBooking };