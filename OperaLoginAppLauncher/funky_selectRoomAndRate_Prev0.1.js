const path = require('path');

/**
 * Selects a room and rate by searching for rates and interacting with a popup or rate table.
 *
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} downloadsPath - The path to the directory for saving screenshots.
 * @returns {Promise<{success?: boolean, error?: Error}>} - Object indicating success or containing an error.
 */
async function selectRoomAndRate(page, downloadsPath) {
    console.log('Starting improved rate selection process...');

    // Helper function to take screenshots with error handling
    const takeScreenshot = async (filename) => {
        try {
            await page.screenshot({ path: path.join(downloadsPath, filename) });
        } catch (error) {
            console.error(`Failed to take screenshot ${filename}: ${error.message}`);
        }
    };

    await takeScreenshot('before_rate_selection.png');

    try {
        // Step 1: Search for rates
        c
        // Step 2: Check if there's a popup/dialog present for rate selection
        console.log('Checking for rate selection popup/dialog...');
        let rateSelected = false;

        // Look for common dialog container elements
        const dialogSelectors = [
            page.locator('div[role="dialog"]'),
            page.locator('div.p_AFDialog'),
            page.locator('div.AFModalGlassPane').filter({ has: page.locator('div[role="dialog"]') })
        ];

        let dialog = null;
        for (const selector of dialogSelectors) {
            if (await selector.isVisible({ timeout: 3000 })) {
                dialog = selector;
                console.log('Found dialog/popup container');
                break;
            }
        }

        // If a dialog is found, try to interact with elements inside it
        if (dialog) {
            console.log('Working with rate selection inside popup dialog...');
            await dialog.scrollIntoViewIfNeeded(); // Ensure the popup is in view
            await takeScreenshot('rate_popup_dialog.png');

            // Try to find a rate row in the popup using generic selectors
            const rateRows = [
                dialog.locator('tr[_afrrk]').first(),
                dialog.locator('tr').filter({ has: dialog.locator('td:has-text("RACK")') }).first(),
                dialog.locator('tr:has-text("Select")').first(),
                dialog.locator('table[_afrrk] tr').first()
            ];

            for (const row of rateRows) {
                if (await row.isVisible({ timeout: 5000 })) {
                    console.log('Found rate row in popup, clicking...');
                    await row.click();
                    console.log('Successfully clicked rate row in popup');
                    rateSelected = true;
                    break;
                }
            }
        }

        // Step 3: Fallback if no dialog is found or rate not selected in dialog
        if (!dialog || !rateSelected) {
            console.log('No dialog found or rate not selected in dialog, trying to select rate on main page...');
            const mainPageRateRows = [
                page.locator('tr[_afrrk]').first(),
                page.locator('tr').filter({ has: page.locator('td:has-text("RACK")') }).first(),
                page.locator('tr:has-text("Select")').first(),
                page.locator('table[_afrrk] tr').first()
            ];

            for (const row of mainPageRateRows) {
                if (await row.isVisible({ timeout: 5000 })) {
                    console.log('Found rate row on main page, clicking...');
                    await row.scrollIntoViewIfNeeded();
                    await row.click();
                    console.log('Successfully clicked rate row on main page');
                    rateSelected = true;
                    break;
                }
            }
        }

        // Step 4: Verify if a rate was selected
        if (!rateSelected) {
            throw new Error('Failed to select a rate: No rate row found in popup or on main page');
        }

        await takeScreenshot('after_rate_selection.png');
        return { success: true };

    } catch (error) {
        console.error(`[selectRoomAndRate] An unexpected error occurred: ${error.message}`);
        await takeScreenshot('rate_selection_error.png');
        return { error: error };
    }
}

// Export the function
module.exports = { selectRoomAndRate };