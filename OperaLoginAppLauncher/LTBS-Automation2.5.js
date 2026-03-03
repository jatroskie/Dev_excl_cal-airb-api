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
        timeout: 60000 
      });
      
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
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
    await bookingsLink.waitFor({ state: 'visible', timeout: 30000 });
    await bookingsLink.click();
    console.log('Clicked Bookings');
    await page.waitForTimeout(2000);
    
    const reservationsItem = page.getByText('Reservations', { exact: true }).nth(0);
    await reservationsItem.waitFor({ state: 'visible', timeout: 30000 });
    await reservationsItem.click();
    console.log('Clicked Reservations');
    await page.waitForTimeout(2000);
    
    const lookToBookItem = page.getByText('Look To Book Sales Screen').nth(0);
    await lookToBookItem.waitFor({ state: 'visible', timeout: 30000 });
    await lookToBookItem.click();
    console.log('Clicked Look To Book Sales Screen');
    await page.waitForTimeout(3000);
    
    console.log('Entering AirBnB as travel agent...');
    const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
    await travelAgentInput.waitFor({ state: 'visible', timeout: 30000 });
    await travelAgentInput.click();
    await travelAgentInput.fill('airbnb');
    
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
    await page.screenshot({ path: path.join(downloadsPath, 'airbnb_popup.png') });
    
    console.log('Looking for AirBnB in results...');
    const manageProfileHeading = page.locator('text="Manage Profile"').first();
    const isProfileSearchPopup = await manageProfileHeading.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (isProfileSearchPopup) {
      console.log('Found Profile Search popup');
      
      const airBnBEntry = page.locator('text="AirBnB"').first();
      const hasAirBnBResult = await airBnBEntry.isVisible({ timeout: 5000 }).catch(() => false);
      
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
        if (await newProfileLink.isVisible({ timeout: 5000 })) {
          await newProfileLink.click();
          console.log('Clicked New Profile link');
        }
      }
    }
    
    await page.waitForTimeout(5000);
    console.log('Continuing with booking process...');
    await page.screenshot({ path: path.join(downloadsPath, 'booking_form.png') });
    
    const arrivalInput = page.getByRole('textbox', { name: 'Arrival' }).nth(0);
    if (await arrivalInput.isVisible({ timeout: 10000 })) {
      await arrivalInput.click();
      await arrivalInput.fill(startDate);
      console.log(`Set arrival date to ${startDate}`);
    } else {
      console.log('Arrival field not found');
    }
    
    const departureInput = page.getByRole('textbox', { name: 'Departure' }).nth(0);
    if (await departureInput.isVisible({ timeout: 5000 })) {
      await departureInput.click();
      await departureInput.fill(endDate);
      console.log(`Set departure date to ${endDate}`);
    } else {
      console.log('Departure field not found');
    }
    
    const adultsInput = page.getByRole('textbox', { name: 'Adults' }).nth(0);
    if (await adultsInput.isVisible({ timeout: 5000 })) {
      await adultsInput.click();
      await adultsInput.fill('2');
      console.log('Set adults to 2');
    } else {
      console.log('Adults field not found');
    }
    await page.waitForTimeout(3000);
    const roomInput = page.getByRole('textbox', { name: 'Room', exact: true }).nth(0);
    if (await roomInput.isVisible({ timeout: 10000 })) {
      await roomInput.click();
      await roomInput.fill(roomNumber);
      console.log(`Set room number to ${roomNumber}`);
    } else {
      console.log('Room field not found');
    }
    await page.waitForTimeout(3000);
    const searchButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchButton.isVisible({ timeout: 5000 })) {
      await searchButton.click();
      console.log('Clicked Search button');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search button not found');
    } 

    console.log('Looking for Room Details dialog...');
    const roomDetailsDialog = page.locator('div[role="dialog"][aria-label="Room Details"]');
    const isRoomDetailsVisible = await roomDetailsDialog.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (isRoomDetailsVisible) {
      console.log('Room Details dialog found');
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


      const dialogSearchButton = roomDetailsDialog.getByRole('button', { name: 'Search' }).nth(0);
      if (await dialogSearchButton.isVisible({ timeout: 5000 })) {
        console.log('Clicking Search button in Room Details dialog');
        await dialogSearchButton.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('Search button in Room Details dialog not found');
      }
      
      await page.screenshot({ path: path.join(downloadsPath, 'after_dialog_search.png') });
    } else {
      console.log('Room Details dialog not found, continuing with normal flow');
    }
    
    console.log('Looking for Select Room button...');
    await page.screenshot({ path: path.join(downloadsPath, 'before_select_room.png') });
    
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).first();
    if (await selectRoomLink.isVisible({ timeout: 5000 })) {
      console.log('Found Select Room link, clicking');
      await page.waitForTimeout(2000);
      await selectRoomLink.click();
      console.log('Clicked Select Room link');
    } else {
      const selectRoomButton = page.getByRole('button', { name: 'Select Room' }).first();
      if (await selectRoomButton.isVisible({ timeout: 3000 })) {
        console.log('Found Select Room button, clicking');
        await page.waitForTimeout(2000);
        await selectRoomButton.click();
        console.log('Clicked Select Room button');
      } else {
        console.log('Looking for any element with "Select Room" text');
        const selectRoomText = page.locator(':text("Select Room")').first();
        if (await selectRoomText.isVisible({ timeout: 3000 })) {
          console.log('Found element with Select Room text, clicking');
          await page.waitForTimeout(2000);
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
            throw new Error('Could not find Select Room element');
          }
        }
      }
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(downloadsPath, 'after_select_room.png') });
    
    // ===== IMPROVED RATE SELECTION CODE BEGINS HERE =====
    console.log('Starting improved rate selection process...');
    await page.screenshot({ path: path.join(downloadsPath, 'before_rate_selection.png') });

    // Step 1: Search for rates
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).first();
    if (await searchRatesButton.isVisible({ timeout: 5000 })) {
      console.log('Found Search button for rates, clicking...');
      await page.waitForTimeout(1000);
      await searchRatesButton.click();
      console.log('Clicked Search for rates');
      
      // Wait for rate results to load
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(downloadsPath, 'after_rate_search.png') });
    } else {
      console.log('Search rates button not found, checking if rates are already displayed');
    }

    // Step 2: Check if there's a popup/dialog present for rate selection
    console.log('Checking for rate selection popup/dialog...');
