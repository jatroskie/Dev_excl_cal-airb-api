// funky_clickBookNowButton.js

const path = require('path'); // Required for consistent screenshot paths

/**
 * Locates and clicks the primary 'Book Now' button on the page.
 * It waits for the button to be visible and enabled before clicking.
 * It does NOT wait for the consequences of the click (that should be handled
 * by the subsequent function, e.g., handleErrorsOrConfirmBooking).
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function clickBookNowButton(page, downloadsPath) {
    const functionName = '[clickBookNowButton]'; // Logging prefix
    console.log(`${functionName} Starting process...`);
    const screenshotBase = path.join(downloadsPath, 'click_book_now'); // Base name for screenshots

    // --- Basic Input Validation ---
    if (!downloadsPath || typeof downloadsPath !== 'string') {
        const error = new Error('Invalid or missing downloadsPath provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // --- Locate the Book Now Button ---
        // Using getByRole is generally good.
        // NOTE: Removed .first() initially. If multiple 'Book Now' buttons exist
        // and .first() is reliably the correct one, add it back. Otherwise,
        // try to find a more specific selector (e.g., inside a specific form/div).
        const bookNowButtonLocator = page.getByRole('button', { name: /Book Now/i }); // Use regex for case-insensitivity if needed

        // --- Wait for the Button and Click ---
        console.log(`${functionName} Waiting for the 'Book Now' button to be visible and enabled...`);
        const waitTimeout = 15000; // 15 seconds timeout, adjust based on UI speed
        await bookNowButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await bookNowButtonLocator.waitFor({ state: 'enabled', timeout: waitTimeout }); // Ensure it's clickable

        console.log(`${functionName} Clicking the 'Book Now' button...`);
        // Add click timeout if the click action itself takes long (uncommon)
        await bookNowButtonLocator.click({ timeout: 5000 });

        // REMOVED arbitrary waitForTimeout(5000).
        // Waiting for the *result* of the click (e.g., loading spinner, confirmation)
        // should happen in the *next* step/function.

        console.log(`${functionName} 'Book Now' button clicked successfully.`);
        await page.screenshot({ path: `${screenshotBase}_02_after_click.png`, fullPage: true });

        // Indicate success
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred while clicking the 'Book Now' button:`);
        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
             if (error.name === 'TimeoutError') {
                 console.error(`${functionName} Timeout occurred waiting for the 'Book Now' button to become visible/enabled.`);
            }
            console.error(`Error Stack: ${error.stack}`);
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt to take a screenshot on error
        try {
            await page.screenshot({ path: `${screenshotBase}_99_error.png`, fullPage: true });
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error screenshot:`, screenshotError);
        }

        // Return the standard failure object structure
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

// Export the function for use in other modules
module.exports = { clickBookNowButton };