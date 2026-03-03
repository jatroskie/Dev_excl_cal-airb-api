// funky_setDiscountsOrPaymentMeth.js

const path = require('path'); // Required for consistent screenshot paths

/**
 * Sets the discount code if the corresponding input field is found and enabled.
 * Assumes other payment method steps might be handled elsewhere or are not needed here.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} discountCode - The discount code to enter.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function setDiscountsOrPaymentMethods(page, discountCode, downloadsPath) {
    const functionName = '[setDiscountsOrPaymentMethods]'; // Logging prefix
    console.log(`${functionName} Starting process... Attempting to set discount code: ${discountCode}`);
    const screenshotBase = path.join(downloadsPath, 'set_discount'); // Base name for screenshots

    // Validate discountCode input minimally
    if (typeof discountCode !== 'string' || discountCode.trim() === '') {
        console.warn(`${functionName} Invalid or empty discountCode provided: "${discountCode}". Skipping discount entry.`);
        // Decide if this is success (skipped) or failure (required but invalid)
        // Let's treat empty/invalid code as success (nothing to do), but log a warning.
        // If a code *must* always be valid, you could return { success: false, error: new Error(...) } here.
        return { success: true };
    }

    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // --- Locate the Discount Code Input ---
        // Using getByRole is good, assuming the accessible name is stable.
        const discountInputLocator = page.getByRole('textbox', { name: 'Discount Code' });

        // --- Wait for the Input and Fill it ---
        console.log(`${functionName} Waiting for the 'Discount Code' input field to be visible and enabled...`);

        // Wait for the element to exist and be interactable
        // Using waitFor is more explicit for scripts than using expect from @playwright/test
        const waitTimeout = 10000; // 10 seconds timeout, adjust as needed
        await discountInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await discountInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout }); // Ensure it's not disabled

        console.log(`${functionName} Filling discount code input with: ${discountCode}`);
        await discountInputLocator.fill(discountCode);

        // Optional: Add a small delay or wait for feedback if the UI reacts after filling
        // await page.waitForTimeout(500); // Example: Small pause if needed

        console.log(`${functionName} Successfully set discount code to ${discountCode}`);
        await page.screenshot({ path: `${screenshotBase}_02_after_fill.png`, fullPage: true });

        // Indicate success
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred:`);
        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            // Check if it's a TimeoutError for more specific logging
            if (error.name === 'TimeoutError') {
                 console.error(`${functionName} Timeout occurred waiting for the 'Discount Code' input field.`);
            }
             console.error(`Error Stack: ${error.stack}`); // Full stack for debugging
        } else {
            // Log if something unexpected was thrown
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
module.exports = { setDiscountsOrPaymentMethods };