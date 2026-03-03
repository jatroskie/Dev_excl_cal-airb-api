const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loginToOperaCloud } = require('./login3'); // Assuming login3.js is in the same directory

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
    await page.waitForTimeout(3000);
    console.log('Searching for AirBnB...');
    const searchIcon = page.locator('a[id*="oc_srclov_dummy_link"]').nth(0);
    
    if (await searchIcon.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await page.waitForTimeout(2000);
      await searchIcon.click();
      console.log('Clicked search icon');
    } else {
      console.log('Search icon not found, pressing Enter...');
      await travelAgentInput.press('Enter');
    }
    
    await page.waitForTimeout(3000);
    
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
        await page.waitForTimeout(3000);
        
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

        // Wait for the dialog and overlay to close
        console.log('Waiting for travel agent selection dialog to close...');
        const dialogIframe = page.locator('iframe[id="j_id976::f"][title="Content"]');
        const modalGlassPane = page.locator('div.AFModalGlassPane');

        // Wait for the dialog iframe to disappear
        await dialogIframe.waitFor({ state: 'detached', timeout: 10000 });
        console.log('Travel agent selection dialog closed');

        // Wait for the modal glass pane to disappear
        await modalGlassPane.waitFor({ state: 'detached', timeout: 10000 });
        console.log('Modal glass pane disappeared');

        // Small delay to ensure page stability
        await page.waitForTimeout(2000);
      } catch (iframeError) {
        console.log('Iframe selection failed:', iframeError.message);
        const newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
        if (await newProfileLink.isVisible({ timeout: TIMEOUTS.SHORT })) {
          await newProfileLink.click();
          console.log('Clicked New Profile link');
        }
      }
    }
    
    console.log('Continuing with booking process...');
    
    console.log('Attempting to set Arrival date...');
    const arrivalInput = page.getByRole('textbox', { name: 'Arrival' }).nth(0);
    await arrivalInput.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await arrivalInput.click();
    await arrivalInput.fill(startDate);
    console.log(`Set arrival date to ${startDate}`);
    
    const departureInput = page.getByRole('textbox', { name: 'Departure' }).nth(0);
    if (await departureInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await departureInput.click();
      await departureInput.fill(endDate);
      console.log(`Set departure date to ${endDate}`);
    } else {
      console.log('Departure field not found');
    }
    
    const adultsInput = page.getByRole('textbox', { name: 'Adults' }).nth(0);
    if (await adultsInput.isVisible({ timeout: TIMEOUTS.SHORT })) {
      await adultsInput.click();
      await adultsInput.fill('2');
      console.log('Set adults to 2');
    } else {
      console.log('Adults field not found');
    }

    // Wait for the page to stabilize after filling the form
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('Page stabilized after filling form fields');

    const roomInput = page.getByRole('textbox', { name: 'Room', exact: true }).nth(0);
    await roomInput.click();
    await roomInput.fill(roomNumber);
    console.log(`Set room number to ${roomNumber}`);
    
    const searchButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    await searchButton.click();
    console.log('Clicked Search button');
    await page.waitForTimeout(5000);
    
    console.log('Looking for Room Details dialog...');
    const roomDetailsDialog = page.locator('[role="dialog"][aria-label*="Room Details"]').first();
    const isRoomDetailsVisible = await roomDetailsDialog.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false);
    
    if (isRoomDetailsVisible) {
      console.log('Room Details dialog found');
      const dialogSearchButton = roomDetailsDialog.getByRole('button', { name: 'Search' }).nth(0);
      await dialogSearchButton.click();
      console.log('Clicked Search button in Room Details dialog');
      await page.waitForTimeout(3000);
    } else {
      console.log('Room Details dialog not found, continuing with normal flow');
    }
    
    try {
      console.log('Looking for Do Not Move checkbox...');
      const doNotMoveCheckbox = page.locator('input[type="checkbox"][id*="doNotMove"]').nth(0);
      await doNotMoveCheckbox.click();
      console.log('Clicked Do Not Move checkbox');
    } catch (moveError) {
      console.log('Do Not Move option not found:', moveError.message);
    }
    
    console.log('Looking for Select Room button...');
    const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).nth(0);
    await selectRoomLink.click();
    console.log('Clicked Select Room link');
    await page.waitForTimeout(3000);
    
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).nth(0);
    await searchRatesButton.click();
    console.log('Clicked Search for rates');
    await page.waitForTimeout(5000);
    
    const rateRow = page.locator('tr[_afrrk]').first();
    await rateRow.click();
    console.log('Clicked rate row');
    await page.waitForTimeout(2000);
    
    const rateSelectButton = page.getByRole('button', { name: /Select/i }).first();
    await rateSelectButton.click();
    console.log('Clicked Select button for rate');
    await page.waitForTimeout(3000);
    
    console.log('Extracting rate from screen...');
    let operaRate = 0;
    const rateElement = page.locator('span.x2d7').getByText(/[\d,]+\.\d{2}\s*ZAR/).first();
    const rateText = await rateElement.textContent();
    const rateMatch = rateText.match(/[\d,.]+/);
    if (rateMatch) {
      const rateString = rateMatch[0].replace(/,/g, '');
      operaRate = parseFloat(rateString);
      console.log(`Extracted Opera rate: ${operaRate}`);
    }
    
    const airRateNum = parseFloat(airRate);
    console.log(`Air rate (converted to number): ${airRateNum}`);
    
    let discountAmount = 0;
    if (!isNaN(operaRate) && !isNaN(airRateNum)) {
      discountAmount = operaRate - (airRateNum * 0.77);
    }
    const roundedDiscount = Math.round(discountAmount);
    console.log(`Calculated discount: ${discountAmount} (rounded to ${roundedDiscount})`);
    
    const discountAmountInput = page.getByRole('textbox', { name: /Discount Amount/i }).nth(0);
    await discountAmountInput.click();
    await discountAmountInput.fill(roundedDiscount.toString());
    console.log(`Set discount amount to ${roundedDiscount}`);
    
    const discountCodeInput = page.getByRole('textbox', { name: /Discount Code/i }).nth(0);
    await discountCodeInput.click();
    await discountCodeInput.fill(discountCode);
    console.log(`Set discount code to ${discountCode}`);
    
    const methodSelect = page.getByLabel(/Method/i).nth(0);
    await methodSelect.selectOption('FCA');
    console.log('Selected FCA payment method');

    // Now capture the guest profile data as the last step before booking
    console.log('Looking for New Profile link to create guest profile...');
    const modalGlassPane = page.locator('div.AFModalGlassPane');
    await modalGlassPane.waitFor({ state: 'detached', timeout: 10000 });
    console.log('Modal glass pane disappeared');

    // Check if the link is inside an iframe
    const iframeLocator = page.frameLocator('iframe[title="Content"]');
    let newProfileLink = iframeLocator.getByRole('link', { name: 'New Profile' }).nth(0);
    let linkFound = false;

    try {
      await newProfileLink.waitFor({ state: 'visible', timeout: 10000 });
      const linkHtml = await newProfileLink.evaluate(el => el.outerHTML);
      console.log('New Profile link HTML (inside iframe):', linkHtml);
      await newProfileLink.click();
      linkFound = true;
      console.log('Clicked New Profile inside iframe');
    } catch (error) {
      console.log('Iframe locator failed:', error.message);
    }

    // Fallback: Try the main page
    if (!linkFound) {
      newProfileLink = page.getByRole('link', { name: 'New Profile' }).nth(0);
      await newProfileLink.waitFor({ state: 'visible', timeout: 10000 });
      const linkHtml = await newProfileLink.evaluate(el => el.outerHTML);
      console.log('New Profile link HTML (main page):', linkHtml);
      await newProfileLink.click();
      console.log('Clicked New Profile on main page');
    }

    await page.waitForTimeout(3000);

    console.log('Filling in Last Name...');
    const nameInput = page.getByRole('textbox', { name: 'Name' }).nth(0);
    await nameInput.click();
    await nameInput.fill(clientName);
    console.log(`Set Last Name to: ${clientName}`);
    
    console.log('Filling in First Name...');
    const firstNameInput = page.getByRole('textbox', { name: 'First Name' }).nth(0);
    await firstNameInput.click();
    await firstNameInput.fill(firstName);
    console.log(`Set First Name to: ${firstName}`);
    
    console.log('Looking for MOBILE row...');
    const mobileRow = page.getByRole('row', { name: 'MOBILE Communication Type' });
    const mobileCommValue = mobileRow.getByLabel('Communication Value');
    await mobileCommValue.click();
    await mobileCommValue.fill(telephoneNumber);
    console.log(`Set telephone number to: ${telephoneNumber}`);
    
    console.log('Clicking Save and Select Profile button...');
    const saveButton = page.getByRole('button', { name: 'Save and Select Profile' }).nth(0);
    await saveButton.click();
    console.log('Clicked Save and Select Profile button');
    await page.waitForTimeout(2000);
    
    const bookNowButton = page.getByRole('button', { name: /Book Now/i }).nth(0);
    await bookNowButton.click();
    console.log('Clicked Book Now');
    await page.waitForTimeout(8000);
    
    console.log('Validating booking completion...');
    const confirmationMessage = page.locator('text=/Booking Confirmed|Reservation Created/i').first();
    if (await confirmationMessage.isVisible({ timeout: TIMEOUTS.MEDIUM })) {
      console.log('Booking confirmation message found:', await confirmationMessage.textContent());
    } else {
      console.log('WARNING: Booking confirmation message not found');
    }
    
    const exitButton = page.getByRole('button', { name: /Exit Booking/i }).nth(0);
    await exitButton.click();
    console.log('Clicked Exit Booking');
    
    console.log('Booking process completed successfully');

    // Booking summary (reintroduced from the "bloated" version)
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

// Command-line execution
(async () => {
  const args = process.argv.slice(2);
  if (args.length < 7) {
    console.error('Usage: node script.js <clientName> <firstName> <telephoneNumber> <roomNumber> <startDate> <endDate> <airRate> [discountCode]');
    process.exit(1);
  }

  const [clientName, firstName, telephoneNumber, roomNumber, startDate, endDate, airRate, discountCode] = args;
  const result = await createBooking(clientName, firstName, telephoneNumber, roomNumber, startDate, endDate, airRate, discountCode || 'OTH');
  console.log(result);
})();