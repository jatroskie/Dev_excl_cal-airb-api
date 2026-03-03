// funky_navigateToBookingScreen.js
const path = require('path');

async function navigateToBookingScreen(page, downloadsPath) {
  console.log('Navigating to Look To Book Sales Screen...');

  if (!downloadsPath) {
    throw new Error('downloadsPath parameter is required for saving screenshots');
  }

  try {
    // Take a screenshot of the main interface for debugging
    await page.screenshot({ path: path.join(downloadsPath, 'main_interface.png') });

    // Step 1: Click "Bookings" link
    console.log('Locating Bookings link...');
    const bookingsLink = page.getByRole('link', { name: 'Bookings' }).nth(0);
    await bookingsLink.waitFor({ state: 'visible', timeout: 30000 });
    await bookingsLink.click();
    console.log('Clicked Bookings');
    await page.waitForTimeout(2000);

    // Step 2: Click "Reservations"
    console.log('Locating Reservations menu item...');
    const reservationsItem = page.getByText('Reservations', { exact: true }).nth(0);
    // Removed dynamic wait for Reservations to avoid click errors
    await page.waitForTimeout(2000);
    await reservationsItem.click();
    console.log('Clicked Reservations');
    await page.waitForTimeout(2000);

    // Step 3: Click "Look To Book Sales Screen"
    console.log('Locating Look To Book Sales Screen menu item...');
    const lookToBookItem = page.getByText('Look To Book Sales Screen').nth(0);
    // Removed dynamic wait for Look To Book Sales Screen to avoid click errors
    await page.waitForTimeout(2000);
    await lookToBookItem.click();
    console.log('Clicked Look To Book Sales Screen');
    await page.waitForTimeout(5000);

    // Step 4: Validate navigation by checking for the heading
    const pageHeading = page.locator('h1:text-is("Look To Book Sales Screen")');
    await pageHeading.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Confirmed: Look To Book Sales Screen heading is visible');

    // Take a screenshot after successful navigation
    await page.screenshot({ path: path.join(downloadsPath, 'look_to_book_screen.png') });
    console.log('Successfully navigated to Look To Book Sales Screen');
    return { success: true }; 

    } catch (error) {
      console.error('Error during navigation to Look To Book Sales Screen:', error.message);
      await page.screenshot({ path: path.join(downloadsPath, `navigation_error_${Date.now()}.png`) }).catch(e => {
      console.error('Failed to take screenshot on error:', e.message);
      return { error: error };
    });
    throw error; // Re-throw the error to be handled by the caller
  }
}

module.exports = { navigateToBookingScreen };
