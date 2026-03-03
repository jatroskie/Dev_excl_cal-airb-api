const path = require('path');

/**
 * Enters the Travel Agent details, triggers the search, waits for a potential popup,
 * and attempts to select the result using keyboard navigation (Tab x14 + Enter).
 * NOTE: This function uses brittle keyboard navigation which is highly discouraged.
 * It should ideally be replaced with direct locators targeting elements within the search results popup.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} travelAgent - The name of the travel agent (e.g., "AirBnB").
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function enterTravelAgentDetails(page, travelAgent, downloadsPath) {
    const functionName = '[enterTravelAgentDetails]'; // Logging prefix
    console.log(`${functionName} Starting process for Travel Agent: "${travelAgent}"`);
    const screenshotBase = path.join(downloadsPath, 'enter_travel_agent'); // Base name for screenshots

    // --- Input Validation ---
    if (!travelAgent || typeof travelAgent !== 'string' || travelAgent.trim() === '') {
        const error = new Error('Invalid or missing travelAgent name provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }
    if (!downloadsPath || typeof downloadsPath !== 'string') {
        const error = new Error('Invalid or missing downloadsPath provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }

    try {
        await page.screenshot({ path: `${screenshotBase}_01_start.png`, fullPage: true });

        // --- Locate and Fill Input ---
        console.log(`${functionName} Locating 'Travel Agent' input...`);
        // Using .first() can be brittle; prefer more specific selectors if possible
        const travelAgentInputLocator = page.getByRole('textbox', { name: 'Travel Agent' }).first(); // or .nth(0)
        const waitTimeout = 10000; // Adjust as needed

        await travelAgentInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await travelAgentInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        console.log(`${functionName} Filling travel agent input with: "${travelAgent}"`);
        await travelAgentInputLocator.fill(travelAgent);
        await page.screenshot({ path: `${screenshotBase}_02_after_fill.png` });
        // Removed arbitrary wait after fill

        // --- Locate and Click Search Button ---
        console.log(`${functionName} Locating 'Search' button...`);
        // Using .first() can be brittle
        const searchButtonLocator = page.getByRole('button', { name: 'Search' }).first(); // or .nth(0)
        await searchButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await searchButtonLocator.waitFor({ state: 'enabled', timeout: waitTimeout });

        console.log(`${functionName} Clicking 'Search' button...`);
        // Direct click is usually preferred over evaluate unless necessary
        await searchButtonLocator.click();
        // await page.evaluate((el) => { el.click(); }, await searchButtonLocator.elementHandle()); // Alternative if direct click fails

        console.log(`${functionName} 'Search' button clicked.`);
        await page.screenshot({ path: `${screenshotBase}_03_after_search_click.png` });

        // --- Wait for Popup and Select Result (BRITTLE KEYBOARD NAVIGATION) ---
        console.log(`${functionName} Waiting for search results popup/panel to appear...`);

        // **RECOMMENDATION:** Replace keyboard navigation below with direct locators.
        // 1. Identify a reliable locator for the popup container itself.
        // 2. Identify a reliable locator for the specific result row or item corresponding to the search.
        // 3. Identify a reliable locator for the "Select" button *within that row/popup*.
        // Example (NEEDS ACTUAL LOCATORS FROM INSPECTION):
        // const popupContainer = page.locator('div.search-results-popup'); // Find the popup
        // await popupContainer.waitFor({ state: 'visible', timeout: 30000 });
        // const searchResultItem = popupContainer.locator(`div.result-item:has-text("${travelAgent}")`); // Find the specific result
        // await searchResultItem.waitFor({ state: 'visible', timeout: 10000 });
        // const selectButton = searchResultItem.getByRole('button', { name: 'Select' }); // Find the select button for that result
        // await selectButton.waitFor({ state: 'enabled', timeout: 5000 });
        // await selectButton.click(); // Click it directly!

        // --- Current Brittle Keyboard Navigation ---
        console.warn(`${functionName} Using BRITTLE keyboard navigation (Tab x14 + Enter). This is likely to break and should be replaced with direct locators.`);
        await page.waitForTimeout(4000); // Arbitrary wait for popup - VERY UNRELIABLE

        console.log(`${functionName} Executing keyboard navigation (Tab x14)...`);
        for (let i = 0; i < 14; i++) {
            await page.keyboard.press('Tab');
            // Short delay between tabs might be needed for some UIs, but adds to fragility/slowness
            await page.waitForTimeout(200); // Small delay between presses
            process.stdout.write(` Tab ${i + 1}..`); // Log progress
        }
        process.stdout.write('\n'); // Newline after Tab logs

        console.log(`${functionName} Pressing Enter to activate selection...`);
        await page.keyboard.press('Enter');
        console.log(`${functionName} 'Select' presumably activated via Enter key.`);
        // Removed arbitrary wait after Enter

        await page.screenshot({ path: `${screenshotBase}_04_after_keyboard_select.png` });
        // --- End Brittle Keyboard Navigation ---


        // --- Success ---
        console.log(`${functionName} Travel agent details entered and selection attempted successfully.`);
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred:`);
        let finalError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            if (error.name === 'TimeoutError') {
                console.error(`${functionName} Timeout occurred waiting for an element (input, search button, or potentially during implicit waits).`);
                finalError = new Error(`Timeout waiting for element during travel agent entry: ${error.message}`);
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
module.exports = { enterTravelAgentDetails };