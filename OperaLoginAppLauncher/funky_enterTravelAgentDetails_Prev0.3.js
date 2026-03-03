const path = require('path');

/**
 * Enters the Travel Agent details, triggers the search, waits for the "Select" button to be clickable,
 * and then clicks it using a more reliable locator based on the element's structure.
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
        // --- Fill Input and Trigger Search ---
        console.log('[enterTravelAgentDetails] Locating and filling travel agent input...');
        const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
        await travelAgentInput.fill(travelAgent);
        await page.waitForTimeout(4000); // Wait for the search results to load

        // --- Locate and Click the "Select" Button ---
        console.log('[enterTravelAgentDetails] Locating the "Select" button...');
        // Target the parent <a> element with class 'xr2' that contains the "Select" text
       // const selectButtonParent = page.locator('a.xr2:has(span.xri)', { hasText: 'Select' }); --- doesn't work
        const selectButton = page.locator('span.xri', { hasText: 'Select' });
        await selectButton.waitFor({ state: 'visible', timeout: 5000 });
        await selectButton.click();
        await page.waitForTimeout(2000);
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