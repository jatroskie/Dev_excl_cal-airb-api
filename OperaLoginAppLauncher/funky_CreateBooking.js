const fs = require('fs');
const path = require('path');
// Import necessary Playwright module - ensure it's installed ('npm install playwright')
const { chromium } = require('playwright');

// Import helper functions (assuming they exist in the specified paths)
// It's good practice to ensure these functions consistently return { success: boolean, error?: Error }
const { loginToOperaCloud } = require('./funky_login3'); // Assuming login3.js exports loginToOperaCloud
const { hotelSwitcher } = require('./funky_hotelSwitcher.js');
const { navigateToBookingScreen } = require('./funky_navigateToBookingScreen.js');
const { enterTravelAgentDetails } = require('./funky_enterTravelAgentDetails.js');
const { fillBookingDetails } = require('./funky_fillBookingDetails.js');
const { selectRoomAndRate } = require('./funky_selectRoomAndRate.js');
const { setDiscountsOrPaymentMethods } = require('./funky_setDiscountsOrPaymentMeth.js');
const { createGuestProfile } = require('./funky_createGuestProfile.js');
const { clickBookNowButton } = require('./funky_clickBookNowButton.js');
const { handleErrorsOrConfirmBooking } = require('./funky_handleErrorsOrConfirmBooking.js');


/**
 * Main function to create a booking in Opera Cloud.
 * Handles login, navigation, filling details, rate selection, profile creation, and booking confirmation.
 *
 * @param {string} clientName - Guest's last name.
 * @param {string} firstName - Guest's first name.
 * @param {string} telephoneNumber - Guest's telephone number.
 * @param {string} roomNumber - The target room number or type (e.g., "TBA-0405").
 * @param {string} startDate - Booking start date (format depends on what fillBookingDetails expects).
 * @param {string} endDate - Booking end date (format depends on what fillBookingDetails expects).
 * @param {string} [discountCode='OTH'] - Discount code to apply (optional, defaults to 'OTH').
 * @param {string} [hotelCode='The Barracks'] - The hotel code to use for the booking.
 * @returns {Promise<{success: boolean, message?: string, error?: Error}>} - Result object.
 */
