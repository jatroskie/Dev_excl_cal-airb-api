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