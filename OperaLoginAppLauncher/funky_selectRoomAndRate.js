// funky_selectRoomAndRate.js

const path = require('path');

/**
 * Selects the first available rate (leftmost column) specifically from the 'LONG TERM' rate row.
 * Uses refined locators based on inspection.
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

        // --- Wait for Rates Section ---
        console.log(`${functionName} Waiting for the main rates/availability area...`);
        const ratesLoadTimeout = 30000;
        await page.getByText('Negotiated Rates').waitFor({ state: 'visible', timeout: ratesLoadTimeout });
        console.log(`${functionName} Rates area detected. Locating 'LONG TERM' row...`);
        await page.screenshot({ path: `${screenshotBase}_01a_rates_area_visible.png` });

        // --- Define Locators ---

        // 1. Locate the specific row container for "LONG TERM". (Verified)
        console.log(`${functionName} Defining locator for the 'LONG TERM' rate row container...`);
        const rateRowLocator = page.locator(`xpath=//span[normalize-space(.)='LONG TERM']/ancestor::div[2]`);

        // Verify the row locator finds exactly one element
        console.log(`${functionName} Verifying the row container locator...`);
        const rowCount = await rateRowLocator.count();
        if (rowCount !== 1) {
            await page.screenshot({ path: `${screenshotBase}_01b_rate_row_locator_failed.png` });
            throw new Error(`Expected 1 'LONG TERM' row container, found ${rowCount}. Locator needs refinement.`);
        }
        console.log(`${functionName} Located unique 'LONG TERM' row container.`);


        // 2. Within that row container, find the specific clickable rate element.
        //    Based on inspection: Find the first element matching the known structure.
        console.log(`${functionName} Locating the first clickable element (div.ltb-room-rate[tabindex="0"]) within the 'LONG TERM' row...`);
        // We now target the specific combination we know exists for the clickable element
        const clickableRateElement = rateRowLocator.locator('div.ltb-room-rate[tabindex="0"]').first();

        // --- Wait for the Clickable Element ---
        console.log(`${functionName} Waiting for the 'LONG TERM' rate row container to be visible...`);
        const elementWaitTimeout = 15000;
        await rateRowLocator.waitFor({ state: 'visible', timeout: elementWaitTimeout });

        console.log(`${functionName} Waiting for the specific clickable element (div.ltb-room-rate[tabindex="0"]) in the row to be VISIBLE...`);
        await clickableRateElement.waitFor({ state: 'visible', timeout: elementWaitTimeout }); // Wait for visible first
        console.log(`${functionName} Element found and visible. Now checking if ENABLED...`);
        await clickableRateElement.waitFor({ state: 'enabled', timeout: elementWaitTimeout }); // Then wait for enabled


        // --- Click the Element ---
        console.log(`${functionName} Clicking the selected rate element (div.ltb-room-rate[tabindex="0"])...`);
        await page.screenshot({ path: `${screenshotBase}_02_before_click.png` });
        await clickableRateElement.click({ timeout: 5000 });

        console.log(`${functionName} Initial rate element clicked. Waiting for Rate Info popup...`);
        await page.screenshot({ path: `${screenshotBase}_03_after_initial_click.png` });

        // --- Handle the Rate Information Popup ---
        const popupSelectButtonLocator = page.getByRole('button', { name: 'Select' });
        const popupWaitTimeout = 20000;
        console.log(`${functionName} Waiting for 'Select' button in popup...`);
        await popupSelectButtonLocator.waitFor({ state: 'visible', timeout: popupWaitTimeout });
        await popupSelectButtonLocator.waitFor({ state: 'enabled', timeout: popupWaitTimeout });
        console.log(`${functionName} Found 'Select' button in popup.`);
        await page.screenshot({ path: `${screenshotBase}_04_popup_visible.png` });
        console.log(`${functionName} Clicking 'Select' button in popup...`);
        await popupSelectButtonLocator.click({ timeout: 5000 });
        console.log(`${functionName} Popup 'Select' button clicked.`);
        console.log(`${functionName} Waiting for Rate Info popup to close...`);
        await popupSelectButtonLocator.waitFor({ state: 'hidden', timeout: 10000 });
        console.log(`${functionName} Rate Info popup closed.`);
        await page.screenshot({ path: `${screenshotBase}_05_after_popup_select.png` });

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
                 console.error(`${functionName} Error finding row container. Refine 'rateRowLocator'.`);
             } else if (error.name === 'TimeoutError') {
                 if (error.message.includes('div.ltb-room-rate[tabindex="0"]')) {
                     console.error(`${functionName} Timeout waiting for the clickable rate element ('div.ltb-room-rate[tabindex="0"]'). Check visibility/enabled state.`);
                 } else if (error.message.includes("button', { name: 'Select' }")) {
                     console.error(`${functionName} Timeout waiting for the popup 'Select' button.`);
                 } else {
                     console.error(`${functionName} Generic timeout occurred during rate selection.`);
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