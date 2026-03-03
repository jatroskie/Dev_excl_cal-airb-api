// Imports
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Placeholder for the login function (assumed to be in login3.js)
const loginToOperaCloud = require('./login4.js');

// Setup paths
const downloadsPath = path.join(__dirname, 'screenshots');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath, { recursive: true });
}

async function createBooking(clientName, firstName, telephoneNumber, roomNumber, 
    startDate, endDate, airRate, discountCode = 'OTH') {
  let browser = null;
  let context = null;
  let page = null;

  // Declare maxRetries once at the top of the function
  const maxRetries = 3;

  try {
    console.log(`Starting booking process for ${firstName} ${clientName}, room ${roomNumber}...`);

    // Handle manual interruptions gracefully
    process.on('SIGINT', async () => {
      console.log('Script interrupted, cleaning up...');
      if (page && !page.isClosed()) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
      process.exit(0);
    });

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

    // Retry navigation if session expires
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (currentUrl.includes('PopupChecker') || !currentUrl.includes('OperaCloud')) {
        console.log('Need to navigate to main application...');
        console.log('Creating new page for main application...');
        page = await context.newPage();

        const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
        console.log(`Navigating to main application URL: ${appUrl} (Attempt ${attempt})`);

        try {
          await page.goto(appUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });

          await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout, continuing anyway');
          });

          // Check if navigation was successful
          const newUrl = await page.url();
          if (newUrl.includes('OperaCloud')) {
            console.log('Navigation successful');
            break;
          } else if (attempt === maxRetries) {
            throw new Error('Failed to navigate to main application after maximum retries');
          }
        } catch (navError) {
          console.log(`Navigation attempt ${attempt} failed: ${navError.message}`);
          if (attempt === maxRetries) {
            throw new Error(`Failed to navigate to main application after ${maxRetries} attempts: ${navError.message}`);
          }
          await page.close();
          page = await context.newPage();
          continue;
        }
      } else {
        break; // Navigation not needed
      }
    }

    // Navigate to Bookings page
    console.log('Navigating to Bookings page...');
    await page.getByRole('link', { name: 'Bookings' }).click();
    await page.waitForTimeout(5000);

    // Click on New Reservation
    console.log('Clicking on New Reservation...');
    await page.getByRole('link', { name: 'New Reservation' }).click();
    await page.waitForTimeout(5000);

    // Fill in reservation details
    console.log('Filling in reservation details...');
    await page.getByLabel('Arrival Date').fill(startDate);
    await page.getByLabel('Departure Date').fill(endDate);
    await page.getByLabel('Room Number').fill(roomNumber);
    await page.waitForTimeout(2000);

    // Click Search button
    console.log('Clicking Search button...');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(5000);

    // Select the rate
    console.log('Selecting the rate...');
    const rateRow = page.getByRole('row').filter({ hasText: airRate });
    if (await rateRow.isVisible({ timeout: 10000 })) {
      await rateRow.getByRole('button', { name: 'Select' }).click();
      console.log(`Selected rate: ${airRate}`);
    } else {
      throw new Error(`Rate ${airRate} not found`);
    }

    await page.waitForTimeout(5000);

    // Extract rate amount
    console.log('Extracting rate amount...');
    const rateAmountText = await page.locator('text=/Rate Amount/i').locator('..').locator('span').textContent({ timeout: 10000 });
    const rateAmount = parseFloat(rateAmountText.replace(/[^0-9.]/g, ''));
    console.log(`Extracted rate amount: ${rateAmount}`);

    // Calculate discount (example: 10% discount)
    const discountPercentage = 10;
    const discount = (rateAmount * discountPercentage) / 100;
    const roundedDiscount = Math.round(discount * 100) / 100;
    console.log(`Calculated discount (${discountPercentage}%): ${roundedDiscount}`);

    // Take screenshot before looking for discount fields
    await page.screenshot({ path: path.join(downloadsPath, 'before_discount_fields.png') });

    // Wait for the page to stabilize
    console.log('Waiting for page to stabilize before interacting with discount fields...');
    await page.waitForTimeout(5000);

    // Try to find discount amount input with better fallbacks
    console.log('Attempting to set Discount Amount...');
    let discountAmountSet = false;

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

    // Take screenshot after attempting to set discount code
    await page.screenshot({ path: path.join(downloadsPath, 'after_discount_code_attempt.png') });

    // Take a screenshot after rate selection process
    await page.screenshot({ path: path.join(downloadsPath, 'after_complete_rate_selection.png') });

    // Handle any popups that might interfere (e.g., "What's new in OPERA Cloud 24.4")
    console.log('Checking for and closing any interfering popups...');
    const popupSelectors = [
      page.locator('div.ogl-rw-popover-content').filter({ hasText: "What's new in OPERA Cloud 24.4" }),
      page.locator('div.tooltip').filter({ hasText: "Use arrow keys to read it" }),
      page.locator('button[id*="tooltipClose"]').first(),
      page.locator('button[aria-label="Close Guide"]').first()
    ];

    for (const popup of popupSelectors) {
      if (await popup.isVisible({ timeout: 5000 })) {
        console.log('Found interfering popup, attempting to close...');
        const closeButton = popup.locator('button[id*="tooltipClose"], button[aria-label="Close Guide"]').first();
        if (await closeButton.isVisible({ timeout: 2000 })) {
          await closeButton.click();
          console.log('Closed popup');
          await page.waitForTimeout(2000); // Wait for the popup to fully close
        } else {
          console.log('Close button not found in popup, trying JavaScript...');
          await page.evaluate(() => {
            const closeButtons = Array.from(document.querySelectorAll('button'))
              .filter(btn => btn.textContent.includes('Close') || btn.getAttribute('aria-label')?.includes('Close'));
            if (closeButtons.length > 0) {
              closeButtons[0].click();
            }
          });
          console.log('Closed popup using JavaScript');
          await page.waitForTimeout(2000);
        }
      }
    }

    // Ensure the page is still open before proceeding
    if (page.isClosed()) {
      throw new Error('Page has been closed unexpectedly before proceeding with guest profile');
    }

    // Now capture the guest profile data as the last step before booking
    console.log('Looking for New Profile link to create guest profile...');
    const newProfileLink = page.getByRole('link', { name: 'New Profile' }).first();
    let newProfileClicked = false;

    if (await newProfileLink.isVisible({ timeout: 10000 })) {
      await newProfileLink.click();
      console.log('Clicked New Profile link');
      newProfileClicked = true;
    } else {
      console.log('New Profile link not found, trying alternate selector...');
      const altNewProfileLink = page.locator('a:has-text("New Profile")').first();
      if (await altNewProfileLink.isVisible({ timeout: 5000 })) {
        await altNewProfileLink.click();
        console.log('Clicked New Profile link using alternate method');
        newProfileClicked = true;
      } else {
        throw new Error('New Profile link not found');
      }
    }

    if (newProfileClicked) {
      try {
        // Ensure the page is still open
        if (page.isClosed()) {
          throw new Error('Page has been closed unexpectedly before handling Guest Profile dialog');
        }

        // Increase wait time to ensure dialog appears
        console.log('Waiting for Guest Profile dialog to appear...');
        await page.waitForTimeout(5000); // Increased from 3000ms to 5000ms

        // Try different strategies to locate the Guest Profile dialog
        let profileDialog = null;
        let dialogFound = false;

        // Strategy 1: Role-based locator
        console.log('Trying role-based locator for Guest Profile dialog...');
        profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
        dialogFound = await profileDialog.isVisible({ timeout: 15000 }).catch(() => false);

        // Strategy 2: Broader aria-label and id-based locator
        if (!dialogFound) {
          console.log('Guest Profile dialog not found with role, trying alternate selector...');
          profileDialog = page.locator('div[aria-label*="Profile" i], div[id*="profile" i], div[aria-label*="Guest" i]');
          dialogFound = await profileDialog.isVisible({ timeout: 5000 }).catch(() => false);
        }

        // Strategy 3: Text-based locator (looking for "Guest Profile" or "Profile" in the dialog header)
        if (!dialogFound) {
          console.log('Guest Profile dialog not found with aria-label, trying text-based locator...');
          profileDialog = page.locator('div').filter({ has: page.locator('text=/Guest Profile|Profile|Create Profile/i') });
          dialogFound = await profileDialog.isVisible({ timeout: 5000 }).catch(() => false);
        }

        // Strategy 4: Iframe-based locator with broader iframe selector
        if (!dialogFound) {
          console.log('Guest Profile dialog not found on main page, trying iframe...');
          const iframeSelectors = [
            'iframe[title="Content"]',
            'iframe[id*="popup"]',
            'iframe[id*="dialog"]',
            'iframe' // Fallback to any iframe
          ];

          for (const iframeSelector of iframeSelectors) {
            console.log(`Checking iframe with selector: ${iframeSelector}`);
            const iframeLocator = page.frameLocator(iframeSelector);
            profileDialog = iframeLocator.locator('div[aria-label*="Profile" i], div[id*="profile" i], div[aria-label*="Guest" i]');
            dialogFound = await profileDialog.isVisible({ timeout: 3000 }).catch(() => false);
            if (dialogFound) {
              console.log(`Found Guest Profile dialog in iframe with selector: ${iframeSelector}`);
              break;
            }

            // Try text-based locator in iframe
            if (!dialogFound) {
              profileDialog = iframeLocator.locator('div').filter({ has: iframeLocator.locator('text=/Guest Profile|Profile|Create Profile/i') });
              dialogFound = await profileDialog.isVisible({ timeout: 3000 }).catch(() => false);
              if (dialogFound) {
                console.log(`Found Guest Profile dialog in iframe (text-based) with selector: ${iframeSelector}`);
                break;
              }
            }
          }
        }

        // Strategy 5: JavaScript fallback to find any dialog-like element
        if (!dialogFound) {
          console.log('Guest Profile dialog not found with any locator, trying JavaScript fallback...');
          const dialogInfo = await page.evaluate(() => {
            const possibleDialogs = Array.from(document.querySelectorAll('div'))
              .filter(el => {
                const isVisible = el.offsetParent !== null;
                const hasRelevantText = el.textContent && /Guest Profile|Profile|Create Profile/i.test(el.textContent);
                const hasDialogAttributes = el.getAttribute('role') === 'dialog' ||
                                           el.className.includes('dialog') ||
                                           el.className.includes('popup') ||
                                           el.className.includes('modal');
                return isVisible && (hasRelevantText || hasDialogAttributes);
              })
              .map(el => ({
                text: el.textContent.trim().substring(0, 100), // Limit text length for logging
                id: el.id || 'no-id',
                classes: el.className || 'no-class',
                role: el.getAttribute('role') || 'no-role',
                outerHTML: el.outerHTML
              }));
            return possibleDialogs;
          });

          console.log('Possible dialog elements found via JavaScript:', dialogInfo);
          if (dialogInfo.length > 0) {
            // Use the first matching dialog
            profileDialog = page.locator(`div[id="${dialogInfo[0].id}"]`).first();
            dialogFound = true;
            console.log('Found Guest Profile dialog using JavaScript fallback');
          }
        }

        // If still not found, take a screenshot and throw an error
        if (!dialogFound) {
          await page.screenshot({ path: path.join(downloadsPath, 'guest_profile_dialog_not_found.png') });
          console.log('Screenshot taken: guest_profile_dialog_not_found.png');

          // Log all visible divs that might be dialogs for debugging
          const allDivs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('div'))
              .filter(el => el.offsetParent !== null)
              .map(el => ({
                text: el.textContent.trim().substring(0, 100),
                id: el.id || 'no-id',
                classes: el.className || 'no-class',
                role: el.getAttribute('role') || 'no-role'
              }));
          });
          console.log('All visible divs on the page:', allDivs);

          throw new Error('Could not find Guest Profile dialog with any strategy');
        }

        console.log('Guest Profile dialog found, proceeding to fill details...');

        // Ensure the page is still open before proceeding
        if (page.isClosed()) {
          throw new Error('Page has been closed unexpectedly while handling Guest Profile dialog');
        }

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
      } catch (profileError) {
        console.log('Error handling Guest Profile dialog:', profileError.message);
        await page.screenshot({
          path: path.join(downloadsPath, `profile_error_${Date.now()}.png`)
        }).catch(e => console.log('Error taking screenshot:', e.message));
        throw profileError;
      }
    }

    await page.screenshot({ path: path.join(downloadsPath, 'after_booking_attempt.png') });

    console.log('Booking process completed successfully');
  } catch (error) {
    console.log('Error in booking process:', error.message);
    if (page && !page.isClosed()) {
      await page.screenshot({
        path: path.join(downloadsPath, `error_${Date.now()}.png`)
      }).catch(e => console.log('Error taking screenshot:', e.message));
    }
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Main execution logic
(async () => {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    if (args.length < 7) {
      console.error('Usage: node LTBS-Automation2.4.js <lastName> <firstName> <telephoneNumber> <roomNumber> <startDate> <endDate> <airRate> [discountCode]');
      console.error('Example: node LTBS-Automation2.4.js "Smith" "John" "1234567890" "0405" "15.05.2025" "18.05.2025" "1850" "OTH"');
      process.exit(1);
    }

    const [
      clientName,
      firstName,
      telephoneNumber,
      roomNumber,
      startDate,
      endDate,
      airRate,
      discountCode = 'OTH'
    ] = args;

    // Validate inputs (basic validation)
    if (!clientName || !firstName || !telephoneNumber || !roomNumber || !startDate || !endDate || !airRate) {
      throw new Error('All required arguments must be provided and non-empty');
    }

    // Validate date format (DD.MM.YYYY)
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('Dates must be in DD.MM.YYYY format (e.g., 15.05.2025)');
    }

    // Validate airRate as a number
    if (isNaN(parseFloat(airRate))) {
      throw new Error('airRate must be a valid number');
    }

    console.log('Starting automation script with the following parameters:');
    console.log(`Last Name: ${clientName}`);
    console.log(`First Name: ${firstName}`);
    console.log(`Telephone Number: ${telephoneNumber}`);
    console.log(`Room Number: ${roomNumber}`);
    console.log(`Start Date: ${startDate}`);
    console.log(`End Date: ${endDate}`);
    console.log(`Air Rate: ${airRate}`);
    console.log(`Discount Code: ${discountCode}`);

    // Call the createBooking function
    await createBooking(
      clientName,
      firstName,
      telephoneNumber,
      roomNumber,
      startDate,
      endDate,
      airRate,
      discountCode
    );

    console.log('Script completed successfully');
  } catch (error) {
    console.error('Script failed:', error.message);
    process.exit(1);
  }
})();