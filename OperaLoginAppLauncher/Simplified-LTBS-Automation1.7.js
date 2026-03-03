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
    
   // try {
   //   console.log('Looking for Do Not Move radio button...');
      // Wait for any modal glass pane to disappear
   //   const modalGlassPane = page.locator('div.AFModalGlassPane');
  //    await modalGlassPane.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {
   //     console.log('Modal glass pane not found or already detached, proceeding...');
 //     });

      // Wait for the dialog to be fully interactive
  //    await page.waitForTimeout(2000);

      // Use the ID from the HTML to locate the radio button
   //   const doNotMoveRadio = page.locator('input[id*="sbc10:odec_sbc_sbc"][type="radio"]');
   //   const doNotMoveLabel = page.getByText('Do Not Move').first();

 //     if (await doNotMoveRadio.isVisible({ timeout: 5000 })) {
 //       console.log('Found Do Not Move radio button, clicking');
 //       await doNotMoveRadio.click();
 //     } else if (await doNotMoveLabel.isVisible({ timeout: 3000 })) {
 //       console.log('Found Do Not Move label, clicking');
 //       await doNotMoveLabel.click();
 //     } else {
 //       console.log('Do Not Move option not found, skipping...');
//      }
//    } catch (moveError) {
 //     console.log('Error with Do Not Move option, skipping:', moveError.message);
 //     await page.screenshot({ path: path.join(downloadsPath, `do_not_move_error_${Date.now()}.png`) });
 //   }
    
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
    
    const searchRatesButton = page.getByRole('button', { name: 'Search', exact: true }).first();
    await page.waitForTimeout(3000);
    if (await searchRatesButton.isVisible({ timeout: 5000 })) {
        await page.waitForTimeout(2000);
        await searchRatesButton.click();
      console.log('Clicked Search for rates');
      await page.waitForTimeout(5000);
    } else {
      console.log('Search rates button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'rates_search.png') });
    
    // Select the rate (avoid clicking "Fixed Rate" checkbox unless necessary)
    try {
      // First, select the rate row (not the checkbox)
      const rateRow = page.locator('tr[_afrrk]').first();
      if (await rateRow.isVisible({ timeout: 5000 })) {
        await page.waitForTimeout(2000);
        await rateRow.click();
        console.log('Clicked rate row');
        await page.waitForTimeout(2000);
      } else {
        console.log('Rate row not found, trying specific rate selector...');
        const rateSelector = page.locator('[id*="ltbavlrs"]').getByText('Select').first();
        await page.waitForTimeout(2000);
        if (await rateSelector.isVisible({ timeout: 3000 })) {
          // Check if this is a checkbox (likely "Fixed Rate")
          const isCheckbox = await rateSelector.evaluate(el => el.tagName.toLowerCase() === 'input' && el.type === 'checkbox');
          if (!isCheckbox) {
            await page.waitForTimeout(2000);
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

    const rateSelectButton = page.getByRole('button', { name: 'Select', exact: true }).first();
    if (await rateSelectButton.isVisible({ timeout: 5000 })) {
        await page.waitForTimeout(2000);
        await rateSelectButton.click();
      console.log('Clicked Select button for rate');
      await page.waitForTimeout(3000);
    } else {
      console.log('Rate Select button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'after_rate_selection.png') });
    
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
          return 0;
        });
        console.log(`Found Opera rate using JavaScript: ${operaRate}`);
      }

      await page.screenshot({ path: path.join(downloadsPath, 'rate_extraction.png') });
    } catch (rateError) {
      console.log('Error extracting rate:', rateError.message);
    }

    if (operaRate === 0) {
      console.log('WARNING: Could not extract rate from screen. Using default value of 0.');
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

    const discountAmountInput = page.getByRole('textbox', { name: 'Discount Amount' }).first();
    if (await discountAmountInput.isVisible({ timeout: 5000 })) {
      await discountAmountInput.click();
      await discountAmountInput.fill(roundedDiscount.toString());
      console.log(`Set discount amount to ${roundedDiscount}`);
    } else {
      console.log('Discount Amount field not found');
    }

    const discountCodeInput = page.getByRole('textbox', { name: 'Discount Code' }).first();
    if (await discountCodeInput.isVisible({ timeout: 5000 })) {
      await discountCodeInput.click();
      await discountCodeInput.fill(discountCode);
      console.log(`Set discount code to ${discountCode}`);
    } else {
      console.log('Discount Code field not found');
    }

    const methodSelect = page.getByLabel('Method').first();
    if (await methodSelect.isVisible({ timeout: 5000 })) {
      await methodSelect.selectOption('FCA');
      console.log('Selected FCA payment method');
    } else {
      console.log('Method selector not found');
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
        
        console.log('Waiting after saving profile...');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(downloadsPath, 'after_save_profile.png') });
      } catch (profileError) {
        console.log('Error handling Guest Profile dialog:', profileError.message);
        await page.screenshot({ 
          path: path.join(downloadsPath, `profile_error_${Date.now()}.png`) 
        }).catch(e => console.log('Error taking screenshot:', e.message));
        throw profileError;
      }
    }
    
    const bookNowButton = page.getByRole('button', { name: 'Book Now' }).first();
    if (await bookNowButton.isVisible({ timeout: 5000 })) {
        await page.waitForTimeout(2000);
        await bookNowButton.click();
      console.log('Clicked Book Now');
      await page.waitForTimeout(8000);
    } else {
      throw new Error('Book Now button not found');
    }
    
    await page.screenshot({ path: path.join(downloadsPath, 'booking_complete.png') });
    
    // Validate booking confirmation
    console.log('Validating booking completion...');
    const confirmationMessage = page.locator('text=/Booking Confirmed|Reservation Created/i').first();
    if (await confirmationMessage.isVisible({ timeout: 10000 })) {
      console.log('Booking confirmation message found:', await confirmationMessage.textContent());
    } else {
      throw new Error('Booking confirmation message not found');
    }
    
    const exitButton = page.getByRole('button', { name: 'Exit Booking' }).first();
    if (await exitButton.isVisible({ timeout: 10000 })) {
        await page.waitForTimeout(2000);
        await exitButton.click();
      console.log('Clicked Exit Booking');
    } else {
      console.log('Exit Booking button not found, continuing...');
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