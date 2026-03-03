const path = require('path');

async function enterTravelAgentDetails(page, travelAgent, downloadsPath) {
    if (!downloadsPath || typeof path === 'undefined' || !path || typeof path.join !== 'function') {
        console.error("Configuration error: downloadsPath or 'path' module missing.");
        return { error: new Error("Internal configuration error in enterTravelAgentDetails") };
    }

    try {
        // --- (Previous code: Fill input, trigger search) ---
        console.log(`Entering "${travelAgent}" as travel agent...`);
        const travelAgentInput = page.getByRole('textbox', { name: 'Travel Agent' }).nth(0);
        await travelAgentInput.fill(travelAgent);
        await page.waitForTimeout(1000);

        console.log('Triggering search for Travel Agent...');
        const searchIcon = page.locator('a[id*="oc_srclov_dummy_link"]').nth(0);
        if (await searchIcon.isVisible({ timeout: 5000 })) {
            await searchIcon.click();
        } else {
            await travelAgentInput.press('Enter');
        }
        await page.waitForTimeout(2000); // Short wait after triggering search

        // --- Revised Popup Detection and Interaction ---
        console.log(`Waiting for Profile Search popup dialog for "${travelAgent}"...`);
        // More robust locator for the dialog itself
        const dialogLocator = page.locator('div[role="dialog"]:visible:has(h1:has-text("Profile Search"), h1:has-text("Manage Profile"))');

        try {
            // 1. Wait for the dialog container to be visible
            await dialogLocator.waitFor({ state: 'visible', timeout: 20000 }); // Increased timeout
            console.log('Profile Search popup dialog detected.');
            await page.screenshot({ path: path.join(downloadsPath, 'profile_popup_detected.png') });

            // 2. Find and click the profile entry *within* the confirmed dialog
            const profileEntry = dialogLocator.locator(`div.oj-listview-cell-element:has-text("${travelAgent}")`).first();
            console.log(`Waiting for "${travelAgent}" entry within the dialog...`);
            await profileEntry.waitFor({ state: 'visible', timeout: 10000 });
            console.log(`"${travelAgent}" entry found, clicking it...`);
            await profileEntry.click();
            await page.waitForTimeout(1000); // Wait for selection highlight
            await page.screenshot({ path: path.join(downloadsPath, 'after_profile_click_in_dialog.png') });

            // 3. Wait for the Select button *within* the dialog to be ready
            const selectButton = dialogLocator.getByRole('button', { name: 'Select', exact: true });
            console.log('Waiting for the Select button within the dialog to be visible and enabled...');
            await selectButton.waitFor({ state: 'visible', timeout: 10000 });
            await selectButton.waitFor({ state: 'enabled', timeout: 5000 }); // Important: ensure it's clickable
            await page.waitForTimeout(3000); // Wait for dialog to close
            console.log('Clicking the Select button...');
            await selectButton.click();
            await page.waitForTimeout(3000); // Wait for dialog to close

            console.log('Clicked Select button in dialog.');
            await page.waitForTimeout(3000); // Wait for dialog to close
            await page.screenshot({ path: path.join(downloadsPath, 'after_profile_select_success.png') });
            console.log(`Successfully selected ${travelAgent}.`);
            return { success: true }; // SUCCESS

        } catch (popupError) {
            // This catch block handles timeouts or errors during the dialog interaction
            console.error(`Failed to interact with the Profile Search popup: ${popupError.message}`);
            await page.screenshot({ path: path.join(downloadsPath, 'profile_popup_interaction_ERROR.png') });
            // Return a specific error based on the failure
            if (popupError.message.includes('Timeout') && popupError.message.includes('dialogLocator')) {
                 return { error: new Error(`Profile Search popup dialog did not appear or become stable within the timeout for ${travelAgent}.`) };
            } else if (popupError.message.includes('Timeout') && popupError.message.includes('profileEntry')) {
                 return { error: new Error(`Profile entry for "${travelAgent}" not found within the dialog timeout.`) };
            } else if (popupError.message.includes('Timeout') && popupError.message.includes('selectButton')) {
                 return { error: new Error(`Select button within the dialog for "${travelAgent}" did not become ready within the timeout.`) };
            }
            // Generic error if the specific timeout isn't matched
            return { error: new Error(`An error occurred while processing the profile search popup for ${travelAgent}: ${popupError.message}`) };
        }
        // --- End Revised Popup Detection ---

    } catch (error) {
        // --- General Catch Block (remains the same) ---
        console.error(`Error occurred within enterTravelAgentDetails function.`);
        console.error(`Original Error: ${error.message}`);
        if (page && !page.isClosed() && downloadsPath && path) {
             try {
                 const errorScreenshotPath = path.join(downloadsPath, 'enter_travel_agent_GENERAL_ERROR.png');
                 await page.screenshot({ path: errorScreenshotPath });
                 console.log(`Error screenshot saved to: ${errorScreenshotPath}`);
             } catch (screenshotError) {
                 console.error(`Failed to take error screenshot: ${screenshotError.message}`);
             }
        } else {
            console.error("Cannot take error screenshot: Page closed, downloadsPath missing, or 'path' module missing.");
        }
        return { error: error };
        // --- End General Catch Block ---
    }
}

module.exports = { enterTravelAgentDetails };