try {
  // First look for common dialog container elements
  const dialogSelectors = [
    page.locator('div[role="dialog"]'),
    page.locator('div.p_AFDialog'),
    page.locator('div.AFModalGlassPane').filter({ has: page.locator('div[role="dialog"]') })
  ];
  
  let dialog = null;
  for (const selector of dialogSelectors) {
    if (await selector.isVisible({ timeout: 3000 })) {
      dialog = selector;
      console.log('Found dialog/popup container');
      break;
    }
  }
  
  // If a dialog is found, try to interact with elements inside it
  if (dialog) {
    console.log('Working with rate selection inside popup dialog...');
    
    // Take a screenshot of the popup
    await page.screenshot({ path: path.join(downloadsPath, 'rate_popup_dialog.png') });
    
    // Try the exact locator from Playwright codegen within the popup context
    const rateLocator = page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]');
    
    if (await rateLocator.isVisible({ timeout: 5000 })) {
      console.log('Found rate element with specific ID in popup, clicking...');
      await page.waitForTimeout(1000);
      await rateLocator.click();
      console.log('Successfully clicked rate element');
    } else {
      console.log('Rate element with specific ID not found in popup, trying generic selectors...');
      
      // Try to find any rate row in the popup
      const popupRateRow = dialog.locator('tr[_afrrk]').first();
      if (await popupRateRow.isVisible({ timeout: 3000 })) {
        console.log('Found rate row in popup with _afrrk attribute, clicking...');
        await popupRateRow.click();
        console.log('Successfully clicked rate row in popup');
      } else {
        // Try other generic selectors within popup
        const rateRows = [
          dialog.locator('tr').filter({ has: dialog.locator('td:has-text("RACK")') }).first(),
          dialog.locator('tr:has-text("Select")').first(),
          dialog.locator('table[_afrrk] tr').first()
        ];
        
        for (const row of rateRows) {
          if (await row.isVisible({ timeout: 2000 })) {
            console.log('Found rate row in popup using generic selector, clicking...');
            await row.click();
            console.log('Successfully clicked rate row in popup');
            break;
          }
        }
      }
    }
    
    // After selecting the rate, click the Select button within the popup
    await page.waitForTimeout(2000); // Ensure UI stabilizes after rate selection
    const selectButton = dialog.getByRole('button', { name: 'Select', exact: true }).first();

    if (await selectButton.isVisible({ timeout: 5000 })) {
      console.log('Found Select button in popup, verifying interactability...');

      // Ensure the button is interactable
      await selectButton.waitFor({ state: 'visible', timeout: 5000 });
      const isDisabled = await selectButton.isDisabled();
      if (isDisabled) {
        console.log('Select button is disabled, cannot proceed');
        throw new Error('Select button is disabled in rate popup');
      }

      // Log button details for debugging
      const buttonDetails = await selectButton.evaluate((el) => ({
        tag: el.tagName,
        text: el.textContent.trim(),
        id: el.id || 'no-id',
        classes: el.className || 'no-class',
        outerHTML: el.outerHTML,
        isVisible: el.offsetParent !== null,
        computedStyle: window.getComputedStyle(el).display
      }));
      console.log('Select button details:', buttonDetails);

      // Scroll into view and attempt to click
      await selectButton.scrollIntoViewIfNeeded();
      await selectButton.click({ timeout: 5000 });
      console.log('Successfully clicked Select button in popup');
    } else {
      console.log('Select button not found in popup with role, trying other selectors...');

      // Broader selectors for the Select button
      const selectButtons = [
        dialog.locator('button:has-text("Select")').first(),
        dialog.locator('a:has-text("Select")').first(),
        dialog.locator('input[type="button"][value="Select"]').first(),
        dialog.locator('[role="button"]:has-text("Select")').first(),
        dialog.locator('*:has-text("Select")').filter({ has: dialog.locator('[role="button"], button, a') }).first()
      ];

      let buttonFound = false;
      for (const button of selectButtons) {
        if (await button.isVisible({ timeout: 2000 })) {
          console.log('Found Select button in popup with alternate selector, verifying interactability...');

          // Ensure the button is interactable
          await button.waitFor({ state: 'visible', timeout: 5000 });
          const isDisabled = await button.isDisabled();
          if (isDisabled) {
            console.log('Select button (alternate selector) is disabled, skipping...');
            continue;
          }

          // Log button details for debugging
          const buttonDetails = await button.evaluate((el) => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            id: el.id || 'no-id',
            classes: el.className || 'no-class',
            outerHTML: el.outerHTML,
            isVisible: el.offsetParent !== null,
            computedStyle: window.getComputedStyle(el).display
          }));
          console.log('Select button (alternate) details:', buttonDetails);

          // Scroll into view and attempt to click
          await button.scrollIntoViewIfNeeded();
          await button.click({ timeout: 5000 });
          console.log('Successfully clicked Select button in popup with alternate selector');
          buttonFound = true;
          break;
        }
      }

      if (!buttonFound) {
        console.log('No Select buttons found in popup, trying JavaScript fallback...');
        const buttonClicked = await dialog.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
            .filter((el) => el.textContent && el.textContent.trim() === 'Select' && el.offsetParent !== null);
          if (buttons.length > 0) {
            const button = buttons[0];
            button.scrollIntoView();
            button.click();
            return { clicked: true, text: button.textContent.trim(), outerHTML: button.outerHTML };
          }
          return { clicked: false };
        });

        const clickResult = await buttonClicked.jsonValue();
        if (clickResult.clicked) {
          console.log(`Successfully clicked Select button using JavaScript: ${clickResult.text}`);
          console.log(`Button HTML: ${clickResult.outerHTML}`);
        } else {
          // Take a screenshot for debugging
          await page.screenshot({ path: path.join(downloadsPath, 'select_button_not_found.png') });

          // Log all buttons in the dialog for debugging
          const allButtons = await dialog.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
              .filter((el) => el.offsetParent !== null)
              .map((el) => ({
                text: el.textContent.trim(),
                tag: el.tagName,
                id: el.id || 'no-id',
                classes: el.className || 'no-class',
                outerHTML: el.outerHTML
              }));
            return buttons;
          });
          console.log('All buttons in dialog:', allButtons);

          throw new Error('Could not find or click Select button in rate popup with any method');
        }
      }
    }

    // Verify the popup closes
    console.log('Verifying that the rate selection popup closes...');
    const isPopupStillVisible = await dialog.isVisible({ timeout: 10000 }).catch(() => false);
    if (isPopupStillVisible) {
      console.log('Rate selection popup did not close after clicking Select');
      throw new Error('Rate selection popup failed to close');
    } else {
      console.log('Rate selection popup closed successfully');
    }

    // Take screenshot after rate selection attempt
    await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection_attempt.png') });
  }
}
catch (error) {
  console.log('Error finding dialog container:', error.message);
}

