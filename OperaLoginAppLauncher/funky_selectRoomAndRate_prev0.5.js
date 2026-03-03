// funky_selectRoomAndRate.js

const path = require('path');

/**
 * Selects the first available rate (leftmost column) specifically from the 'LONG TERM' rate row.
 * Includes waiting for the rates section to load and improved locator strategies.
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

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // --- Wait for Rates Section to Load ---
        console.log(`${functionName} Waiting for the main rates/availability area to appear...`);
        const ratesLoadTimeout = 30000;
        // Using the 'Negotiated Rates' heading as the wait condition
        await page.getByText('Negotiated Rates').waitFor({ state: 'visible', timeout: ratesLoadTimeout });
        console.log(`${functionName} Rates area detected. Now locating 'LONG TERM' row...`);
        await page.screenshot({ path: `${screenshotBase}_01a_rates_area_visible.png` });

        // --- Define Locators ---

        // 1. Locate the specific row container for "LONG TERM".
        //    Using XPath ancestor (adjust div[?] if needed based on inspection)
        console.log(`${functionName} Defining locator for the 'LONG TERM' rate row container...`);
        const rateRowLocator = page.locator(`xpath=//span[normalize-space(.)='LONG TERM']/ancestor::div[2]`); // Adjust div[?] if needed

        // Verify the row locator finds exactly one element
        console.log(`${functionName} Verifying the row container locator...`);
        const rowCount = await rateRowLocator.count();
        console.log(`${functionName} Found ${rowCount} row container(s) for 'LONG TERM'.`);
        if (rowCount !== 1) {
            await page.screenshot({ path: `${screenshotBase}_01b_rate_row_locator_failed.png` });
            throw new Error(`Expected to find exactly 1 row container for 'LONG TERM', but found ${rowCount}. Locator needs refinement. Review screenshot.`);
        }

        // 2. Within that specific row container, find the FIRST element with the suspected rate class.
        //    MODIFICATION: Removed '[tabindex="0"]' for now to be less strict.
        console.log(`${functionName} Locating the first element with class 'ltb-room-rate' within the 'LONG TERM' row...`);
        const clickableRateElement = rateRowLocator.locator('div.ltb-room-rate').first(); // TARGETING CLASS, NOT TABINDEX INITIALLY

        // --- Wait for the Clickable Element ---
        console.log(`${functionName} Waiting for the 'LONG TERM' rate row container to be visible...`);
        const elementWaitTimeout = 15000; // Timeout for elements within the row
        await rateRowLocator.waitFor({ state: 'visible', timeout: elementWaitTimeout });

        console.log(`${functionName} Waiting for the first potential rate element (div.ltb-room-rate) in the row to be VISIBLE...`);
        await clickableRateElement.waitFor({ state: 'visible', timeout: elementWaitTimeout });
        console.log(`${functionName} Element found and visible. Now checking if ENABLED...`);
        // Keep the enabled check - if this fails, it means the element exists/is visible but not interactive.
        await clickableRateElement.waitFor({ state: 'enabled', timeout: elementWaitTimeout });

        // --- Click the Element ---
        console.log(`${functionName} Clicking the selected rate element...`);
        await page.screenshot({ path: `${screenshotBase}_02_before_click.png` });
        await clickableRateElement.click({ timeout: 5000 });

        console.log(`${functionName} Rate element clicked successfully.`);
        await page.screenshot({ path: `${screenshotBase}_03_after_click.png` });

        // --- Success ---
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred during rate selection:`);
        let finalError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            if (error.message.includes("Expected to find exactly 1 row container")) {
                 console.error(`${functionName} Please refine the 'rateRowLocator' based on inspection and screenshots.`);
            } else if (error.name === 'TimeoutError') {
                // Check if the error message contains the locator we are waiting for
                if (error.message.includes("div.ltb-room-rate")) {
                     console.error(`${functionName} Timeout waiting specifically for the rate element ('div.ltb-room-rate'). Check if the class is correct or if the element is visible/enabled.`);
                } else {
                     console.error(`${functionName} Timeout occurred waiting for the rate row or the clickable element.`);
                }
                finalError = new Error(`Timeout waiting during rate selection: ${error.message}`);
            }
            // console.error(`Error Stack: ${error.stack}`); // Keep commented unless needed
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