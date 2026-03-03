import { test, expect } from '@playwright/test';

// Sorted room numbers in ascending order with types, duplicates removed (48 rooms)
const rooms = [
  { number: '0302', type: 'STU-BALC' },
  { number: '0303', type: 'STU-BALC' },
  { number: '0304', type: 'STU-URB' },
  { number: '0305', type: 'STU-URB' },
  { number: '0306', type: 'STU-URB' },
  { number: '0307', type: 'STU-URB' },
  { number: '0308', type: 'STU-URB' },
  { number: '0309', type: 'STU-URB' },
  { number: '0311', type: 'STU-URB' },
  { number: '0312', type: 'STU-URB' },
  { number: '0313', type: 'STU-URB' },
  { number: '0314', type: 'STU-URB' },
  { number: '0315', type: '1-BR' },
  { number: '0317', type: '1-BR' },
  { number: '0318', type: 'STU-URB' },
  { number: '0319', type: 'STU-URB' },
  { number: '0320', type: 'STU-URB' },
  { number: '0321', type: 'STU-URB' },
  { number: '0323', type: 'STU-URB' },
  { number: '0400', type: 'STU-BALC' },
  { number: '0401', type: 'STU-BALC' },
  { number: '0402', type: 'STU-BALC' },
  { number: '0403', type: 'STU-URB' },
  { number: '0404', type: 'STU-URB' },
  { number: '0405', type: 'STU-URB' },
  { number: '0406', type: 'STU-URB' },
  { number: '0407', type: 'STU-URB' },
  { number: '0408', type: 'STU-URB' },
  { number: '0409', type: 'STU-URB' },
  { number: '0411', type: 'STU-URB' },
  { number: '0412', type: 'STU-URB' },
  { number: '0413', type: '1-BR' },
  { number: '0415', type: '1-BR' },
  { number: '0416', type: 'STU-URB' },
  { number: '0417', type: 'STU-URB' },
  { number: '0418', type: 'STU-URB' },
  { number: '0419', type: 'STU-URB' },
  { number: '0420', type: 'STU-URB' },
  { number: '0501', type: 'STU-BALC' },
  { number: '0502', type: 'STU-BALC' },
  { number: '0503', type: 'STU-BALC' },
  { number: '0504', type: 'STU-LUX' },
  { number: '0506', type: 'STU-LUX' },
  { number: '0507', type: 'STU-LUX' },
  { number: '0508', type: 'STU-LUX' },
  { number: '0509', type: 'STU-LUX' },
  { number: '0511', type: 'STU-LUX' },
  { number: '0513', type: '2-BR' },
  { number: '0514', type: 'STU-BALC' },
  { number: '0515', type: '2-BR' },
  { number: '0516', type: 'STU-LUX' },
  { number: '0517', type: 'STU-LUX' },
  { number: '0518', type: 'STU-LUX' },
  { number: '0519', type: 'STU-LUX' },
  { number: '0520', type: 'STU-LUX' },
];

test.use({
  viewport: { width: 1920, height: 1080 },
  launchOptions: { headless: false, slowMo: 100 },
  timeout: 900000, // 15 minutes to allow processing all 48 rooms
});