// ===== 🔴 NEW CODE STARTS HERE - RATE EXTRACTION WITHOUT CLICKING =====
console.log('Extracting rate from screen (read-only, no click)...');
let operaRate = 0;

try {
  // Use evaluate to just read the DOM without interacting with it
  operaRate = await page.evaluate(() => {
    // Your rate extraction code continues here...

            const rateElements = [
              // Primary target: spans with the class x2d7 containing ZAR
              ...Array.from(document.querySelectorAll('span.x2d7')),
              // Fallbacks for different DOM structures
              ...Array.from(document.querySelectorAll('a[id*="feNetAmnt:estmtdtotal"]')),
              ...Array.from(document.querySelectorAll('span:contains("ZAR")'))
            ];
            
            // Filter to only those containing rates
            const rateTexts = rateElements
              .filter(el => el.textContent && /[\d,]+\.\d{2}\s*ZAR/.test(el.textContent))
              .map(el => el.textContent);
            
            if (rateTexts.length > 0) {
              console.log('Found rate texts:', rateTexts);
              
              // Process the first rate found
              const rateMatch = rateTexts[0].match(/[\d,.]+/);
              if (rateMatch) {
                const rateString = rateMatch[0].replace(/,/g, '');
                return parseFloat(rateString);
              }
            }
            
            // Try other common elements that might contain the rate
            const priceElements = Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && /\d+\.\d{2}\s*ZAR/.test(el.textContent));
            
            if (priceElements.length > 0) {
              const rateMatch = priceElements[0].textContent.match(/[\d,.]+/);
              if (rateMatch) {
                const rateString = rateMatch[0].replace(/,/g, '');
                return parseFloat(rateString);
              }
            }
            
            return 0;
          });
          
          console.log(`Extracted Opera rate using JavaScript (non-interactive): ${operaRate}`);

          // Screenshot but don't interact with the rate elements
          await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction_safe.png') });
        } catch (rateError) {
          console.log('Error extracting rate (non-interactive):', rateError.message);
        }

        if (operaRate === 0) {
          console.log('WARNING: Could not extract rate from screen. Using default value of 2000.');
          operaRate = 2000; // Default to a reasonable value if extraction fails
        }

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
        // ===== END OF NEW RATE EXTRACTION CODE =====

        // Take screenshot before setting discount fields
        await page.screenshot({ path: path.join(downloadsPath, 'before_discount_fields.png') });

        // Continue with discount amount and code setting (keep your existing code)...
        
        // Wait for the page to stabilize
        console.log('Waiting for page to stabilize before interacting with discount fields...');
        await page.waitForTimeout(5000);

        // Try to find discount amount input with better fallbacks
        console.log('Attempting to set Discount Amount...');
        let discountAmountSet = false;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`Attempt ${attempt} to set Discount Amount...`);

          // Primary selector
          let discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).first();
          if (await discountAmountInput.isVisible({ timeout: 5000 })) {
            await discountAmountInput.click();
            await discountAmountInput.fill(roundedDiscount.toString());
            console.log(`Set discount amount to ${roundedDiscount} on attempt ${attempt}`);
            discountAmountSet = true;
            break;
          }

          // Try alternative selectors for discount amount
          console.log('Primary discount amount field not found, trying alternative selectors...');
          const discountFields = [
            page.locator('input[id*="disAmnt"]').first(),
            page.locator('input[aria-label*="Discount"]').first(),
            page.locator('input[id*="discount"]').first(),
            page.locator('input').filter({ hasText: 'Discount' }).first(),


            // Check inside iframes
            page.frameLocator('iframe[title="Content"]').locator('input[id*="disAmnt"]').first(),
            page.frameLocator('iframe[title="Content"]').locator('input[aria-label*="Discount"]').first()
          ];

          for (const field of discountFields) {
            if (await field.isVisible({ timeout: 2000 })) {
              console.log('Found alternative discount amount field');
              await field.click();
              await field.fill(roundedDiscount.toString());
              console.log(`Set discount amount to ${roundedDiscount} using alternative field on attempt ${attempt}`);
              discountAmountSet = true;
              break;
            }
          }

          if (discountAmountSet) break;

          // Wait before retrying
          console.log('Discount Amount field not found, waiting before retrying...');
          await page.waitForTimeout(3000);
        }

        if (!discountAmountSet) {
          console.log('WARNING: Could not find any discount amount field, attempting JavaScript...');
          const discountSet = await page.evaluate((discount) => {
            // Try to find any input field that might be for discount
            const possibleInputs = Array.from(document.querySelectorAll('input[type="text"]'))
              .filter(el => {
                const nearbyText = el.parentElement?.textContent || '';
                return nearbyText.toLowerCase().includes('discount') && !el.disabled && el.offsetParent !== null;
              });

            if (possibleInputs.length > 0) {
              possibleInputs[0].value = discount;
              possibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              possibleInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, roundedDiscount.toString());

          if (discountSet) {
            console.log(`Set discount amount to ${roundedDiscount} using JavaScript`);
            discountAmountSet = true;
          } else {
            // Log the DOM for debugging
            const discountInputs = await page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input[type="text"]'))
                .filter(el => el.offsetParent !== null)
                .map(el => ({
                  id: el.id || 'no-id',
                  name: el.name || 'no-name',
                  ariaLabel: el.getAttribute('aria-label') || 'no-aria-label',
                  nearbyText: el.parentElement?.textContent?.trim().substring(0, 100) || 'no-text',
                  outerHTML: el.outerHTML
                }));
              return inputs;
            });
            console.log('All visible text inputs on the page:', discountInputs);

            throw new Error('Could not set discount amount with any method');
          }
        }

        // Take screenshot after attempting to set discount amount
        await page.screenshot({ path: path.join(downloadsPath, 'after_discount_amount_attempt.png') });

        // Try to find discount code input with better fallbacks
        console.log('Attempting to set Discount Code...');
        let discountCodeSet = false;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`Attempt ${attempt} to set Discount Code...`);

          // Primary selector
          const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' }).first();
          if (await discountCodeInput.isVisible({ timeout: 5000 })) {
            await discountCodeInput.click();
            await discountCodeInput.fill(discountCode);
            console.log(`Set discount code to ${discountCode} on attempt ${attempt}`);
            discountCodeSet = true;
            break;
          }

          // Try alternative selectors for discount code
          console.log('Primary discount code field not found, trying alternative selectors...');
          const codeFields = [
            page.locator('input[id*="disCode"]').first(),
            page.locator('input[aria-label*="Code"]').first(),
            page.locator('input').filter({ hasText: 'Code' }).first(),
            // Check inside iframes
            page.frameLocator('iframe[title="Content"]').locator('input[id*="disCode"]').first(),
            page.frameLocator('iframe[title="Content"]').locator('input[aria-label*="Code"]').first()
          ];

          for (const field of codeFields) {
            if (await field.isVisible({ timeout: 2000 })) {
              console.log('Found alternative discount code field');
              await field.click();
              await field.fill(discountCode);
              console.log(`Set discount code to ${discountCode} using alternative field on attempt ${attempt}`);
              discountCodeSet = true;
              break;
            }
          }

          if (discountCodeSet) break;

          // Wait before retrying
          console.log('Discount Code field not found, waiting before retrying...');
          await page.waitForTimeout(3000);
        }

        if (!discountCodeSet) {
          console.log('WARNING: Could not find any discount code field, attempting JavaScript...');
          const codeSet = await page.evaluate((code) => {
            // Try to find any input field that might be for discount code
            const possibleInputs = Array.from(document.querySelectorAll('input[type="text"]'))
              .filter(el => {
                const nearbyText = el.parentElement?.textContent || '';
                return nearbyText.toLowerCase().includes('code') && !el.disabled && el.offsetParent !== null;
              });

            if (possibleInputs.length > 0) {
              possibleInputs[0].value = code;
              possibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              possibleInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, discountCode);

          if (codeSet) {
            console.log(`Set discount code to ${discountCode} using JavaScript`);
            discountCodeSet = true;
          } else {
            // Log the DOM for debugging
            const codeInputs = await page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input[type="text"]'))
                .filter(el => el.offsetParent !== null)
                .map(el => ({
                  id: el.id || 'no-id',
                  name: el.name || 'no-name',
                  ariaLabel: el.getAttribute('aria-label') || 'no-aria-label',
                  nearbyText: el.parentElement?.textContent?.trim().substring(0, 100) || 'no-text',
                  outerHTML: el.outerHTML
                }));
              return inputs;
            });
            console.log('All visible text inputs on the page:', codeInputs);

            throw new Error('Could not set discount code with any method');
          }
        }

        // ===== 🔴 NEW CODE - GUEST PROFILE HANDLING =====
        // After setting the discount and code, immediately look for and click New Profile
        console.log('Looking for New Profile link immediately after setting discount...');
        await page.screenshot({ path: path.join(downloadsPath, 'before_new_profile_search.png') });

        // Wait for a moment to ensure UI is stable
        await page.waitForTimeout(3000);

        // Try to find and click the New Profile link using a JavaScript approach first
        console.log('Using JavaScript to find and click New Profile link...');
        const newProfileClicked = await page.evaluate(() => {
          // Try to find New Profile link with different strategies
          const findLinkStrategies = [
            // Strategy 1: Look for links with exact text
            () => {
              const links = Array.from(document.querySelectorAll('a'))
                .filter(el => el.textContent && el.textContent.trim() === 'New Profile' && window.getComputedStyle(el).display !== 'none');
              return links.length > 0 ? links[0] : null;
            },
            // Strategy 2: Look for links with specific class and text
            () => {
              const links = Array.from(document.querySelectorAll('a.xt1'))
                .filter(el => el.textContent && el.textContent.trim() === 'New Profile');
              return links.length > 0 ? links[0] : null;
            },
            // Strategy 3: Look for any element with New Profile text that appears to be a link
            () => {
              const elements = Array.from(document.querySelectorAll('*'))
                .filter(el => {
                  const style = window.getComputedStyle(el);
                  return el.textContent && 
                        el.textContent.trim() === 'New Profile' && 
                        style.cursor === 'pointer' &&
                        style.display !== 'none' &&
                        el.offsetParent !== null;
                });
              return elements.length > 0 ? elements[0] : null;
            }
          ];

          // Try each strategy until we find a link
          let link = null;
          for (const strategy of findLinkStrategies) {
            link = strategy();
            if (link) break;
          }

          // If we found a link, click it
          if (link) {
            console.log(`Found New Profile link: ${link.outerHTML}`);
            link.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Use a small delay before clicking to ensure the element is properly rendered
            setTimeout(() => {
              try {
                link.click();
                console.log('Clicked New Profile link via JavaScript setTimeout');
              } catch (e) {
                console.error('Error clicking link in setTimeout:', e);
              }
            }, 100);
            
            // Also try immediate click
            try {
              link.click();
              console.log('Clicked New Profile link via JavaScript immediate');
              return { clicked: true, method: 'javascript' };
            } catch (e) {
              console.error('Error clicking link immediately:', e);
              return { clicked: false, error: e.toString() };
            }
          }
          
          return { clicked: false, error: 'No New Profile link found' };
        });

        if (newProfileClicked.clicked) {
          console.log(`Successfully clicked New Profile using ${newProfileClicked.method}`);
        } else {
          console.log('JavaScript click failed:', newProfileClicked.error);
          
          // Fall back to Playwright selectors if JavaScript approach failed
          console.log('Trying Playwright selectors for New Profile link...');
          const newProfileSelectors = [
            page.getByRole('link', { name: 'New Profile' }).first(),
            page.locator('a:has-text("New Profile")').first(),
            page.locator('a.xt1:has-text("New Profile")').first(),
            page.locator('[role="link"]:has-text("New Profile")').first()
          ];
          
          let playwrightClicked = false;
          for (const selector of newProfileSelectors) {
            try {
              if (await selector.isVisible({ timeout: 3000 })) {
                await selector.scrollIntoViewIfNeeded();
                await selector.click();
                console.log('Clicked New Profile using Playwright selector');
                playwrightClicked = true;
                break;
              }
            } catch (e) {
              console.log('Error with selector:', e.message);
            }
          }
          
          if (!playwrightClicked) {
            console.log('WARNING: Could not click New Profile with any method');
            throw new Error('Could not find or click New Profile link');
          }
        }




       // Wait for the Guest Profile dialog to appear
       await page.waitForTimeout(5000);
       await page.screenshot({ path: path.join(downloadsPath, 'after_new_profile_click.png') });

       // Now handle the Guest Profile dialog
       console.log('Looking for Guest Profile dialog...');

       // Function to find the Guest Profile dialog using multiple strategies
       async function findGuestProfileDialog() {
         // Try using JavaScript first to find the dialog
         const dialogInfo = await page.evaluate(() => {
           // Look for elements that might be dialog containers
           const possibleDialogs = Array.from(document.querySelectorAll('div'))
             .filter(el => {
               // Check if it's visible
               const isVisible = el.offsetParent !== null;
               
               // Check if it has profile-related content
               const hasProfileText = el.textContent && (
                 el.textContent.includes('Guest Profile') ||
                 el.textContent.includes('Last Name') ||
                 el.textContent.includes('First Name')
               );
               
               // Check if it has dialog-like attributes
               const hasDialogAttrs = 
                 el.getAttribute('role') === 'dialog' || 
                 el.classList.contains('p_AFDialog') ||
                 el.classList.contains('dialog');
               
               return isVisible && (hasProfileText || hasDialogAttrs);
             })
             .map(el => ({
               id: el.id || 'no-id',
               classes: el.className || 'no-classes',
               hasNameField: !!el.querySelector('input[id*="name"]'),
               hasFirstNameField: !!el.querySelector('input[id*="firstName"]'),
               hasTelephone: !!el.querySelector('input[aria-label*="Communication Value"]'),
               rect: {
                 width: el.offsetWidth,
                 height: el.offsetHeight,
                 top: el.getBoundingClientRect().top,
                 left: el.getBoundingClientRect().left
               }
             }));
           
           console.log('Possible dialogs:', possibleDialogs);
           
           // Return the first dialog that matches our criteria
           if (possibleDialogs.length > 0) {
             // Prefer dialogs with name/first name fields
             const goodDialogs = possibleDialogs.filter(d => 
               d.hasNameField || d.hasFirstNameField || d.hasTelephone);
             
             if (goodDialogs.length > 0) {
               return goodDialogs[0];
             }
             
             // Fall back to any dialog
             return possibleDialogs[0];
           }
           
           return null;
         });
         
         console.log('Dialog info from JavaScript:', dialogInfo);
         
         if (dialogInfo) {
           // Found dialog via JavaScript, now create a Playwright locator for it
           if (dialogInfo.id !== 'no-id') {
             return page.locator(`div[id="${dialogInfo.id}"]`);
           } else if (dialogInfo.classes !== 'no-classes') {
             // Use class but be more specific with dialog characteristics
             return page.locator(`div.${dialogInfo.classes.split(' ').join('.')}`);
           }
         }
         
         // If JavaScript approach failed, try common Playwright selectors
         const dialogSelectors = [
           page.getByRole('dialog', { name: 'Guest Profile' }),
           page.locator('div[role="dialog"][aria-label*="Profile"]'),
           page.locator('div.p_AFDialog'),
           page.locator('div').filter({ has: page.locator('text=Guest Profile') }),
           page.locator('div').filter({ has: page.locator('input[id*="lastName"]') }),
           page.locator('div').filter({ has: page.locator('input[id*="firstName"]') })
         ];
         
         for (const selector of dialogSelectors) {
           if (await selector.isVisible({ timeout: 2000 })) {
             return selector;
           }
         }
         
         return null;
       }

       // Try to find the Guest Profile dialog
       const profileDialog = await findGuestProfileDialog();

       if (!profileDialog) {
         console.log('Guest Profile dialog not found, taking screenshot for debugging');
         await page.screenshot({ path: path.join(downloadsPath, 'guest_profile_not_found.png') });
         throw new Error('Guest Profile dialog not found');
       }

       console.log('Guest Profile dialog found, proceeding to fill details...');

       // Function to find and fill a field in the dialog using multiple strategies
       async function findAndFillField(fieldName, value, dialog) {
         console.log(`Filling ${fieldName} with value: ${value}`);
         
         // Define selectors for different field types
         const fieldSelectors = {
           'Last Name': [
             dialog.locator('input[id*="name"], input[id*="lastName"]').first(),
             dialog.locator('input[aria-label="Name"]').first(),
             dialog.locator('input[aria-labelledby*="name"]').first(),
             dialog.getByLabel('Name', { exact: true }).first(),
             dialog.getByLabel('Last Name', { exact: true }).first()
           ],
           'First Name': [
             dialog.locator('input[id*="firstName"]').first(),
             dialog.locator('input[aria-label="First Name"]').first(),
             dialog.locator('input[aria-labelledby*="firstName"]').first(),
             dialog.getByLabel('First Name', { exact: true }).first()
           ],
           'Telephone': [
             dialog.locator('input[aria-label*="Communication Value"]').first(),
             dialog.getByRole('gridcell', { name: 'Communication Value' })
               .locator('input').first(),
             dialog.locator('input[id*="commValue"]').first()
           ]
         };
         
         // Try each selector for the field
         const selectors = fieldSelectors[fieldName];
         for (const selector of selectors) {
           try {
             if (await selector.isVisible({ timeout: 3000 })) {
               await page.waitForTimeout(1000); // Wait for stability
               await selector.click();
               await page.waitForTimeout(500);
               await selector.fill(value);
               console.log(`Successfully filled ${fieldName} with ${value}`);
               return true;
             }
           } catch (e) {
             console.log(`Error filling ${fieldName} with selector:`, e.message);
           }
         }
         
         // Try JavaScript as a last resort
         console.log(`Using JavaScript to fill ${fieldName}...`);
         const jsFilled = await dialog.evaluate((fieldNameJs, valueJs) => {
           let inputSelector = '';
           
           if (fieldNameJs === 'Last Name') {
             inputSelector = 'input[id*="name"], input[id*="lastName"], input[aria-label="Name"]';
           } else if (fieldNameJs === 'First Name') {
             inputSelector = 'input[id*="firstName"], input[aria-label="First Name"]';
           } else if (fieldNameJs === 'Telephone') {
             inputSelector = 'input[aria-label*="Communication Value"], input[id*="commValue"]';
           }
           
           const inputs = Array.from(document.querySelectorAll(inputSelector))
             .filter(el => el.offsetParent !== null);
           
           if (inputs.length > 0) {
             const input = inputs[0];
             input.value = valueJs;
             input.dispatchEvent(new Event('input', { bubbles: true }));
             input.dispatchEvent(new Event('change', { bubbles: true }));
             return true;
           }
           
           return false;
         }, fieldName, value);
         
         if (jsFilled) {
           console.log(`Successfully filled ${fieldName} using JavaScript`);
           return true;
         }
         
         console.log(`Could not fill ${fieldName} with any method`);
         return false;
       }

       // Fill the fields in the Guest Profile dialog
       await findAndFillField('Last Name', clientName, profileDialog);
       await findAndFillField('First Name', firstName, profileDialog);
       await findAndFillField('Telephone', telephoneNumber, profileDialog);

       // Take a screenshot after filling the fields
       await page.screenshot({ path: path.join(downloadsPath, 'after_filling_profile.png') });

       // Click Save and Select Profile button
       console.log('Looking for Save and Select Profile button...');
       const saveButtonSelectors = [
         profileDialog.getByRole('button', { name: 'Save and Select Profile' }).first(),
         profileDialog.locator('button:has-text("Save and Select Profile")').first(),
         profileDialog.locator('a:has-text("Save and Select Profile")').first(),
         profileDialog.locator('[role="button"]:has-text("Save and Select Profile")').first(),
         // Generic save button as fallback
         profileDialog.getByRole('button', { name: 'Save' }).first(),
         profileDialog.locator('button:has-text("Save")').first()
       ];

       let saveButtonClicked = false;
       for (const button of saveButtonSelectors) {
         try {
           if (await button.isVisible({ timeout: 3000 })) {
             await button.click();
             console.log('Clicked Save button');
             saveButtonClicked = true;
             break;
           }
         } catch (e) {
           console.log('Error with save button:', e.message);
         }
       }

       if (!saveButtonClicked) {
         console.log('Using JavaScript to find and click Save button...');
         const jsSaveClicked = await profileDialog.evaluate(() => {
           const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
             .filter(el => {
               return el.textContent && 
                     (el.textContent.includes('Save and Select Profile') || el.textContent.includes('Save')) &&
                     el.offsetParent !== null;
             });
           
           if (buttons.length > 0) {
             buttons[0].click();
             return true;
           }
           return false;
         });
         
         if (jsSaveClicked) {
           console.log('Successfully clicked Save button using JavaScript');
           saveButtonClicked = true;
         } else {
           console.log('WARNING: Could not click Save button with any method');
         }
       }

       // Wait for the dialog to close and the page to stabilize
       console.log('Waiting for profile dialog to close...');
       await page.waitForTimeout(5000);
       await page.screenshot({ path: path.join(downloadsPath, 'after_profile_save.png') });
       // ===== END OF NEW GUEST PROFILE HANDLING CODE =====

       // Try to find any visible buttons on the page and list them
       console.log('Analyzing all visible buttons on the page...');
       const buttonInfo = await page.evaluate(() => {
         const buttonElements = [
           ...Array.from(document.querySelectorAll('button')),
           ...Array.from(document.querySelectorAll('a.x4c1')), // Common class for clickable links
           ...Array.from(document.querySelectorAll('[role="button"]'))
         ];

         return buttonElements
           .filter(el => {
             // Check if the element is visible
             const style = window.getComputedStyle(el);
             const isVisible = el.offsetParent !== null &&
                               style.display !== 'none' &&
                               style.visibility !== 'hidden' &&
                               el.textContent && el.textContent.trim() !== '';
             
             // Skip elements that are part of tooltips or popups with specific content
             const textContent = el.textContent.toLowerCase();
             const isTooltipOrPopup = textContent.includes("what's new in opera cloud") ||
                                     textContent.includes("use arrow keys to read it") ||
                                     el.closest('.ogl-rw-popover-content') ||
                                     el.closest('.tooltip');
             
             return isVisible && !isTooltipOrPopup;
           })
           .map(el => ({
             tag: el.tagName,
             text: el.textContent.trim(),
             id: el.id || 'no-id',
             classes: el.className || 'no-class',
             role: el.getAttribute('role') || 'no-role',
             rect: el.getBoundingClientRect()
           }));
       });

       console.log('Relevant buttons found:', buttonInfo.length);
       buttonInfo.forEach((btn, idx) => {
         console.log(`Button ${idx + 1}: ${btn.text} (${btn.tag}, ID: ${btn.id})`);
       });
       
       


       // Create a special function to find and click the Book Now button or ANY button that might proceed
       async function findAndClickAnyProgressButton() {
        // Try exact "Book Now" first with multiple selectors
        const bookNowSelectors = [
          page.getByRole('button', { name: 'Book Now' }).first(),
          page.locator('button:has-text("Book Now")').first(),
          page.locator('a:has-text("Book Now")').first(),
          page.locator('[role="button"]:has-text("Book Now")').first(),
          page.locator('[id*="book"]:has-text("Book")').first()
        ];
  
        for (const selector of bookNowSelectors) {
          if (await selector.isVisible({ timeout: 2000 })) {
            console.log('Found Book Now button with standard selector, clicking...');
            await selector.click();
            await page.waitForTimeout(8000);
            return true;
          }
        }
  
        console.log('No Book Now button found with standard selectors, trying JavaScript...');
        const clickResult = await page.evaluate(() => {
          function tryClick(elements) {
            for (const el of elements) {
              try {
                el.click();
                return { clicked: true, text: el.textContent.trim() };
              } catch (e) {
                // Continue trying other elements
              }
            }
            return { clicked: false };
          }
  
          // Try elements with Book Now text first
          const bookNowElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"]'))
            .filter(el => el.textContent &&
                    el.textContent.toLowerCase().includes('book now') &&
                    el.offsetParent !== null);
  
          if (bookNowElements.length > 0) {
            const result = tryClick(bookNowElements);
            if (result.clicked) return { ...result, type: 'book-now' };
          }
  
          // Try elements with Book text
          const bookElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"]'))
            .filter(el => el.textContent &&
                    el.textContent.toLowerCase().includes('book') &&
                    !el.textContent.toLowerCase().includes('booking') &&
                    el.offsetParent !== null);
  
          if (bookElements.length > 0) {
            const result = tryClick(bookElements);
            if (result.clicked) return { ...result, type: 'book' };
          }
  
          // Try any prominent button as last resort
          // Looking for buttons that might be in the right bottom area (common for "next" actions)
          const allButtons = Array.from(document.querySelectorAll('button, a.x4c1, [role="button"], input[type="button"]'))
            .filter(el => el.offsetParent !== null && el.textContent && el.textContent.trim() !== '');
  
          // Sort by position - buttons at bottom right are often "next" actions
          allButtons.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            // Prioritize buttons at the bottom of the page
            if (Math.abs(rectB.bottom - rectA.bottom) > 50) {
              return rectB.bottom - rectA.bottom;
            }
            // Then prioritize buttons to the right
            return rectB.right - rectA.right;
          });
  
          if (allButtons.length > 0) {
            // Take the first 3 most prominent buttons
            const prominentButtons = allButtons.slice(0, 3);
            const result = tryClick(prominentButtons);
            if (result.clicked) return { ...result, type: 'prominent' };
          }
  
          return { clicked: false };
        });
  
        if (clickResult.clicked) {
          console.log(`Clicked ${clickResult.type} button with text: "${clickResult.text}" using JavaScript`);
          await page.waitForTimeout(8000);
          return true;
        }
  
        console.log('Could not find any suitable button to progress the booking');
        return false;
      }
  
      // Take screenshot right before looking for Book Now button
      console.log('Taking screenshot before looking for Book Now button...');
      await page.screenshot({ path: path.join(downloadsPath, 'before_book_now_button.png') });
  
      // Also dump the HTML of the page to a file for inspection
      const pageContent = await page.content();
      fs.writeFileSync(path.join(downloadsPath, 'page_before_book_now.html'), pageContent);
      console.log('Saved page HTML for debugging');
  
      // Try to click the Book Now button or any button that might progress the flow
      const buttonClicked = await findAndClickAnyProgressButton();
  
      if (!buttonClicked) {
        // If no button was found/clicked, try one last desperate approach - click in bottom right area
        console.log('No buttons found, trying to click in the bottom right area of the page...');
  
        // Get page dimensions
        const dimensions = await page.evaluate(() => {
          return {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight
          };
        });
  
        // Click in the bottom right quadrant of the page where action buttons often are
        const x = dimensions.width * 0.8;
        const y = dimensions.height * 0.8;
        await page.mouse.click(x, y);
        console.log(`Clicked at position x: ${x}, y: ${y}`);
        await page.waitForTimeout(5000);
  
        // Take another screenshot after desperate click
        await page.screenshot({ path: path.join(downloadsPath, 'after_desperate_click.png') });
  
        // Check if we have a confirmation message anyway
          const hasConfirmation = await page.locator('text=/Booking Confirmed|Reservation Created|Booking Complete/i')
          .isVisible({ timeout: 5000 })
          .catch(() => false);
  
        if (hasConfirmation) {
          console.log('Found confirmation message despite button click issues');
        } else {
          throw new Error('Book Now button not found and desperate measures failed');
        }
      } else {
        console.log('Successfully clicked a button to progress the booking');
      }
    }
  
  await page.screenshot({ path: path.join(downloadsPath, 'after_booking_attempt.png') });
  // Validate booking confirmation
  console.log('Validating booking completion...');
  const confirmationSelectors = [
    page.locator('text=/Booking Confirmed|Reservation Created/i').first(),
    page.locator('text=Booking Complete').first(),
    page.locator('text=Reservation Number').first(),
    page.locator('text=Confirmation Number').first()
  ];
  
  let confirmationFound = false;
  for (const selector of confirmationSelectors) {
    if (await selector.isVisible({ timeout: 10000 })) {
      console.log('Booking confirmation message found:', await selector.textContent());
      confirmationFound = true;
      break;
    }
  }
  
  if (!confirmationFound) {
    // Try JavaScript last resort for confirmation
    const jsConfirmation = await page.evaluate(() => {
      const possibleConfirmationTexts = [
        'booking confirmed', 'reservation created', 'booking complete', 
        'reservation number', 'confirmation number'
      ];
      
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent) {
          const text = el.textContent.toLowerCase();
          for (const confirmText of possibleConfirmationTexts) {
            if (text.includes(confirmText)) {
              return { found: true, text: el.textContent.trim() };
            }
          }
        }
      }
      return { found: false };
    });
    
    if (jsConfirmation.found) {
      console.log('Booking confirmation found via JavaScript:', jsConfirmation.text);
    } else {
      // One final check if any error message is visible
      const possibleErrorMessages = await page.evaluate(() => {
        const errorElements = Array.from(document.querySelectorAll('.AFErrorText, .error-text, .x1o'))
          .filter(el => el.offsetParent !== null && el.textContent && el.textContent.trim() !== '');
        
        return errorElements.map(el => el.textContent.trim());
      });
      
      if (possibleErrorMessages.length > 0) {
        console.log('Error messages found on page:', possibleErrorMessages);
        throw new Error(`Booking not confirmed. Errors found: ${possibleErrorMessages.join(', ')}`);
      } else {
        throw new Error('Booking confirmation message not found');
      }
    }
  }
  
  const exitButton = page.getByRole('button', { name: 'Exit Booking' }).first();
  if (await exitButton.isVisible({ timeout: 10000 })) {
      await page.waitForTimeout(2000);
      await exitButton.click();
    console.log('Clicked Exit Booking');
  } else {
    console.log('Exit Booking button not found, continuing...');
    
    // Try to find other exit/close buttons
    const exitButtonAlternatives = [
      page.locator('button:has-text("Exit")').first(),
      page.locator('button:has-text("Close")').first(),
      page.locator('a:has-text("Exit")').first(),
      page.locator('a:has-text("Close")').first()
    ];
    
    for (const button of exitButtonAlternatives) {
      if (await button.isVisible({ timeout: 2000 })) {
        console.log('Found alternative exit button, clicking...');
        await button.click();
        console.log('Clicked alternative exit button');
        break;
      }
    }
  }
  
  console.log('Booking process completed successfully');
  return {
    success: true,
    message: `Booking completed for ${firstName} ${clientName} in room ${roomNumber}`
  };
  
} catch (error) {
  console.error(`Error in booking process: ${error.message}`);
  
  try {
    const downloadsPath = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    if (page && !page.isClosed()) {
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(downloadsPath, `error_${Date.now()}.png`) });
      
      // Also save the HTML for debugging
      const finalHtml = await page.content().catch(e => 'Could not get HTML: ' + e.message);
      fs.writeFileSync(path.join(downloadsPath, `error_page_${Date.now()}.html`), finalHtml);
      console.log('Saved error page HTML for debugging');
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