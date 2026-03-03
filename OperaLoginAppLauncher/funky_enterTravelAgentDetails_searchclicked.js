const path = require('path');

/**
 * Enters the Travel Agent details, triggers the search using JavaScript, waits for the popup,
 * and then clicks the "Select" button in the popup using JavaScript.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} travelAgent - The name of the travel agent (e.g., "AirBnB").
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success?: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function enterTravelAgentDetails(page, travelAgent, downloadsPath) {
    // --- Initial Setup and Validation ---
    if (!downloadsPath || typeof path === 'undefined' || !path || typeof path.join !== 'function') {
        console.error("[Configuration Error] Required parameters missing.");
        return { error: new Error("Internal configuration error in enterTravelAgentDetails") };
    }
    console.log(`[enterTravelAgentDetails] Starting for Travel Agent: "${travelAgent}"`);
    // --- End Initial Setup ---

    try {
        // --- Fill Input ---
        console.log('[enterTravelAgentDetails] Locating and filling travel agent input...');
        const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
        await travelAgentInput.fill(travelAgent);
        await page.waitForTimeout(2000); // Brief wait to ensure the input is filled

        // --- Click the "Search" Button Using JavaScript ---
        console.log('[enterTravelAgentDetails] Clicking the "Search" button using JavaScript...');
        const searchButtonLocator = page.getByRole('button', { name: 'Search' }).nth(0);
        await searchButtonLocator.waitFor({ state: 'visible', timeout: 5000 });

        // Resolve the locator to an ElementHandle
        const searchButton = await searchButtonLocator.elementHandle();
        if (!searchButton) {
            throw new Error('Search button element not found');
        }

        // Use JavaScript to click the "Search" button
        await page.evaluate((el) => {
            el.click();
        }, searchButton);
        console.log('[enterTravelAgentDetails] "Search" button clicked successfully.');

        // --- Wait for the Popup and Click the "Select" Button Using JavaScript ---
        console.log('[enterTravelAgentDetails] Waiting for the popup and locating the "Select" button...');
        // Wait for the popup to appear by checking for the "Select" button
        const selectButtonLocator = page.locator('a.xr2:has(span.xri)', { hasText: 'Select' });
        await selectButtonLocator.waitFor({ state: 'visible', timeout: 10000 });

        // Resolve the locator to an ElementHandle
        const selectButtonParent = await selectButtonLocator.elementHandle();
        if (!selectButtonParent) {
            throw new Error('Select button element not found');
        }

        // Use JavaScript to click the "Select" button's parent <a> element
        await page.evaluate((el) => {
            el.click();
        }, selectButtonParent);
        console.log('[enterTravelAgentDetails] "Select" button clicked successfully.');

        // Add a brief pause to allow the UI to react after clicking
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(downloadsPath, 'after_select_button_click.png') });

        return { success: true }; // Indicate success

    } catch (error) {
        // --- General Catch Block ---
        console.error(`[enterTravelAgentDetails] An unexpected error occurred: ${error.message}`);
        await page.screenshot({ path: path.join(downloadsPath, 'enter_travel_agent_general_ERROR.png') });
        return { error: error };
        // --- End General Catch Block ---
    }
}

// --- Export the function ---
module.exports = { enterTravelAgentDetails };
// --- End Export ---