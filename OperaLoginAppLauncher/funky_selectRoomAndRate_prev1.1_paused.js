// funky_selectRoomAndRate.js

const path = require('path');

/**
 * Selects the first available rate (leftmost column) specifically from the 'LONG TERM' rate row.
 * Targets the first element containing the expected room type text (e.g., "STU-URB") within the row.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function selectRoomAndRate(page, downloadsPath) {
    const functionName = '[selectRoomAndRate]'; // Logging prefix
    console.log(`${functionName} Starting rate selection process for 'LONG TERM' rate...`);
    const screenshotBase = path.join(downloadsPath, 'rate_selection');

    // --- Basic Input Validation ---
    if (!downloadsPath || typeof downloadsPath !== 'string') {
        const error = new Error('Invalid or missing downloadsPath provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }

    // --- !!! Hardcoding Expected Text - Consider making this dynamic if needed !!! ---
    const firstRoomTypeText = 'STU-URB'; // The text expected in the first rate cell

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // --- Wait for Rates Section ---
        console.log(`${functionName} Waiting for the main rates/availability area...`);
        const ratesLoadTimeout = 30000;
        await page.getByText('Negotiated Rates').waitFor({ state: 'visible', timeout: ratesLoadTimeout });
        console.log(`${functionName} Rates area detected. Locating 'LONG TERM' row...`);
        await page.screenshot({ path: `${screenshotBase}_01a_rates_area_visible.png` });

        // --- Locate Row Container ---
        console.log(`${functionName} Defining locator for the 'LONG TERM' rate row container...`);
        const rateRowLocator = page.locator(`xpath=//span[normalize-space(.)='LONG TERM']/ancestor::div[2]`); // Verified locator
        console.log(`${functionName} Verifying the row container locator...`);
        const rowCount = await rateRowLocator.count();
        if (rowCount !== 1) {
            await page.screenshot({ path: `${screenshotBase}_01b_rate_row_locator_failed.png` });
            throw new Error(`Expected 1 'LONG TERM' row container, found ${rowCount}.`);
        }
        console.log(`${functionName} Located unique 'LONG TERM' row container.`);

        // ****** ADD PAUSE FOR INSPECTION ******
        console.log(`${functionName} PAUSING FOR INSPECTION. Check the browser and Playwright Inspector.`);
        console.log(`${functionName} In Inspector, try locating elements within: xpath=//span[normalize-space(.)='LONG TERM']/ancestor::div[2]`);
        await page.pause();
        // ****** END PAUSE ******
        
        // --- Locate Clickable Element by Text ---
        // Find the first element *within the row* that contains the expected room type text.
        console.log(`${functionName} Locating the first rate element containing text "${firstRoomTypeText}" within the 'LONG TERM' row...`);
        const clickableRateElement = rateRowLocator.locator(`*:text-is("${firstRoomTypeText}")`).first(); // TARGETING BY TEXT

        // --- Wait for the Clickable Element ---
        console.log(`${functionName} Waiting for the 'LONG TERM' rate row container to be visible...`);
        const elementWaitTimeout = 15000;
        await rateRowLocator.waitFor({ state: 'visible', timeout: elementWaitTimeout });

        console.log(`${functionName} Waiting for the first rate element containing "${firstRoomTypeText}" in the row to be VISIBLE...`);
        await clickableRateElement.waitFor({ state: 'visible', timeout: elementWaitTimeout });
        console.log(`${functionName} Element containing text found and visible. Assuming it's clickable or its container is...`);
        // NOTE: We skip the 'enabled' check here as the text element itself might not be the directly enabled one,
        // but clicking it might trigger the action on a parent.

        // --- Click the Element ---
        console.log(`${functionName} Clicking the selected rate element (containing "${firstRoomTypeText}")...`);
        await page.screenshot({ path: `${screenshotBase}_02_before_click.png` });
        await clickableRateElement.click({ timeout: 5000 }); // Click the element containing the text

        console.log(`${functionName} Initial rate element clicked. Waiting for Rate Info popup...`);
        await page.screenshot({ path: `${screenshotBase}_03_after_initial_click.png` });


        // --- Handle the Rate Information Popup (Code from previous successful step) ---
        const popupSelectButtonLocator = page.getByRole('button', { name: 'Select' });
        const popupWaitTimeout = 20000;
        console.log(`${functionName} Waiting for 'Select' button in popup...`);
        await popupSelectButtonLocator.waitFor({ state: 'visible', timeout: popupWaitTimeout });
        //await popupSelectButtonLocator.waitFor({ state: 'enabled', timeout: popupWaitTimeout });
        console.log(`${functionName} Found 'Select' button in popup.`);
        await page.screenshot({ path: `${screenshotBase}_04_popup_visible.png` });
        console.log(`${functionName} Clicking 'Select' button in popup...`);
        await popupSelectButtonLocator.click({ timeout: 5000 });
        console.log(`${functionName} Popup 'Select' button clicked.`);
        console.log(`${functionName} Waiting for Rate Info popup to close...`);
        await popupSelectButtonLocator.waitFor({ state: 'hidden', timeout: 10000 });
        console.log(`${functionName} Rate Info popup closed.`);
        await page.screenshot({ path: `${screenshotBase}_05_after_popup_select.png` });
        // --- End Popup Handling ---

        // --- Success ---
        console.log(`${functionName} Rate selection fully completed.`);
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred during rate selection:`);
        let finalError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            if (error.message.includes("Expected to find exactly 1 row container")) {
                 console.error(`${functionName} Please refine the 'rateRowLocator'.`);
            } else if (error.name === 'TimeoutError') {
                if (error.message.includes(`:text-is("${firstRoomTypeText}")`)) {
                     console.error(`${functionName} Timeout waiting specifically for the element containing text "${firstRoomTypeText}". Check if the text is correct or visible.`);
                 } else if (error.message.includes("button', { name: 'Select' }")) {
                     console.error(`${functionName} Timeout waiting for the 'Select' button in the Rate Info popup.`);
                 } else {
                     console.error(`${functionName} Timeout occurred waiting somewhere in the rate selection process.`);
                 }
                 finalError = new Error(`Timeout during rate selection: ${error.message}`);
            }
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt error screenshot
        const errorScreenshotPath = `${screenshotBase}_99_error.png`;
        try {
            if (page && !page.isClosed()) {
                await page.screenshot({ path: errorScreenshotPath, fullPage: true });
                console.log(`${functionName} Error screenshot saved to: ${errorScreenshotPath}`);
            } else {
                 console.log(`${functionName} Page closed or not available, skipping error screenshot.`);
            }
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error screenshot:`, screenshotError);
        }

        // Return failure object
        return { success: false, error: finalError };
    }
}

// Export the function
module.exports = { selectRoomAndRate };