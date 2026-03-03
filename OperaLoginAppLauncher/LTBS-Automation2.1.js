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
        await page.waitForTimeout(2000);
        const selectButton = dialog.getByRole('button', { name: 'Select', exact: true }).first();
        
        if (await selectButton.isVisible({ timeout: 5000 })) {
          console.log('Found Select button in popup, clicking...');
          await selectButton.click();
          console.log('Successfully clicked Select button in popup');
        } else {
          console.log('Select button not found in popup with role, trying other selectors...');
          
          // Try other select button selectors within popup
          const selectButtons = [
            dialog.locator('button:has-text("Select")').first(),
            dialog.locator('a:has-text("Select")').first(),
            dialog.locator('input[type="button"][value="Select"]').first()
          ];
          
          for (const button of selectButtons) {
            if (await button.isVisible({ timeout: 2000 })) {
              console.log('Found Select button in popup with alternate selector, clicking...');
              await button.click();
              console.log('Successfully clicked Select button in popup');
              break;
            }
          }
        }
      } else {
        // If no dialog found, try the previous methods on the main page
        console.log('No specific popup/dialog found, attempting rate selection on main page...');
        
        // Primary method: Try the rate row by attribute
        const rateRow = page.locator('tr[_afrrk]').first();
        
        if (await rateRow.isVisible({ timeout: 5000 })) {
          console.log('Found rate row with _afrrk attribute, clicking...');
          await rateRow.click();
          console.log('Successfully clicked rate row');
          await page.waitForTimeout(1000);
        } else {
          // Try second method: Find the rate description or name cell
          console.log('Rate row not found, trying to find rate by description cell...');
          const rateCell = page.locator('td:has-text("RACK")').first();
          
          if (await rateCell.isVisible({ timeout: 3000 })) {
            console.log('Found rate cell with "RACK" text, clicking...');
            await rateCell.click();
            console.log('Successfully clicked rate cell');
            await page.waitForTimeout(1000);
          } else {
            // Try third method: Find the Select text in the rate table
            console.log('Rate cell not found, looking for "Select" text in rate table...');
            const selectText = page.locator('tr td:has-text("Select")').first();
            
            if (await selectText.isVisible({ timeout: 3000 })) {
              // Check if this is not a checkbox (Fixed Rate)
              const isCheckbox = await selectText.evaluate(el => {
                const inputElement = el.querySelector('input[type="checkbox"]');
                return !!inputElement;
              });
              
              if (!isCheckbox) {
                console.log('Found "Select" text (not checkbox), clicking...');
                await selectText.click();
                console.log('Successfully clicked Select text');
              } else {
                console.log('Found "Select" text but it appears to be a checkbox, skipping to avoid Fixed Rate');
              }
            } else {
              console.log('No rate selection elements found, trying JavaScript fallback...');
              
              // JavaScript fallback method
              const foundRate = await page.evaluate(() => {
                // Try to find a rate row and click it
                const rows = Array.from(document.querySelectorAll('tr'));
                const rateRow = rows.find(row => 
                  row.textContent.includes('RACK') || 
                  row.textContent.includes('BAR') ||
                  row.textContent.includes('CORPORATE')
                );
                
                if (rateRow) {
                  rateRow.click();
                  return true;
                }
                return false;
              });
              
              if (foundRate) {
                console.log('Found and clicked rate row using JavaScript');
              } else {
                console.log('WARNING: Could not find any rate to select');
              }
            }
          }
        }
        
        // After selecting the rate on main page, click the Select button
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(downloadsPath, 'after_rate_row_selection.png') });
        
        console.log('Looking for Select button after rate selection...');
        const rateSelectButton = page.getByRole('button', { name: 'Select', exact: true }).first();
        
        if (await rateSelectButton.isVisible({ timeout: 5000 })) {
          console.log('Found Select button with exact role match, clicking...');
          await page.waitForTimeout(1000);
          await rateSelectButton.click();
          console.log('Successfully clicked Select button');
        } else {
          console.log('Rate Select button not found with role, trying alternate selectors...');
          
          // Try other select button selectors
          const selectButtonAlternatives = [
            page.locator('button:has-text("Select")').first(),
            page.locator('a:has-text("Select")').first(),
            page.locator('[id*="ltbrs"] button').first(),
            page.locator('tr[_afrrk] button').first(),
            page.locator('div[id*="ltbavlrs"] button').first()
          ];
          
          let buttonFound = false;
          for (const button of selectButtonAlternatives) {
            if (await button.isVisible({ timeout: 2000 })) {
              console.log('Found Select button with alternative selector, clicking...');
              await button.click();
              console.log('Successfully clicked Select button with alternative selector');
              buttonFound = true;
              break;
            }
          }
          
          if (!buttonFound) {
            // JavaScript fallback for Select button
            console.log('No Select buttons found, trying JavaScript fallback...');
            const buttonClicked = await page.evaluate(() => {
              // Try to find any button containing Select text
              const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'))
                .filter(btn => btn.textContent && btn.textContent.trim() === 'Select');
              
              if (buttons.length > 0) {
                buttons[0].click();
                return true;
              }
              return false;
            });
            
            if (buttonClicked) {
              console.log('Successfully clicked Select button using JavaScript');
            } else {
              console.log('WARNING: Could not find Select button with any method');
            }
          }
        }
      }
      
      // Take screenshot after rate selection attempt
      await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection_attempt.png') });
      
      // Wait for possible popup to close and main page to stabilize
      console.log('Waiting for rate selection to complete and possible popup to close...');
      await page.waitForTimeout(5000);
      
    } catch (rateSelectionError) {
      console.log('Error during rate selection process:', rateSelectionError.message);
    }
    // ===== IMPROVED RATE SELECTION CODE ENDS HERE =====
    
    // Take a screenshot after rate selection process
    await page.screenshot({ path: path.join(downloadsPath, 'after_complete_rate_selection.png') });
    
    console.log('Extracting rate from screen...');
    let operaRate = 0;

    try {
      // Primary locator: Target the span containing the rate directly
      await page.waitForTimeout(2000);
      const rateElement = page.locator('span.x2d7').getByText(/[\d,]+\.\d{2}\s*ZAR/).first();
      await page.waitForTimeout(2000);
      if (await rateElement.isVisible({ timeout: 5000 })) {
        const rateText = await rateElement.textContent();
        console.log(`Found rate text: ${rateText}`);

        const rateMatch = rateText.match(/[\d,.]+/);
        if (rateMatch) {
            await page.waitForTimeout(2000);
            const rateString = rateMatch[0].replace(/,/g, '');
          operaRate = parseFloat(rateString);
          console.log(`Extracted Opera rate: ${operaRate}`);
        } else {
          console.log('Could not extract numeric value from rate text');
        }
      } else {
        console.log('Rate element not found with primary selector, trying alternate approach...');
        
        // Fallback: Use a partial ID match for the <a> tag
        await page.waitForTimeout(2000);
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
          
          // Try other common elements that might contain the rate
          const alternativeElements = [
            ...Array.from(document.querySelectorAll('a[id*="feNetAmnt"]')),
            ...Array.from(document.querySelectorAll('span:contains("ZAR")'))
          ];
          
          for (const el of alternativeElements) {
            if (el.textContent && /[\d,]+\.\d{2}\s*ZAR/.test(el.textContent)) {
              const rateText = el.textContent;
              const rateMatch = rateText.match(/[\d,.]+/);
              if (rateMatch) {
                const cleanedRate = rateMatch[0].replace(/,/g, '');
                const parsedRate = parseFloat(cleanedRate);
                if (!isNaN(parsedRate)) {
                  return parsedRate;
                }
              }
            }
          }
          
          return 0;
        });
        console.log(`Found Opera rate using JavaScript: ${operaRate}`);
      }

      await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction.png') });
    } catch (rateError) {
      console.log('Error extracting rate:', rateError.message);
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

    // Take screenshot before looking for discount fields
    await page.screenshot({ path: path.join(downloadsPath, 'before_discount_fields.png') });

    // Try to find discount amount input with better fallbacks
    const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).first();
    if (await discountAmountInput.isVisible({ timeout: 5000 })) {
      await discountAmountInput.click();
      await discountAmountInput.fill(roundedDiscount.toString());
      console.log(`Set discount amount to ${roundedDiscount}`);
    } else {
      console.log('Primary discount amount field not found, trying alternative selectors...');
      
      // Try alternative selectors for discount amount
      const discountFields = [
        page.locator('input[id*="disAmnt"]').first(),
        page.locator('input[aria-label*="Discount"]').first(),
        page.locator('input[id*="discount"]').first(),
        page.locator('input').filter({ hasText: 'Discount' }).first()
      ];
      
      let discountFieldFound = false;
      for (const field of discountFields) {
        if (await field.isVisible({ timeout: 2000 })) {
          console.log('Found alternative discount amount field');
          await field.click();
          await field.fill(roundedDiscount.toString());
          console.log(`Set discount amount to ${roundedDiscount} using alternative field`);
          discountFieldFound = true;
          break;
        }
      }
      
      if (!discountFieldFound) {
        console.log('WARNING: Could not find any discount amount field, attempting JavaScript...');
        const discountSet = await page.evaluate((discount) => {
          // Try to find any input field that might be for discount
          const possibleInputs = Array.from(document.querySelectorAll('input[type="text"]'))
            .filter(el => {
              const nearbyText = el.parentElement?.textContent || '';
              return nearbyText.includes('Discount') || nearbyText.includes('discount');
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
        } else {
          console.log('Could not set discount amount with any method');
        }
      }
    }

    // Try to find discount code input with better fallbacks
    const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' }).first();
    if (await discountCodeInput.isVisible({ timeout: 5000 })) {
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      console.log(`Set discount code to ${discountCode}`);
    } else {
      console.log('Primary discount code field not found, trying alternative selectors...');
      
      // Try alternative selectors for discount code
      const codeFields = [
        page.locator('input[id*="disCode"]').first(),
        page.locator('input[aria-label*="Code"]').first(),
        page.locator('input').filter({ hasText: 'Code' }).first()
      ];
      
      let codeFieldFound = false;
      for (const field of codeFields) {
        if (await field.isVisible({ timeout: 2000 })) {
          console.log('Found alternative discount code field');
          await field.click();
          await field.fill(discountCode);
          console.log(`Set discount code to ${discountCode} using alternative field`);
          codeFieldFound = true;
          break;
        }
      }
      
      if (!codeFieldFound) {
        console.log('WARNING: Could not find any discount code field, attempting JavaScript...');
        const codeSet = await page.evaluate((code) => {
          // Try to find any input field that might be for discount code
          const possibleInputs = Array.from(document.querySelectorAll('input[type="text"]'))
            .filter(el => {
              const nearbyText = el.parentElement?.textContent || '';
              return nearbyText.includes('Code') || nearbyText.includes('code');
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
        } else {
          console.log('Could not set discount code with any method');
        }
      }
    }

    // Try to find and set payment method with better fallbacks
    const methodSelect = page.getByLabel('Method').first();
    if (await methodSelect.isVisible({ timeout: 5000 })) {
      await methodSelect.selectOption('FCA');
      console.log('Selected FCA payment method');
    } else {
      console.log('Primary method selector not found, trying alternative selectors...');
      
      // Try alternative selectors for payment method
      const methodSelectors = [
        page.locator('select[id*="method"]').first(),
        page.locator('select[aria-label*="Method"]').first(),
        page.locator('select').filter({ hasText: 'FCA' }).first()
      ];
      
      let methodSelected = false;
      for (const selector of methodSelectors) {
        if (await selector.isVisible({ timeout: 2000 })) {
          console.log('Found alternative payment method selector');
          await selector.selectOption('FCA');
          console.log('Selected FCA payment method using alternative selector');
          methodSelected = true;
          break;
        }
      }
      
      if (!methodSelected) {
        console.log('WARNING: Could not find any payment method selector, attempting JavaScript...');
        const methodSet = await page.evaluate(() => {
          // Try to find any select element that might be for payment method
          const possibleSelects = Array.from(document.querySelectorAll('select'))
            .filter(el => {
              const options = Array.from(el.options);
              return options.some(opt => opt.value === 'FCA' || opt.text === 'FCA');
            });
            
          if (possibleSelects.length > 0) {
            const select = possibleSelects[0];
            for (let i = 0; i < select.options.length; i++) {
              if (select.options[i].value === 'FCA' || select.options[i].text === 'FCA') {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
          }
          return false;
        });
        
        if (methodSet) {
          console.log('Selected FCA payment method using JavaScript');
        } else {
          console.log('Could not select payment method with any method');
        }
      }
    }

    // Now capture the guest profile data as the last step before booking
    console.log('Looking for New Profile link to create guest profile...');
    const modalGlassPane = page.locator('div.AFModalGlassPane');
    await modalGlassPane.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {
      console.log('Modal glass pane not found or already detached, proceeding...');
    });
    console.log('Modal glass pane check completed');

    // Debug: Find all "New Profile" links
    let allNewProfileLinks = [];
    let newProfileClicked = false;

    // Check on the main page (since iframe check failed in the logs)
    let mainPageNewProfileLinks = page.getByRole('link', { name: 'New Profile' });
    const mainPageLinkCount = await mainPageNewProfileLinks.count();
    console.log(`Found ${mainPageLinkCount} "New Profile" links on main page`);

    for (let i = 0; i < mainPageLinkCount; i++) {
      const link = mainPageNewProfileLinks.nth(i);
      const linkDetails = await link.evaluate(el => {
        return {
          text: el.textContent?.trim() || '',
          href: el.getAttribute('href') || '',
          id: el.getAttribute('id') || '',
          class: el.getAttribute('class') || '',
          outerHTML: el.outerHTML,
          parentText: el.parentElement?.textContent?.trim() || '',
          parentTag: el.parentElement?.tagName || '',
          parentId: el.parentElement?.getAttribute('id') || '',
          parentClass: el.parentElement?.getAttribute('class') || ''
        };
      });
      allNewProfileLinks.push({
        index: i,
        location: 'main page',
        ...linkDetails
      });
    }

    // Log all matching "New Profile" links with descriptions
    console.log('=== All "New Profile" Links Found ===');
    if (allNewProfileLinks.length === 0) {
      console.log('No "New Profile" links found on the page.');
    } else {
      allNewProfileLinks.forEach((link, idx) => {
        console.log(`Link ${idx + 1}:`);
        console.log(`  Location: ${link.location}`);
        console.log(`  Index in ${link.location}: ${link.index}`);
        console.log(`  Text: ${link.text}`);
        console.log(`  Href: ${link.href || 'N/A'}`);
        console.log(`  ID: ${link.id || 'N/A'}`);
        console.log(`  Class: ${link.class || 'N/A'}`);
        console.log(`  Parent Tag: ${link.parentTag}`);
        console.log(`  Parent ID: ${link.parentId || 'N/A'}`);
        console.log(`  Parent Class: ${link.parentClass || 'N/A'}`);
        console.log(`  Parent Text: ${link.parentText}`);
        console.log(`  Outer HTML: ${link.outerHTML}`);
        console.log('-------------------');
      });
    }

    // Select the "New Profile" link (use the first one for now, as it worked in version 1.5)
    let newProfileLink = null;
    if (mainPageLinkCount > 0) {
      newProfileLink = mainPageNewProfileLinks.first();
      await newProfileLink.waitFor({ state: 'visible', timeout: 10000 });
      const linkHtml = await newProfileLink.evaluate(el => el.outerHTML);
      console.log('Selected New Profile link HTML (main page):', linkHtml);
      await newProfileLink.scrollIntoViewIfNeeded();
      await newProfileLink.click();
      newProfileClicked = true;
      console.log('Clicked New Profile on main page');
    }

    // Fallback strategies from version 1.3
    if (!newProfileClicked) {
      const newProfileLink2 = page.locator('a[id="pt1:oc_pg_pt:r1:7:ltbm:oc_scrn_tmpl_y9qqzw:r2:0:pt1:oc_pnl_cmp:oc_pnl_tmpl_wqohv4:ss1:odec_srch_swtchr_advncd_sf:fe8:lnp"]').first();
      if (await newProfileLink2.isVisible({ timeout: 5000 })) {
        console.log('Found New Profile link with exact ID');
        await newProfileLink2.scrollIntoViewIfNeeded();
        await newProfileLink2.click();
        console.log('Clicked New Profile link (Strategy 2)');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with exact ID');
      }
    }

    if (!newProfileClicked) {
      const newProfileLink3 = page.locator('a[id*="oc_pnl_tmpl_wqohv4:ss1:odec_srch_swtchr_advncd_sf:fe8:lnp"]').getByText('New Profile').first();
      if (await newProfileLink3.isVisible({ timeout: 5000 })) {
        console.log('Found New Profile link with partial ID and text');
        await newProfileLink3.scrollIntoViewIfNeeded();
        await newProfileLink3.click();
        console.log('Clicked New Profile link (Strategy 3)');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with partial ID and text');
      }
    }

    if (!newProfileClicked) {
      const newProfileLink4 = page.locator('a').getByText('New Profile').first();
      if (await newProfileLink4.isVisible({ timeout: 5000 })) {
        console.log('Found New Profile link with text-based locator');
        await newProfileLink4.scrollIntoViewIfNeeded();
        await newProfileLink4.click();
        console.log('Clicked New Profile link (Strategy 4)');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with text-based locator');
      }
    }

    if (!newProfileClicked) {
      console.log('Using JavaScript to find and click New Profile link...');
      const clicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a'))
          .filter(el => el.textContent && el.textContent.trim() === 'New Profile' && el.className.includes('xt1'));
        if (elements.length > 0) {
          elements[0].scrollIntoView();
          elements[0].click();
          return true;
        }
        return false;
      });
      if (clicked) {
        console.log('Clicked New Profile link using JavaScript (Strategy 5)');
        newProfileClicked = true;
      } else {
        console.log('New Profile link not found with JavaScript');
      }
    }

    if (!newProfileClicked) {
      throw new Error('Could not click New Profile link with any strategy');
    } else {
      await page.waitForTimeout(3000); // Wait for the popup to appear
      await page.screenshot({ path: path.join(downloadsPath, 'after_new_profile_click.png') });
    }

    if (newProfileClicked) {
      try {
        // Try different strategies to locate the Guest Profile dialog
        let profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
        let dialogFound = await profileDialog.isVisible({ timeout: 15000 }).catch(() => false);

        if (!dialogFound) {
          console.log('Guest Profile dialog not found with role, trying alternate selector...');
          profileDialog = page.locator('div[aria-label*="Profile"], div[id*="profile"]');
          dialogFound = await profileDialog.isVisible({ timeout: 5000 }).catch(() => false);
        }

        if (!dialogFound) {
          console.log('Guest Profile dialog not found with aria-label, tryingIframe...');
          const iframeLocator = page.frameLocator('iframe[title="Content"]');
          profileDialog = iframeLocator.locator('div[aria-label*="Profile"], div[id*="profile"]');
          dialogFound = await profileDialog.isVisible({ timeout: 5000 }).catch(() => false);
        }

        if (!dialogFound) {
          throw new Error('Could not find Guest Profile dialog with any strategy');
        }

        await page.waitForTimeout(2000);
        
        console.log('Filling in Last Name...');
        await page.waitForTimeout(2000);
        const nameInput = profileDialog.locator('input[id*="name"], input[aria-labelledby*="name"]').first();
        if (await nameInput.isVisible({ timeout: 5000 })) {
          await page.waitForTimeout(2000);
          await nameInput.click();
          await page.waitForTimeout(2000);  
          await nameInput.fill(clientName);
          console.log(`Set Last Name to: ${clientName}`);
        } else {
          console.log('Last Name field not found, trying alternate selector...');
          const alternateNameInput = profileDialog.getByLabel('Name', { exact: true });
          if (await alternateNameInput.isVisible({ timeout: 3000 })) {
            await page.waitForTimeout(2000);
            await alternateNameInput.click();
            await page.waitForTimeout(2000);
            await alternateNameInput.fill(clientName);
            console.log(`Set Last Name to: ${clientName} using alternate method`);
          } else {
            throw new Error('Last Name field not found');
          }
        }

        console.log('Filling in First Name...');
        await page.waitForTimeout(2000);
        const firstNameInput = profileDialog.locator('input[id*="firstName"], input[aria-labelledby*="firstName"]').first();
        if (await firstNameInput.isVisible({ timeout: 5000 })) {
            await page.waitForTimeout(2000);
            await firstNameInput.click();
            await page.waitForTimeout(2000);
            await firstNameInput.fill(firstName);
          console.log(`Set First Name to: ${firstName}`);
        } else {
          console.log('First Name field not found, trying alternate selector...');
          const alternateFirstNameInput = profileDialog.getByRole('textbox', { name: 'First Name' }).first();
          if (await alternateFirstNameInput.isVisible({ timeout: 3000 })) {
            await page.waitForTimeout(2000);
            await alternateFirstNameInput.click();
            await page.waitForTimeout(2000);
            await alternateFirstNameInput.fill(firstName);
            console.log(`Set First Name to: ${firstName} using alternate method`);
          } else {
            throw new Error('First Name field not found');
          }
        }

        console.log('Looking for MOBILE row...');
        const mobileRow = profileDialog.getByRole('row', { name: 'MOBILE Communication Type' });
        await page.waitForTimeout(2000);
        const mobileCommValue = mobileRow.getByLabel('Communication Value');
        
        if (await mobileCommValue.isVisible({ timeout: 5000 })) {
            await page.waitForTimeout(2000);
            await mobileCommValue.click();
          try {
            const gridCellInput = profileDialog.getByRole('gridcell', { name: 'Communication Value Communication Value' })
                              .getByLabel('Communication Value');
            if (await gridCellInput.isVisible({ timeout: 3000 })) {
                await page.waitForTimeout(2000);
                await gridCellInput.fill(telephoneNumber);
              console.log(`Set telephone number to: ${telephoneNumber} using gridcell`);
            } else {
                await page.waitForTimeout(2000);
                await mobileCommValue.fill(telephoneNumber);
              console.log(`Set telephone number to: ${telephoneNumber} using direct input`);
            }
          } catch (inputError) {
            console.log('Error with input field, trying direct entry:', inputError.message);
            await page.waitForTimeout(2000);
            await mobileCommValue.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using fallback`);
          }
        } else {
          console.log('MOBILE row not found, looking for any Communication Value field...');
          const anyCommValue = profileDialog.locator('input[aria-label*="Communication Value"]').first();
          if (await anyCommValue.isVisible({ timeout: 3000 })) {
            await page.waitForTimeout(2000);
            await anyCommValue.click();
            await page.waitForTimeout(2000);
            await anyCommValue.fill(telephoneNumber);
            console.log(`Set telephone number to: ${telephoneNumber} using generic field`);
          } else {
            throw new Error('Telephone field not found');
          }
        }
            
        console.log('Clicking Save and Select Profile button...');
        const saveButton = profileDialog.getByRole('button', { name: 'Save and Select Profile' }).first();
        if (await saveButton.isVisible({ timeout: 5000 })) {
            await page.waitForTimeout(2000);
            await saveButton.click();
          console.log('Clicked Save and Select Profile button');
        } else {
          console.log('Save and Select Profile button not found, trying alternate selector...');
          await page.waitForTimeout(2000);   
          const altSaveButton = profileDialog.locator('button:has-text("Save and Select Profile")').first();
          if (await altSaveButton.isVisible({ timeout: 3000 })) {
            await page.waitForTimeout(2000);
            await altSaveButton.click();
            console.log('Clicked Save and Select Profile button using alternate method');
          } else {
            throw new Error('Could not find Save and Select Profile button');
          }
        }
        
        console.log('Profile saved, adding extended wait for UI stabilization...');
        await page.waitForTimeout(10000); // Increased from 2000 to 10000ms for better UI stability
        await page.screenshot({ path: path.join(downloadsPath, 'after_profile_save_extended.png') });
        
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
              return el.offsetParent !== null && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    el.textContent && el.textContent.trim() !== '';
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
        
        console.log('Visible buttons found:', buttonInfo.length);
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
        
      } catch (profileError) {
        console.log('Error handling Guest Profile dialog:', profileError.message);
        await page.screenshot({ 
          path: path.join(downloadsPath, `profile_error_${Date.now()}.png`) 
        }).catch(e => console.log('Error taking screenshot:', e.message));
        throw profileError;
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
