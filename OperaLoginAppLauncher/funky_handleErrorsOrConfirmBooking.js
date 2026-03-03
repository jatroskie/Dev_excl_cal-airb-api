// funky_handleErrorsOrConfirmBooking.js

const path = require('path'); // Required for consistent screenshot paths

/**
 * Checks for a booking confirmation message after attempting to book.
 * Waits for a specific confirmation text to appear within a timeout period.
 * If the text appears, it returns success. If it times out, it assumes failure.
 * Does NOT currently actively look for specific error messages, but could be enhanced to do so.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function handleErrorsOrConfirmBooking(page, downloadsPath) {
    const functionName = '[handleErrorsOrConfirmBooking]'; // Logging prefix
    console.log(`${functionName} Starting process: Checking for booking confirmation or errors...`);
    const screenshotBase = path.join(downloadsPath, 'confirm_booking'); // Base name for screenshots

    // --- Basic Input Validation ---
    if (!downloadsPath || typeof downloadsPath !== 'string') {
        const error = new Error('Invalid or missing downloadsPath provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }

    // --- Define Locator for Success Confirmation ---
    // Using getByText with a regex for case-insensitivity and potential surrounding whitespace.
    // Adjust the text 'Booking Confirmed' if the actual message differs.
    const confirmationLocator = page.locator('*:text-matches("Booking Confirmed", "i")');
    // Alternative: If the text is always inside a specific element, be more specific:
    // const confirmationLocator = page.locator('div.confirmation-panel:has-text("Booking Confirmed")');

    // --- Define Timeout ---
    // How long to wait for either confirmation or timeout
    const confirmationTimeout = 30000; // 30 seconds, adjust based on typical booking time

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before_check.png`, fullPage: true });

        // --- Wait for Confirmation Message ---
        console.log(`${functionName} Waiting up to ${confirmationTimeout / 1000} seconds for confirmation message...`);

        // locator.waitFor will throw a TimeoutError if the element doesn't become visible
        await confirmationLocator.waitFor({ state: 'visible', timeout: confirmationTimeout });

        // --- Success Case ---
        console.log(`${functionName} Success: Booking confirmation message found.`);
        await page.screenshot({ path: `${screenshotBase}_02_confirmed.png`, fullPage: true });

        // Indicate booking success
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred or confirmation timed out:`);

        // Default error assumption
        let finalError = error instanceof Error ? error : new Error(String(error));
        let isTimeout = false;

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            if (error.name === 'TimeoutError') {
                isTimeout = true;
                // Specific message for timeout
                const timeoutErrorMessage = `Booking confirmation message ('Booking Confirmed') not found within ${confirmationTimeout / 1000} seconds.`;
                console.error(`${functionName} ${timeoutErrorMessage}`);
                finalError = new Error(timeoutErrorMessage); // Use a more descriptive error
            }
            console.error(`Error Stack: ${error.stack}`); // Log stack for non-timeout errors too
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt to take a screenshot on error/timeout
        const errorScreenshotPath = isTimeout
            ? `${screenshotBase}_98_timeout_or_error.png`
            : `${screenshotBase}_99_error.png`;
        try {
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error/timeout screenshot:`, screenshotError);
        }

        // Return the standard failure object structure
        return { success: false, error: finalError };
    }
}

// Export the function for use in other modules
module.exports = { handleErrorsOrConfirmBooking };