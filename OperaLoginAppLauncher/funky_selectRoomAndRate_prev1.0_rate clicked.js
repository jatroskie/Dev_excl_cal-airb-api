// funky_selectRoomAndRate.js

const path = require('path');

/**
 * Selects the first available rate (leftmost column) specifically from the 'LONG TERM' rate row.
 * Uses a refined locator strategy based on HTML structure analysis.
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
        await page.getByText('Negotiated Rates').waitFor({ state: 'visible', timeout: ratesLoadTimeout });
        console.log(`${functionName} Rates area detected. Now locating 'LONG TERM' row...`);
        await page.screenshot({ path: `${screenshotBase}_01a_rates_area_visible.png` });

        // --- Define Locators ---

        // 1. Locate the specific row container for "LONG TERM".
        //    Finds the ancestor span containing both "LONG TERM" text and the rate cell container div.
        console.log(`${functionName} Defining locator for the 'LONG TERM' rate row container using structural XPath...`);
        const rateRowLocator = page.locator(
            `xpath=//span[normalize-space(.)='LONG TERM']` + // Find the text
            `/ancestor::span[.//div[contains(@id, ':odec_cb') and contains(@class, 'x4bo')]][1]` // Go up to the ancestor span that contains the specific rate cell div structure
        );

        // Verify the row locator finds exactly one element
        console.log(`${functionName} Verifying the row container locator...`);
        const rowCount = await rateRowLocator.count();
        console.log(`${functionName} Found ${rowCount} row container(s) for 'LONG TERM'.`);
        if (rowCount !== 1) {
            await page.screenshot({ path: `${screenshotBase}_01b_rate_row_locator_failed.png` });
            throw new Error(`Expected to find exactly 1 row container for 'LONG TERM', but found ${rowCount}. Locator needs refinement. Review screenshot.`);
        }
        console.log(`${functionName} Successfully located unique 'LONG TERM' row container.`);


        // 2. Within that specific row container, find the FIRST element matching the original clickable pattern.
        //    Reverting to div with class ltb-room-rate AND tabindex="0".
        console.log(`${functionName} Locating the first clickable element (div.ltb-room-rate[tabindex="0"]) within the 'LONG TERM' row...`);
        const clickableRateElement = rateRowLocator.locator('div.ltb-room-rate[tabindex="0"]').first();

        // --- Wait for the Clickable Element ---
        console.log(`${functionName} Waiting for the 'LONG TERM' rate row container to be visible...`);
        const elementWaitTimeout = 15000; // Timeout for elements within the row
        await rateRowLocator.waitFor({ state: 'visible', timeout: elementWaitTimeout });

        console.log(`${functionName} Waiting for the specific clickable element (div.ltb-room-rate[tabindex="0"]) in the row to be VISIBLE...`);
        await clickableRateElement.waitFor({ state: 'visible', timeout: elementWaitTimeout });
        console.log(`${functionName} Element found and visible. Now checking if ENABLED...`);
        //await clickableRateElement.waitFor({ state: 'enabled', timeout: elementWaitTimeout });

        // --- Click the Element ---
        console.log(`${functionName} Clicking the selected rate element (div.ltb-room-rate[tabindex="0"])...`);
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
                if (error.message.includes('div.ltb-room-rate[tabindex="0"]')) { // Check if timeout was on the clickable element
                     console.error(`${functionName} Timeout waiting specifically for the clickable element ('div.ltb-room-rate[tabindex="0"]'). Check its class/tabindex/visibility.`);
                } else {
                     console.error(`${functionName} Timeout occurred waiting for the rate row or the clickable element.`);
                }
                finalError = new Error(`Timeout waiting during rate selection: ${error.message}`);
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