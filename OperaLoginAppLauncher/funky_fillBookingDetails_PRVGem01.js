// funky_fillBookingDetails.js

const path = require('path');

/**
 * Fills the primary booking details: Arrival Date, Departure Date, Room Number.
 * Then attempts to click a 'Select Room' element (if applicable) before
 * finally clicking the main 'Search' button to trigger rate loading.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} startDate - The arrival date string.
 * @param {string} endDate - The departure date string.
 * @param {string} roomNumber - The room number/type string (uses last 4 chars).
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function fillBookingDetails(page, startDate, endDate, roomNumber, downloadsPath) {
    const functionName = '[fillBookingDetails]'; // Logging prefix
    console.log(`${functionName} Starting process...`);
    const screenshotBase = path.join(downloadsPath, 'fill_booking_details'); // Base name for screenshots

    // --- Input Validation ---
    if (!startDate || typeof startDate !== 'string' || startDate.trim() === '') {
        return { success: false, error: new Error('Invalid or missing startDate provided.') };
    }
    if (!endDate || typeof endDate !== 'string' || endDate.trim() === '') {
        return { success: false, error: new Error('Invalid or missing endDate provided.') };
    }
    if (!roomNumber || typeof roomNumber !== 'string' || roomNumber.length < 4) {
        // Ensure roomNumber is long enough for slice(-4)
        return { success: false, error: new Error('Invalid or missing roomNumber provided (must be at least 4 characters).') };
    }
    if (!downloadsPath || typeof downloadsPath !== 'string') {
        return { success: false, error: new Error('Invalid or missing downloadsPath provided.') };
    }

    try {
        await page.screenshot({ path: `${screenshotBase}_01_start.png`, fullPage: true });

        // Define Locators
        const arrivalInputLocator = page.getByRole('textbox', { name: 'Arrival' }).first(); // Use first() if multiple, but prefer specific parent
        const departureInputLocator = page.getByRole('textbox', { name: 'Departure' }).first();
        // Using 'exact: true' might be too strict if label changes slightly
        const roomInputLocator = page.getByRole('textbox', { name: 'Room', exact: true }).first(); // Use first() if multiple, but prefer specific parent
        
        // Then, use the .count() method (it's asynchronous)
        //const numberOfRooms = await roomInputLocator.count();

        // Log the result to the console
        //console.log('Number of "Room" textboxes found:', numberOfRooms);
        
        
        // Main Search button locator (likely near the date/room inputs)
        const searchButtonLocator = page.getByRole('button', { name: 'Search', exact: true });
       // const numberOfSearchButtons = await searchButtonLocator.count();
      //  console.log('Number of "Search" buttons found:', numberOfSearchButtons);
        const waitTimeout = 10000; // Adjust as needed


        // --- Fill Arrival Date ---
        console.log(`${functionName} Locating and filling 'Arrival' date: ${startDate}`);
        await arrivalInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await arrivalInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        await arrivalInputLocator.fill(startDate);
        await page.screenshot({ path: `${screenshotBase}_02_after_arrival.png` });
        console.log(`${functionName} Arrival date set.`);

        // --- Fill Departure Date ---
        console.log(`${functionName} Locating and filling 'Departure' date: ${endDate}`);
        await departureInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await departureInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        await departureInputLocator.fill(endDate);
        await page.screenshot({ path: `${screenshotBase}_03_after_departure.png` });
        console.log(`${functionName} Departure date set.`);

        // --- Fill Room Number (Last 4 digits) ---
        const roomNumberSuffix = roomNumber.slice(-4);
        console.log(`${functionName} Locating and filling 'Room' with: ${roomNumberSuffix}`);
        await roomInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await roomInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        await roomInputLocator.click(); // Ensure the input is focused before filling
        setTimeout(() => {}, 1000); // Optional: Adjust if needed for UI to update
        await roomInputLocator.fill(roomNumberSuffix);
        setTimeout(() => {}, 1000); // Optional: Adjust if needed for UI to update
        await page.keyboard.press('Enter'); // Simulate Enter key press to confirm input
        await page.screenshot({ path: `${screenshotBase}_04_after_room.png` });
        console.log(`${functionName} Room number set.`);
        

        await searchButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        await searchButtonLocator.click();
        setTimeout(() => {}, 2000); // Optional: Adjust if needed for UI to update
        // --- Click 'Select Room' (Optional Step - Refined Logic) ---
        // This step might be specific to your workflow. If clicking 'Search' directly
        // is sufficient after filling dates/room, you can remove this section.
        // Try to find a single, reliable locator for 'Select Room' if needed.
        // Combining locators with '|' or using a more specific parent selector is better than the cascade.
        
        console.log(`${functionName} Attempting to find and click 'Select Room' element (if present)...`);
        const selectRoomLocator = page.locator(
              `button:has-text("Select Room")`        // Button with text
            + `| a:has-text("Select Room")`           // Link with text
            + `| [role="button"]:has-text("Select Room")` // Generic element with role="button"
        ).first(); // Still using first(), refine if needed
        
        try {
            // Use a shorter timeout as this step might be optional or fast
            await selectRoomLocator.waitFor({ state: 'visible', timeout: 5000 });
            //await selectRoomLocator.waitFor({ state: 'enabled', timeout: 5000 });
            console.log(`${functionName} Found 'Select Room' element, clicking...`);
            await selectRoomLocator.click();
            console.log(`${functionName} Clicked 'Select Room'.`);
            await page.screenshot({ path: `${screenshotBase}_05_after_select_room.png` });
            // Add a small pause ONLY IF absolutely necessary for UI to update before Search
            // await page.waitForTimeout(1000); // Avoid if possible
        } catch (selectRoomError) {
            // If 'Select Room' is not found or interactable within the timeout, log it and continue.
            // This assumes clicking 'Select Room' might not always be required before 'Search'.
            // If it IS always required, then re-throw the error or return failure here.
            console.log(`${functionName} 'Select Room' element not found or not interactable within timeout. Proceeding to main Search.`);
            await page.screenshot({ path: `${screenshotBase}_05_select_room_not_found.png` });
        }

        // --- Click Main 'Search' Button ---
        // Removed the unreliable keyboard navigation section entirely.
        console.log(`${functionName} Locating and clicking main 'Search' button...`);
        await searchButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await searchButtonLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        await searchButtonLocator.click();
        setTimeout(() => {}, 3000); // Optional: Adjust if needed for UI to update
        console.log(`${functionName} Clicked 'Search' button.`);

        // --- Confirmation ---
        // Removed arbitrary wait. Waiting for rates should happen in the next step.
        console.log(`${functionName} Search triggered. Expecting rates page to load next...`);
        await page.screenshot({ path: `${screenshotBase}_06_after_search.png` });

        // Indicate success
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred:`);
        let finalError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            if (error.name === 'TimeoutError') {
                console.error(`${functionName} Timeout occurred waiting for an input field or button.`);
                finalError = new Error(`Timeout waiting for element during booking detail entry: ${error.message}`);
            }
            console.error(`Error Stack: ${error.stack}`);
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt to take a screenshot on error
        const errorScreenshotPath = `${screenshotBase}_99_error.png`;
        try {
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            console.log(`${functionName} Error screenshot saved to: ${errorScreenshotPath}`);
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error screenshot:`, screenshotError);
        }

        // Return the standard failure object structure
        return { success: false, error: finalError };
    }
}

// Export the function
module.exports = { fillBookingDetails };