async function createBooking(clientName, firstName, telephoneNumber, roomNumber, startDate, endDate, discountCode = 'OTH', hotelCode) {
  let browser = null;
  let context = null;
  let page = null;
  // Define downloadsPath early so it's available throughout the try block
  const downloadsPath = path.join(__dirname, 'downloads');

  try {
    console.log(`[createBooking] Starting booking process for ${firstName} ${clientName}...`);

    // Ensure downloads directory exists for screenshots
    if (!fs.existsSync(downloadsPath)) {
      console.log(`[createBooking] Creating downloads directory: ${downloadsPath}`);
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    // --- Step 1: Log in ---
    console.log("[createBooking] Step 1: Logging in...");
    const loginResult = await loginToOperaCloud();
    // Defensive check: ensure loginResult exists and has success property
    if (!loginResult || !loginResult.success) {
        const errorMsg = loginResult?.error?.message || 'Unknown login failure (login function did not return expected success object)';
        // Throw error immediately if login fails, as subsequent steps depend on it
        throw new Error(`Login failed: ${errorMsg}`);
    }
    // Destructure browser, context, page from the successful login result
    ({ browser, context, page } = loginResult);
    console.log("[createBooking] Login successful. Initial page obtained.");

    // --- Refined Popup/Navigation Handling ---
    // Check the URL after login to see if we are on the main app page or need redirection/handling
    let currentUrl = await page.url();
    console.log(`[createBooking] URL immediately after login: ${currentUrl}`);
    const expectedUrlPart = 'OperaCloud'; // Part of the URL indicating the main application

    // Check if the current URL suggests a popup checker or isn't the main app URL
    if (currentUrl.includes('PopupChecker') || !currentUrl.includes(expectedUrlPart)) {
        console.log('[createBooking] Post-login URL requires handling (PopupChecker or not main app). Attempting to reach main application...');
        const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud'; // Define target URL clearly

        // Option A: Assume the *same* page eventually navigates or needs explicit navigation (More common)
        try {
            console.log(`[createBooking] Waiting for URL containing "${expectedUrlPart}" on the current page...`);
            // Wait for the current page to navigate to the main app URL
            await page.waitForURL(`**/${expectedUrlPart}**`, { timeout: 45000 }); // Use glob pattern for flexibility
            console.log('[createBooking] Page automatically navigated/redirected to OperaCloud URL.');
        } catch (waitError) {
            console.log(`[createBooking] Page did not automatically navigate to "${expectedUrlPart}". Attempting explicit navigation to: ${appUrl}`);
            try {
                // If waiting failed, navigate the current page explicitly
                await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60000 });
                console.log('[createBooking] Explicit navigation successful.');
            } catch (gotoError) {
                 console.error(`[createBooking] Explicit navigation failed: ${gotoError.message}`);
                 // If navigation fails, we cannot proceed
                 throw new Error(`Failed to navigate to the main application page at ${appUrl} after login handling: ${gotoError.message}`);
            }
        }
        // Add other handling logic here if Opera *truly* opens a new tab/window, which is less common.
        // See previous response's Option B for ideas (context.waitForEvent('page'), context.pages())
    }

    // Re-verify URL after handling potential popups/redirects
    currentUrl = await page.url();
    console.log(`[createBooking] URL before booking screen navigation: ${currentUrl}`);
    if (!currentUrl.includes(expectedUrlPart)) {
        // If we're still not on the main app page, something went wrong
        throw new Error('Failed to reach the main OperaCloud application page after login/popup handling.');
    }
     console.log('[createBooking] Successfully on main application page.');
    // --- End Refined Popup Handling ---

// --- Step 2: Choose the hotel  ---
  const hotelResult = await hotelSwitcher(page, hotelCode, downloadsPath);
    if (!hotelResult || !hotelResult.success) {
      const errorMsg = hotelResult?.error?.message || 'Unknown navigation failure';
      throw new Error(`Navigation to correct hotel failed: ${errorMsg}`);
    }
    console.log("[createBooking] Navigation to hotel successful.");


    // --- Step 2.5: Navigate to booking screen ---
    console.log("[createBooking] Step 2: Navigating to booking screen...");
    const navigateResult = await navigateToBookingScreen(page, downloadsPath);
    if (!navigateResult || !navigateResult.success) {
      const errorMsg = navigateResult?.error?.message || 'Unknown navigation failure';
      throw new Error(`Navigation to booking screen failed: ${errorMsg}`);
    }
    console.log("[createBooking] Navigation to booking screen successful.");


    // --- Step 3: Enter travel agent details ---
    console.log("[createBooking] Step 3: Entering travel agent details...");
    // Consider making 'AirBnB' a parameter if it needs to change
    const travelAgent = 'AirBnB';
    const travelAgentResult = await enterTravelAgentDetails(page, travelAgent, downloadsPath);
    if (!travelAgentResult || !travelAgentResult.success) {
      const errorMsg = travelAgentResult?.error?.message || 'Unknown error entering travel agent';
      throw new Error(`Entering travel agent details ('${travelAgent}') failed: ${errorMsg}`);
    }
    console.log("[createBooking] Travel agent details entered successfully.");


    // --- Step 4: Fill booking details ---
    console.log("[createBooking] Step 4: Filling booking details...");
    // Note: airRate parameter removed as it wasn't used. Add it back if needed by fillBookingDetails.
    const fillDetailsResult = await fillBookingDetails(page, startDate, endDate, roomNumber, downloadsPath);
    if (!fillDetailsResult || !fillDetailsResult.success) {
      const errorMsg = fillDetailsResult?.error?.message || 'Unknown error filling details';
      throw new Error(`Filling booking details failed: ${errorMsg}`);
    }
    console.log("[createBooking] Booking details filled successfully.");


    // --- Step 5: Select room and rate ---
    console.log("[createBooking] Step 5: Selecting room and rate...");
    // *** Pass downloadsPath argument ***
    const selectRoomResult = await selectRoomAndRate(page, downloadsPath);
    // *** Check !success explicitly ***
    if (!selectRoomResult || !selectRoomResult.success) {
      const errorMsg = selectRoomResult?.error?.message || 'Unknown error selecting rate';
      throw new Error(`Selecting room and rate failed: ${errorMsg}`);
    }
    console.log("[createBooking] Room and rate selected successfully.");

    // *** Invalid 'timeout: 10000' line removed ***


    // --- Step 6: Set Discounts or Payment Methods ---
    console.log(`[createBooking] Step 6: Setting discounts/payment methods with code: ${discountCode}...`);
    // *** Removed redundant first call ***
    const setDiscountResult = await setDiscountsOrPaymentMethods(page, discountCode, downloadsPath);
    // *** Added error check ***
    if (!setDiscountResult || !setDiscountResult.success) {
       const errorMsg = setDiscountResult?.error?.message || 'Unknown error setting discount/payment';
       throw new Error(`Setting discounts/payment methods failed: ${errorMsg}`);
    }
    console.log("[createBooking] Discounts/payment methods set successfully.");


    // --- Step 7: Create Guest Profile ---
    console.log("[createBooking] Step 7: Creating guest profile...");
    const createProfileResult = await createGuestProfile(page, clientName, firstName, telephoneNumber, downloadsPath);
    // *** Added error check ***
    if (!createProfileResult || !createProfileResult.success) {
       const errorMsg = createProfileResult?.error?.message || 'Unknown error creating profile';
       throw new Error(`Creating guest profile failed: ${errorMsg}`);
    }
    console.log("[createBooking] Guest profile created successfully.");


    // --- Step 8: Click Book Now Button ---
    console.log("[createBooking] Step 8: Clicking Book Now button...");
    const clickBookNowResult = await clickBookNowButton(page, downloadsPath);
    // *** Added error check ***
    if (!clickBookNowResult || !clickBookNowResult.success) {
       const errorMsg = clickBookNowResult?.error?.message || 'Unknown error clicking book now';
       throw new Error(`Clicking Book Now button failed: ${errorMsg}`);
    }
    console.log("[createBooking] Book Now button clicked successfully.");


    // --- Step 9: Handle Errors or Confirm Booking ---
    console.log("[createBooking] Step 9: Handling errors/confirming booking...");
    const handleConfirmResult = await handleErrorsOrConfirmBooking(page, downloadsPath);
    // *** Added error check ***
    if (!handleConfirmResult || !handleConfirmResult.success) {
       const errorMsg = handleConfirmResult?.error?.message || 'Unknown error handling confirmation';
       throw new Error(`Handling errors or confirming booking failed: ${errorMsg}`);
    }
    console.log("[createBooking] Booking confirmation handled successfully.");


    // --- Success ---
    const successMessage = `Booking process completed successfully for ${firstName} ${clientName}`;
    console.log(`[createBooking] ${successMessage}`);
    return { success: true, message: successMessage };

  } catch (error) {
    // --- Error Handling ---
    console.error('**********************************************');
    console.error('[createBooking] CRITICAL ERROR during booking process:', error.message);
    // Log stack trace for better debugging where the error originated
    if (error.stack) {
        console.error('[createBooking] Error Stack Trace:', error.stack);
    }
     console.error('**********************************************');

     // Attempt to take a screenshot on error for debugging, if page exists
     if (page && !page.isClosed()) {
        const errorScreenshotPath = path.join(downloadsPath, 'booking_ERROR_screenshot.png');
        try {
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            console.log(`[createBooking] Error screenshot saved to: ${errorScreenshotPath}`);
        } catch (ssError) {
            console.error(`[createBooking] Failed to take error screenshot: ${ssError.message}`);
        }
     } else {
         console.log("[createBooking] Page object was not available or closed, skipping error screenshot.");
     }

    // Return a consistent failure object, ensuring error is an Error instance
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };

  } finally {
    // --- Resource Cleanup ---
    console.log("[createBooking] Cleaning up browser resources...");
    // Close resources gracefully, checking if they exist and handling potential closing errors
    if (page && !page.isClosed()) {
        try {
            await page.close();
            console.log("[createBooking] Page closed.");
        } catch (e) { console.error('[createBooking] Error closing page:', e.message); }
    } else {
        console.log("[createBooking] Page already closed or not initialized.");
    }
    if (context) {
        try {
            await context.close();
            console.log("[createBooking] Browser context closed.");
        } catch (e) { console.error('[createBooking] Error closing context:', e.message); }
    } else {
         console.log("[createBooking] Context not initialized.");
    }
    if (browser) {
        try {
            await browser.close();
            console.log("[createBooking] Browser closed.");
         } catch (e) { console.error('[createBooking] Error closing browser:', e.message); }
    } else {
         console.log("[createBooking] Browser not initialized.");
    }
    console.log("[createBooking] Cleanup finished.");
  }
}

// --- Example Usage ---
// Call the main function and handle the final promise result
createBooking(
    "Smith",                // clientName
    "John",                 // firstName
    "+27828820100",         // telephoneNumber
    "TBA-0405",             // roomNumber
    "01-05-2025",           // startDate (adjust format as needed)
    "05-05-2025",           // endDate (adjust format as needed)
    'OTH'                   // discountCode (optional)
    // airRate parameter removed - add back if needed by called functions
)
  .then(result => {
    if (result.success) {
      console.log("✅ createBooking Function Result: Success!");
      console.log(result.message);
    } else {
      console.error("❌ createBooking Function Result: Failed!");
      // Log the error message from the returned error object
      console.error("Error Details:", result.error?.message || result.error || "Unknown error structure returned");
      // Optional: Exit with non-zero code on failure for CI/CD pipelines
      // process.exit(1);
    }
  })
  .catch(e => {
    // This catch block handles unexpected errors *outside* the main try/catch
    // (e.g., issues with imports, errors in the finally block before it completes)
    console.error("💥 UNHANDLED EXCEPTION in createBooking execution:", e);
    // process.exit(1);
  });