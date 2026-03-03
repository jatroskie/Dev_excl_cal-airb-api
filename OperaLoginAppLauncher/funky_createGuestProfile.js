// funky_createGuestProfile.js

const path = require('path'); // Required for consistent screenshot paths

/**
 * Fills the guest profile details (First Name, Last Name, Phone) on the relevant screen.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} clientName - The guest's last name to enter.
 * @param {string} firstName - The guest's first name to enter.
 * @param {string} telephoneNumber - The guest's telephone number to enter.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function createGuestProfile(page, clientName, firstName, telephoneNumber, downloadsPath) {
    const functionName = '[createGuestProfile]'; // Logging prefix
    console.log(`${functionName} Starting process for ${firstName} ${clientName}...`);
    const screenshotBase = path.join(downloadsPath, 'create_guest_profile'); // Base name for screenshots

    // --- Basic Input Validation ---
    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
        const error = new Error('Invalid or missing clientName (Last Name) provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }
    if (!firstName || typeof firstName !== 'string' || firstName.trim() === '') {
        const error = new Error('Invalid or missing firstName provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error };
    }
    if (!telephoneNumber || typeof telephoneNumber !== 'string' || telephoneNumber.trim() === '') {
        // Consider if phone is optional - if so, log warning and return success, otherwise fail
        const error = new Error('Invalid or missing telephoneNumber provided.');
        console.error(`${functionName} ${error.message}`);
        return { success: false, error }; // Assuming phone is required here
    }
     if (!downloadsPath || typeof downloadsPath !== 'string') {
         const error = new Error('Invalid or missing downloadsPath provided.');
         console.error(`${functionName} ${error.message}`);
         // Cannot proceed without downloadsPath if screenshots are used
         return { success: false, error };
     }


    try {
        await page.screenshot({ path: `${screenshotBase}_01_before.png`, fullPage: true });

        // Define locators (using getByRole is good if accessible names are stable)
        const firstNameInputLocator = page.getByRole('textbox', { name: 'First Name' });
        const lastNameInputLocator = page.getByRole('textbox', { name: 'Last Name' });
        const phoneInputLocator = page.getByRole('textbox', { name: 'Phone' }); // Adjust 'Phone' if label is different

        const waitTimeout = 10000; // 10 seconds timeout for waits, adjust as needed

        // --- Fill First Name ---
        console.log(`${functionName} Waiting for 'First Name' input...`);
        await firstNameInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await firstNameInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        console.log(`${functionName} Filling 'First Name': ${firstName}`);
        await firstNameInputLocator.fill(firstName);
        await page.screenshot({ path: `${screenshotBase}_02_after_firstname.png`});

        // --- Fill Last Name ---
        console.log(`${functionName} Waiting for 'Last Name' input...`);
        await lastNameInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await lastNameInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        console.log(`${functionName} Filling 'Last Name': ${clientName}`);
        await lastNameInputLocator.fill(clientName);
         await page.screenshot({ path: `${screenshotBase}_03_after_lastname.png`});

        // --- Fill Phone ---
        console.log(`${functionName} Waiting for 'Phone' input...`);
        await phoneInputLocator.waitFor({ state: 'visible', timeout: waitTimeout });
        //await phoneInputLocator.waitFor({ state: 'enabled', timeout: waitTimeout });
        console.log(`${functionName} Filling 'Phone': ${telephoneNumber}`);
        await phoneInputLocator.fill(telephoneNumber);
         await page.screenshot({ path: `${screenshotBase}_04_after_phone.png`});

        // REMOVED arbitrary waitForTimeout - rely on waits for subsequent actions if needed

        console.log(`${functionName} Guest profile fields filled successfully.`);

        // Indicate success
        return { success: true };

    } catch (error) {
        // --- Error Handling ---
        console.error(`${functionName} An error occurred while filling guest profile:`);
        if (error instanceof Error) {
            console.error(`Error Name: ${error.name}`);
            console.error(`Error Message: ${error.message}`);
             if (error.name === 'TimeoutError') {
                 console.error(`${functionName} Timeout occurred waiting for one of the profile input fields.`);
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
module.exports = { createGuestProfile };