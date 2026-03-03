const path = require('path');
const { expect } = require('@playwright/test'); // Use expect for better assertions/waits

// ==========================================================================
// == Function: selectRoomAndRate
// ==========================================================================

/**
 * Selects a room and rate, handling potential popups or direct table interactions.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function selectRoomAndRate(page, downloadsPath) {
    console.log('[selectRoomAndRate] Starting rate selection process...');

    try {
        await page.screenshot({ path: path.join(downloadsPath, '01_before_rate_selection.png'), fullPage: true });

        // --- Preferred CSS Selector ---
        // 1. Find the container SPAN that contains the "LONG TERM" text.
        //    (We target the outer span using a unique child - the price range display -
        //     as its own ID is dynamic)
        const rateBlockContainer = page.locator('span:has(span:text-is("LONG TERM"))'); // Adjust 'span' if a higher parent div is better

        // 2. Within that container, find the specific clickable DIV.
        //    We target the div with class 'ltb-room-rate' and tabindex='0'.
        timeout: 5000 // Adjust timeout as needed
        const clickableRateElement = rateBlockContainer.locator('div.ltb-room-rate[tabindex="0"]');

        await clickableRateElement.click();

        // --- Alternative using filter (if you find a repeating class on the rate block containers, e.g., '.rate-block') ---
        // const repeatingContainerClass = '.rate-block'; // Replace with actual class if found by inspecting higher up
        // await page.locator(repeatingContainerClass)
        //           .filter({ has: page.locator('span:text-is("LONG TERM")') })
        //           .locator('div.ltb-room-rate[tabindex="0"]')
        //           .click();
        return { success: true }; // Indicate success
        timeout: 5000 // Adjust timeout as needed

    } catch (error) {
        console.error('[selectRoomAndRate] An error occurred during rate selection:', error);
            return { success: false, error }; // Return error object
        }
    }
    
    // Export the function
    module.exports = { selectRoomAndRate };
       