const path = require('path');
//const { expect } = require('@playwright/test');

/**
 * Selects a room and rate, handling potential popups or direct table interactions.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function selectRoomAndRate(page, downloadsPath) {
    console.log('[selectRoomAndRate] Starting rate selection process...');
    const screenshotBase = path.join(downloadsPath, 'rate_selection');

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // --- Define Locators ---
        // Find the container SPAN that contains the "LONG TERM" text.
        const rateBlockContainer = page.locator('span:has(span:text-is("LONG TERM"))');

        // Within that container, find the specific clickable DIV.
        const clickableRateElement = rateBlockContainer.locator('div.ltb-room-rate[tabindex="0"]');

        // --- Wait for the element to be visible and clickable ---
        console.log('[selectRoomAndRate] Waiting for the rate container...');
        // Wait for the container first to ensure the general area is loaded
        
        await rateBlockContainer.waitFor({ state: 'visible', timeout: 10000 }); // Increased timeout for potentially slow UI
        console.log('[selectRoomAndRate] Waiting for the specific clickable rate element...');
        // Wait specifically for the clickable element
        
        await clickableRateElement.waitFor({ state: 'visible', timeout: 10000 });
        //await clickableRateElement.waitFor({ state: 'enabled', timeout: 5000 }); // Ensure it's not disabled (equivalent to toBeEnabled)

        console.log('[selectRoomAndRate] Clicking the rate element...');
        await page.screenshot({ path: `${screenshotBase}_02_before_click.png` });

        // Click the element - add timeout directly to click if needed for the action itself
        await clickableRateElement.click({ timeout: 5000 });

        console.log('[selectRoomAndRate] Rate element clicked successfully.');
        await page.screenshot({ path: `${screenshotBase}_03_after_click.png` });

        // Optional: Add a wait here for something that *should* appear *after* the click
        // e.g., await expect(page.locator('#next_step_button')).toBeVisible({ timeout: 10000 });

        return { success: true }; // Indicate success

    } catch (error) {
        console.error('[selectRoomAndRate] An error occurred during rate selection:');
        // Log the specific Playwright error message if available
        if (error instanceof Error) { // Check if it's an Error object
           console.error('Error Name:', error.name);
           console.error('Error Message:', error.message);
           console.error('Error Stack:', error.stack);
        } else {
           console.error('Caught non-error object:', error); // Log if something else was thrown
        }

        try {
            // Try to take a screenshot on error for debugging
            await page.screenshot({ path: `${screenshotBase}_99_error.png`, fullPage: true });
        } catch (screenshotError) {
            console.error('[selectRoomAndRate] Could not take error screenshot:', screenshotError);
        }

        // Ensure you always return the failure object structure
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

// Export the function
module.exports = { selectRoomAndRate };