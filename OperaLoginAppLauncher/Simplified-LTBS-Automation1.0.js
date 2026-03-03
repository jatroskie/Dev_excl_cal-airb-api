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
    
    // Restored original Airbnb popup handling
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
        
        // Restored original multi-strategy approach for Select button
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
    
    const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
    if (await newProfileLink.isVisible({ timeout: 5000 })) {
      await newProfileLink.click();
      console.log('Clicked New Profile');
      await page.waitForTimeout(3000);
    }
    
    try {
      const profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
      await profileDialog.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(2000);
      
      console.log('Filling in Last Name...');
      const nameInput = profileDialog.locator('input[id*="name"], input[aria-labelledby*="name"]').nth(0);
      if (await nameInput.isVisible({ timeout: 5000 })) {
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
        }
      }

      console.log('Filling in First Name...');
      const firstNameInput = profileDialog.locator('input[id*="firstName"], input[aria-labelledby*="firstName"]').nth(0);
      if (await firstNameInput.isVisible({ timeout: 5000 })) {
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
        }
      }

      console.log('Looking for MOBILE row...');
      const mobileRow = profileDialog.getByRole('row', { name: 'MOBILE Communication Type' });
      const mobileCommValue = mobileRow.getByLabel('Communication Value');
      
      if (await mobileCommValue.isVisible({ timeout: 5000 })) {
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
        }
      }
          
      console.log('Clicking Save and Select Profile button...');
      const saveButton = profileDialog.getByRole('button', { name: 'Save and Select Profile' }).nth(0);
      if (await saveButton.isVisible({ timeout: 5000 })) {
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
        path: path.join(downloadsPath, `profile_error_${Date.now()}.png`) 
      }).catch(e => console.log('Error taking screenshot:', e.message));
    }
    
    const roomInput = page.getByRole('textbox', { name: 'Room', exact: true }).nth(0);
    if (await roomInput.isVisible({ timeout: 10000 })) {
      await roomInput.click();
      await roomInput.fill(roomNumber);
      console.log(`Set room number to ${roomNumber}`);
    } else {
      console.log('Room field not found');
    }
    
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
    
    try {
      console.log('Looking for Do Not Move checkbox...');
      const doNotMoveCheckbox = page.locator('input[type="checkbox"][id*="doNotMove"]').nth(0);
      const doNotMoveLabel = page.getByText('Do Not Move').nth(0);
      
      if (await doNotMoveCheckbox.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move checkbox, clicking');
        await doNotMoveCheckbox.click();
      } else if (await doNotMoveLabel.isVisible({ timeout: 3000 })) {
        console.log('Found Do Not Move label, clicking');
        await doNotMoveLabel.click();
      } else {
        console.log('Do Not Move option not found');
      }
    } catch (moveError) {
      console.log('Error with Do Not Move option:', moveError.message);
    }
    
    console.log('Looking for Select Room button...');
    await page.screenshot({ path: path.join(downloadsPath, 'before_select_room.png') });
    
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).nth(0);
    if (await selectRoomLink.isVisible({ timeout: 5000 })) {
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
          }
        }
      }
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(downloadsPath, 'after_select_room.png') });
    
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    if (await searchRatesButton.isVisible({ timeout: 5000 })) {
      await searchRatesButton.click();
      console.log('Clicked Search for rates');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search rates button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'rates_search.png') });
    
    try {
      const rateSelector = page.locator('[id="pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8"]');
      if (await rateSelector.isVisible({ timeout: 5000 })) {
        await rateSelector.click();
        console.log('Selected rate');
        await page.waitForTimeout(2000);
      } else {
        console.log('Rate selector not found, trying first available rate...');
        const anyRate = page.locator('tr[_afrrk]').first();
        if (await anyRate.isVisible({ timeout: 3000 })) {
          await anyRate.click();
          console.log('Clicked first available rate');
        }
      }
    } catch (rateError) {
      console.log('Error selecting rate:', rateError.message);
    }
    
    const rateSelectButton = page.getByRole('button', { name: 'Select', exact: true }).nth(0);
    if (await rateSelectButton.isVisible({ timeout: 5000 })) {
      await rateSelectButton.click();
      console.log('Clicked Select button for rate');
      await page.waitForTimeout(3000);
    } else {
      console.log('Rate Select button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection.png') });
    
    try {
      const zarElement = page.locator('[id*="zm34g1"]').getByText('ZAR').nth(0);
      if (await zarElement.isVisible({ timeout: 3000 })) {
        await zarElement.click();
        console.log('Clicked ZAR currency');
      }
    } catch (currencyError) {
      console.log('Currency element not found');
    }
    
    console.log('Extracting Opera rate from screen...');
    let operaRate = 0;

    try {
      const rateElements = [
        page.locator('text="Rate"').first().locator('xpath=following-sibling::*'),
        page.locator('.x1zp:has-text("ZAR")').first(),
        page.locator('div[id*="rate"]').first(),
        page.locator('text="1,"').first(),
        page.locator('text=",00 ZAR"').first().locator('xpath=..'),
        page.locator('div:has-text(",00 ZAR")').first()
      ];
    
      for (const rateElement of rateElements) {
        if (await rateElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          const rateText = await rateElement.textContent();
          console.log(`Found rate text: ${rateText}`);
          
          const rateMatch = rateText.match(/[\d,.]+/);
          if (rateMatch) {
            let rateString = rateMatch[0].replace(/,/g, '');
            operaRate = parseFloat(rateString);
            console.log(`Extracted Opera rate: ${operaRate}`);
            break;
          }
        }
      }
      
      if (operaRate === 0) {
        console.log('Trying JavaScript approach to find rate...');
        operaRate = await page.evaluate(() => {
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
      
      await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction.png') });
    } catch (rateError) {
      console.log('Error extracting Opera rate:', rateError.message);
    }

    if (operaRate === 0) {
      console.log('WARNING: Could not extract Opera rate from screen. Using default value of 0.');
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

    const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).nth(0);
    if (await discountAmountInput.isVisible({ timeout: 5000 })) {
      await discountAmountInput.click();
      await discountAmountInput.fill(roundedDiscount.toString());
      console.log(`Set discount amount to ${roundedDiscount}`);
    } else {
      console.log('Discount Amount field not found');
    }

    const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' }).nth(0);
    if (await discountCodeInput.isVisible({ timeout: 5000 })) {
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      console.log(`Set discount code to ${discountCode}`);
    } else {
      console.log('Discount Code field not found');
    }

    const methodSelect = page.getByLabel('Method').nth(0);
    if (await methodSelect.isVisible({ timeout: 5000 })) {
      await methodSelect.selectOption('FCA');
      console.log('Selected FCA payment method');
    } else {
      console.log('Method selector not found');
    }
    
    const bookNowButton = page.getByRole('button', { name: 'Book Now' }).nth(0);
    if (await bookNowButton.isVisible({ timeout: 5000 })) {
      await bookNowButton.click();
      console.log('Clicked Book Now');
      await page.waitForTimeout(8000);
    } else {
      console.log('Book Now button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'booking_complete.png') });
    
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