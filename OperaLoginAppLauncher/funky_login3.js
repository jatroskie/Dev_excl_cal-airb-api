// login3.js - Renamed to avoid conflict if login2.js is still used elsewhere

require('dotenv').config(); // Load environment variables from .env file
const { chromium } = require('playwright');
const path = require('path');

/**
 * Launches a browser, logs into Opera Cloud using credentials from .env file,
 * handles potential redirects, and returns the browser, context, and the final page object.
 *
 * @returns {Promise<{success: boolean, browser?: import('playwright').Browser, context?: import('playwright').BrowserContext, page?: import('playwright').Page, error?: Error}>}
 *          Result object indicating success or failure, including browser objects for cleanup.
 */
async function loginToOperaCloud() {
    const functionName = '[loginToOperaCloud]'; // Logging prefix
    let browser = null;
    let context = null;
    let page = null;
    // Define downloadsPath - ensure this directory exists or is created by the caller
    const downloadsPath = path.join(__dirname, 'downloads');

    try {
        console.log(`${functionName} Starting login process...`);

        // --- Browser Launch and Context Creation ---
        console.log(`${functionName} Launching browser...`);
        browser = await chromium.launch({
            headless: process.env.HEADLESS === 'true' || false, // Allow controlling headless via .env
            // args: ['--disable-web-security', '--disable-features=IsolateOrigins'], // Use with caution, might not be needed
            downloadsPath: downloadsPath // Set download path for browser instance
        });

        console.log(`${functionName} Creating browser context...`);
        context = await browser.newContext({
            acceptDownloads: true, // Enable download handling
            viewport: { width: 1366, height: 768 }, // Slightly larger viewport
            // ignoreHTTPSErrors: true // Use only if necessary for specific environments
        });

        console.log(`${functionName} Creating new page...`);
        page = await context.newPage();
        const screenshotBase = path.join(downloadsPath, 'login_process'); // Base for screenshots

        await page.screenshot({ path: `${screenshotBase}_01_start.png`, fullPage: true });

        // --- Step 1: Navigate to Login Page ---
        console.log(`${functionName} Navigating to login page...`);
        const loginUrl = process.env.OPERA_LOGIN_URL || 'https://mtce4.oracleindustry.com/OPERA9/opera/operacloud/'; // Use env var if available
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log(`${functionName} Login page loaded. URL: ${page.url()}`);
        await page.screenshot({ path: `${screenshotBase}_02_login_page.png` });

        // --- Step 2: Check Credentials ---
        console.log(`${functionName} Checking credentials from .env file...`);
        const username = process.env.OPERA_USERNAME;
        const password = process.env.OPERA_PASSWORD;
        if (!username || !password) {
            throw new Error('OPERA_USERNAME or OPERA_PASSWORD not set in .env file');
        }
        console.log(`${functionName} Credentials found.`);

        // --- Step 3: Fill Credentials ---
        console.log(`${functionName} Filling credentials...`);
        const usernameInputLocator = page.getByRole('textbox', { name: 'User Name' });
        const passwordInputLocator = page.getByRole('textbox', { name: 'Password' });
        const waitTimeout = 30000; // Standard wait timeout

        await usernameInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        // await usernameInputLocator.click(); // Click often not needed before fill
        await usernameInputLocator.fill(username);

        await passwordInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        // await passwordInputLocator.click();
        await passwordInputLocator.fill(password);
        console.log(`${functionName} Credentials filled.`);
        await page.screenshot({ path: `${screenshotBase}_03_credentials_filled.png` });

        // --- Step 4: Click Sign In ---
        console.log(`${functionName} Clicking 'Sign In'...`);
        const signInButtonLocator = page.getByRole('button', { name: 'Sign In' });
        await signInButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await signInButtonLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        await signInButtonLocator.click();
        console.log(`${functionName} 'Sign In' button clicked.`);

        // --- Step 5: Handle Intermediate Redirect / Button Click ---
        // Wait for potential navigation or the appearance of the next button
        console.log(`${functionName} Waiting for potential redirect or 'Click to go to OPERA Cloud' button...`);
        const operaCloudButtonText = /Click to go to OPERA Cloud/i; // Case-insensitive regex
        const operaCloudButtonLocator = page.locator('button, a', { hasText: operaCloudButtonText }).first(); // Try simple locator first
        const finalAppUrlPart = '/opera/operacloud/'; // Expect URL to contain this after successful login/redirect

        try {
            // Wait up to 60 seconds for EITHER the button to appear OR the URL to change to the final app URL
            await Promise.race([
                operaCloudButtonLocator.waitFor({ state: 'visible', timeout: 60000 }),
                page.waitForURL(`**${finalAppUrlPart}**`, { timeout: 60000 }) // Wait for final URL pattern
            ]);

            // Check if the button became visible (meaning we need to click it)
            if (await operaCloudButtonLocator.isVisible()) {
                console.log(`${functionName} Found 'Click to go to OPERA Cloud' button.`);
                await page.screenshot({ path: `${screenshotBase}_04_intermediate_button.png` });
                console.log(`${functionName} Clicking the button...`);
                await operaCloudButtonLocator.waitFor({ state: 'visible', timeout: waitTimeout });
                await operaCloudButtonLocator.click();
                console.log(`${functionName} Intermediate button clicked. Waiting for final navigation...`);
                // Wait specifically for the final URL after the click
                await page.waitForURL(`**${finalAppUrlPart}**`, { timeout: 60000 });
            } else {
                // If the button didn't appear but the URL changed, we're already there
                console.log(`${functionName} Navigated directly to final application URL.`);
            }

        } catch (intermediateError) {
             // If neither the button appeared nor the URL changed within the timeout
             console.error(`${functionName} Failed to find intermediate button OR navigate to final URL within timeout.`);
             await page.screenshot({ path: `${screenshotBase}_04_intermediate_fail.png` });
             throw new Error(`Login sequence failed: Timeout waiting for intermediate button or final URL. Last URL: ${page.url()}. Error: ${intermediateError.message}`);
        }


        // --- Step 6: Verify Final State ---
        console.log(`${functionName} Verifying final application state...`);
        const finalUrl = page.url();
        console.log(`${functionName} Final page URL: ${finalUrl}`);
        if (!finalUrl.includes(finalAppUrlPart)) {
            throw new Error(`Login sequence failed: Final URL (${finalUrl}) does not match expected pattern (${finalAppUrlPart}).`);
        }

        // Optional: Wait for a known element on the dashboard to confirm full load
        // Example: await page.locator('#dashboard-main-element').waitFor({ state: 'visible', timeout: 30000 });

        console.log(`${functionName} Login process completed successfully!`);
        await page.screenshot({ path: `${screenshotBase}_05_final_dashboard.png`, fullPage: true });

        // Return success object including browser, context, and page
        return { success: true, browser, context, page };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred during the login process:`);
        let finalError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
            // Don't log stack here usually, let the caller handle it if needed
        } else {
            console.error(`${functionName} Caught a non-error object:`, error);
        }

        // Attempt error screenshot(s)
        try {
            if (page && !page.isClosed()) {
                const errorScreenshotPath = path.join(downloadsPath, 'login_ERROR_screenshot.png');
                await page.screenshot({ path: errorScreenshotPath, fullPage: true });
                console.log(`${functionName} Error screenshot saved to: ${errorScreenshotPath}`);
            }
            // Optionally screenshot all pages in context if debugging complex scenarios
            // const pages = context?.pages() || [];
            // for (let i = 0; i < pages.length; i++) { ... }
        } catch (screenshotError) {
            console.error(`${functionName} Could not take error screenshot:`, screenshotError);
        }

        // Return failure object, including browser/context/page for cleanup by the caller
        return { success: false, error: finalError, browser, context, page };
    }
    // NOTE: No finally block here. Cleanup should happen in the *calling* function (`createBooking`).
}

// Remove the direct execution block (main function and the check)
// The calling script (funky_CreateBooking.js) will execute this function.

console.log("login3.js loaded as a module."); // Log when imported

// Export the function
module.exports = { loginToOperaCloud };