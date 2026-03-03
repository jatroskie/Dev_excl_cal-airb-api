// funky_selectRoomAndRate.js

const path = require('path');

/**
 * Selects the first available rate (leftmost column) specifically from the 'LONG TERM' rate row.
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

        // --- Define Locators ---

        // 1. Locate the specific row container for "LONG TERM".
        //    We find the span with "LONG TERM" text and then select its direct parent container.
        //    ASSUMPTION: The immediate parent div/tr represents the row. Inspect if this needs adjustment (e.g., ancestor::div[2]).
        console.log(`${functionName} Locating the 'LONG TERM' rate row container...`);
        // Option A (If it's a DIV container - more common in modern UIs):
        const rateRowLocator = page.locator(`xpath=//span[normalize-space(.)='LONG TERM']/ancestor::div[1]`);
        // Option B (If it's a TR container - traditional tables):
        // const rateRowLocator = page.locator(`xpath=//span[normalize-space(.)='LONG TERM']/ancestor::tr[1]`);
        // Option C (If the row has a specific repeating class e.g., 'rate-row'):
        // const rateRowLocator = page.locator('div.rate-row') // Replace with actual class
        //                          .filter({ hasText: 'LONG TERM' });

        // Verify the row locator finds exactly one element
        const rowCount = await rateRowLocator.count();
        console.log(`${functionName} Found ${rowCount} row container(s) for 'LONG TERM'.`);
        if (rowCount !== 1) {
            throw new Error(`Expected to find exactly 1 row container for 'LONG TERM', but found ${rowCount}. Locator needs refinement.`);
        }

        // 2. Within that specific row container, find the FIRST clickable rate element.
        //    This corresponds to the leftmost rate ("1,600.00 STU-URB").
        //    We assume the clickable element is 'div.ltb-room-rate[tabindex="0"]'. Adjust if needed.
        console.log(`${functionName} Locating the first clickable rate element within the 'LONG TERM' row...`);
        const clickableRateElement = rateRowLocator.locator('div.ltb-room-rate[tabindex="0"]').first();

        // --- Wait for the element to be visible and clickable ---
        console.log(`${functionName} Waiting for the 'LONG TERM' rate row container to be visible...`);
        await rateRowLocator.waitFor({ state: 'visible', timeout: 15000 }); // Wait for the row first

        console.log(`${functionName} Waiting for the first clickable rate element (e.g., STU-URB) in the row...`);
        await clickableRateElement.waitFor({ state: 'visible', timeout: 10000 });
        await clickableRateElement.waitFor({ state: 'enabled', timeout: 10000 }); // Ensure it's interactable

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
            // Check if it's the specific row count error we added
            if (error.message.includes("Expected to find exactly 1 row container")) {
                 console.error(`${functionName} Refine the 'rateRowLocator' to be more specific.`);
            } else if (error.name === 'TimeoutError') {
                console.error(`${functionName} Timeout occurred waiting for the rate row or the clickable element.`);
                finalError = new Error(`Timeout waiting during rate selection: ${error.message}`);
            }
            console.error(`Error Stack: ${error.stack}`);
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt error screenshot
        const errorScreenshotPath = `${screenshotBase}_99_error.png`;
        try {
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            console.log(`${functionName} Error screenshot saved to: ${errorScreenshotPath}`);
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error screenshot:`, screenshotError);
        }

        // Return failure object
        return { success: false, error: finalError };
    }
}

// Export the function
module.exports = { selectRoomAndRate };