test.describe('Check All Rooms for March 7, 2025', () => {
  test('check room diary for all rooms', async ({ page, context }) => {
    // Login page
    await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3D519oUrl6K8dNK3HF8o1Rk5PyOn6rJ8KFymFP8VrzHV%2FFes1prqKJ1ZmoYBpgjiPv8V4uHO36V%2B0WwYwDoQ9J6f3n1cGhNjMQGgojOYBrukM9tQiLVbsxWBfHCAqgkUVoJMKZP%2BFbhIinDLHNAVRGFK93Ly3mai5IRGXS%2Bs2ukzauLfF3JeQMVJStU6up4g2G1Mz6RfepVgWdo3dxn4zZ9FrX9S%2FWvMpvhOLTw%2Ba4EW3Mr5FD4crpisaSDL1SyjFX8b8xvkUkWAypNnmavR%2BkuA5k5PGIRFGs4wfCHKc2n%2BavqriFArUEkvDSkRUk63lRxIJDppyqnhYPPbZqA9sa9ltBep90yZIxh%2F3cYDB2cgrV2jG%2B6iROi3qIwrFPb%2F6s%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D37d2a56f61644ea77e0f2fb7217bfa6f33501f14&ECID-Context=1.006BsbM%5EEZD03zOUuislkH00025f0001tN%3BkXjE', { waitUntil: 'networkidle' });

    // Login
    await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
    await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Handle popup and switch back to main page
    console.log('Opening popup...');
    const page1Promise = context.waitForEvent('page', { timeout: 60000 });
    await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
    const page1 = await page1Promise;
    console.log('Popup opened. URL:', page1.url());
    
    // Wait for popup to close and main page to update
    await page1.waitForEvent('close', { timeout: 60000 });
    console.log('Popup closed. Continuing on main page...');
    await page.waitForURL(/opera-cloud-index/, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // 5-second delay after login, as requested
    console.log('Main page fully loaded, ready for navigation...');
    const initialUrl = page.url();

    // Navigate to Reservations > Manage Reservation with retry and simplified dropdown handling (2 attempts)
    let attempts = 0;
    const maxAttempts = 2; // Reduced to 2 attempts, as requested
    let manageReservationReached = false;

    while (attempts < maxAttempts && !manageReservationReached) {
      try {
        console.log(`Navigation attempt ${attempts + 1} of ${maxAttempts}...`);
        // Use current page context instead of goto, relying on existing navigation
        await page.getByRole('link', { name: 'Bookings' }).click();
        await page.waitForTimeout(5000); // Small delay to ensure dropdown is stable
        await page.getByText('Reservations', { exact: true }).click();
        await page.waitForTimeout(5000); // Small delay to ensure navigation
        await page.getByText('Manage Reservation').click();
        await page.waitForLoadState('networkidle');
        console.log('Navigated to Manage Reservation successfully...');
        manageReservationReached = true;
      } catch (e) {
        console.log(`Navigation failed on attempt ${attempts + 1}: ${e.message}`);
        await page.reload({ waitUntil: 'networkidle', timeout: 60000 }); // Add timeout to prevent hanging
        attempts++;
        if (attempts === maxAttempts) {
          console.log('Max attempts reached, stopping navigation...');
          throw new Error('Failed to navigate to Manage Reservation after multiple attempts');
        }
      }
    }

    // Set arrival and departure dates once
    await page.getByRole('textbox', { name: 'Arrival From' }).fill('07-03-2025');
    await page.getByRole('textbox', { name: 'Arrival To' }).fill('07-03-2025');
    await page.waitForLoadState('networkidle');

    // Loop through all rooms, tracking progress
    let roomsProcessed = 0;
    for (const room of rooms) {
      if (page.isClosed()) {
        console.log('Page closed unexpectedly - stopping test');
        break;
      }
      if (page.url().includes('login')) {
        console.log('Session expired - attempting to reconnect');
        await page.goto(initialUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000); // 5-second delay after reload
        await page.getByRole('link', { name: 'Bookings' }).click();
        await page.waitForTimeout(5000);
        await page.getByText('Reservations', { exact: true }).click();
        await page.waitForTimeout(5000);
        await page.getByText('Manage Reservation').click();
        await page.waitForLoadState('networkidle');
        await page.getByRole('textbox', { name: 'Arrival From' }).fill('07-03-2025');
        await page.getByRole('textbox', { name: 'Arrival To' }).fill('07-03-2025');
        await page.waitForLoadState('networkidle');
      }
      
      console.log(`Checking Room ${room.number} (${room.type})...`);
      await page.getByRole('textbox', { name: 'Room', exact: true }).fill(room.number);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.waitForLoadState('networkidle', { timeout: 20000 }); // Increased timeout for search stability

      // Check for tenant, with enhanced handling for client info and Linked Profiles screens
      const tenantLink = page.getByRole('link', { name: /^[A-Za-z]+, [A-Za-z]+$/ }).first();
      try {
        await tenantLink.waitFor({ state: 'visible', timeout: 10000 }); // Increased timeout for reservations
        const tenantName = await tenantLink.textContent();
        console.log(`Room ${room.number} (${room.type}): ${tenantName.trim()}`);
        await tenantLink.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }); // Increased timeout for client info screen

        // Handle Linked Profiles pop-up (click Close link to close)
        try {
          await page.getByRole('link', { name: 'Close' }).click(); // Use the provided code to close the Linked Profiles pop-up
          console.log('Closed Linked Profiles pop-up with Close link');
          await page.waitForLoadState('networkidle', { timeout: 10000 }); // Wait after closing Linked Profiles
        } catch (e) {
          console.log(`Failed to close Linked Profiles pop-up: ${e.message}`);
          throw e; // Re-throw to handle in the outer catch if needed
        }

        // Close the main client info screen
    //    const closeLink = page.getByText('Close', { exact: true });
    //    await closeLink.waitFor({ state: 'visible', timeout: 15000 }); // Increased timeout for stability
    //    const closeBoundingBox = await closeLink.boundingBox();
    //    if (closeBoundingBox) {
    //      console.log(`Found 'Close' link at position x:${closeBoundingBox.x}, y:${closeBoundingBox.y}`);
    //     await closeLink.click({ timeout: 60000 });
    //    } else {
    //      throw new Error('Could not determine position of "Close" link in client info screen');
    //    }
    //    await page.waitForLoadState('networkidle', { timeout: 20000 }); // Wait for main screen to return
    //  } catch (e) {
    //    console.log(`Room ${room.number} (${room.type}): Unoccupied`);
      }

      // Click 'Modify Search Criteria' to reset the search, regardless of tenant
      let resetAttempts = 0;
      const maxResetAttempts = 3;
      let resetSuccessful = false;

      while (resetAttempts < maxResetAttempts && !resetSuccessful && !page.isClosed()) {
        try {
          const modifyLink = page.getByText('Modify Search Criteria', { exact: true });
          await modifyLink.waitFor({ state: 'visible', timeout: 25000 }); // Increased timeout for stability
          const boundingBox = await modifyLink.boundingBox();
          if (boundingBox) {
            console.log(`Found 'Modify Search Criteria' at position x:${boundingBox.x}, y:${boundingBox.y}`);
            await modifyLink.click({ timeout: 60000 });
          } else {
            throw new Error('Could not determine position of "Modify Search Criteria"');
          }
          await page.waitForLoadState('networkidle', { timeout: 20000 });
          resetSuccessful = true;
        } catch (e) {
          console.log(`'Modify Search Criteria' attempt ${resetAttempts + 1} failed for ${room.number}: ${e.message}`);
          resetAttempts++;
          if (resetAttempts === maxResetAttempts) {
            console.log(`Max reset attempts reached for ${room.number}, clearing Room field instead`);
            if (!page.isClosed()) {
              await page.getByRole('textbox', { name: 'Room', exact: true }).fill('');
              await page.waitForLoadState('networkidle', { timeout: 20000 });
            } else {
              console.log('Page closed during reset - stopping test');
              break;
            }
          } else {
            if (!page.isClosed()) {
              await page.waitForTimeout(7000); // Increased wait before retry
            } else {
              console.log('Page closed during wait - stopping retry');
              break;
            }
          }
        }
      }

      // Clear and enter the next room number, or proceed if done
      if (roomsProcessed < rooms.length - 1) {
        await page.getByRole('textbox', { name: 'Room', exact: true }).fill(rooms[roomsProcessed + 1].number);
        await page.waitForTimeout(5000); // Delay before next search
      }

      if (page.isClosed()) break; // Exit outer loop if page closed
      roomsProcessed++;
      console.log(`Processed ${roomsProcessed} of ${rooms.length} rooms`);
    }
    console.log(`Completed checking all ${rooms.length} rooms`);
  });
});