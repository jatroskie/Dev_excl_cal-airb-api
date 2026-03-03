async function fillBookingDetails(page, startDate, endDate, roomNumber) {
  console.log('Filling booking details...');
  await page.getByRole('textbox', { name: 'Arrival' }).nth(0).fill(startDate);
  console.log(`Set arrival date to ${startDate}`);
  await page.waitForTimeout(2000);
  
  await page.getByRole('textbox', { name: 'Departure' }).nth(0).fill(endDate);
  console.log(`Set departure date to ${endDate}`);
  await page.waitForTimeout(2000);
  await page.getByRole('textbox', { name: 'Room', exact: true }).nth(0).fill(roomNumber.slice(-4));
  console.log(`Set room number to ${roomNumber}`);
  await page.waitForTimeout(2000);
  
  // Use keyboard navigation: Press Tab 14 times, then Enter
  //await page.waitForTimeout(4000);
  console.log('[fillBookingDetails] Using keyboard navigation to focus and click the "Search" button...');
  for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300); // Small delay between Tab presses to ensure UI updates
  }
  await page.waitForTimeout(3000); // Select Room popup load
  //Trying some old code for Select Room click;
  const selectRoomLink = page.getByRole('link', { name: 'Select Room' }).first();
    if (await selectRoomLink.isVisible({ timeout: 5000 })) {
      console.log('Found Select Room link, clicking');
      await page.waitForTimeout(2000);
      await selectRoomLink.click();
      console.log('Clicked Select Room link');
    } else {
      const selectRoomButton = page.getByRole('button', { name: 'Select Room' }).first();
      if (await selectRoomButton.isVisible({ timeout: 3000 })) {
        console.log('Found Select Room button, clicking');
        await page.waitForTimeout(2000);
        await selectRoomButton.click();
        console.log('Clicked Select Room button');
      } else {
        console.log('Looking for any element with "Select Room" text');
        const selectRoomText = page.locator(':text("Select Room")').first();
        if (await selectRoomText.isVisible({ timeout: 3000 })) {
          console.log('Found element with Select Room text, clicking');
          await page.waitForTimeout(2000);
          await selectRoomText.click();
        } else {
          console.log('Using JavaScript to find Select Room element');
          const foundElement = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && el.textContent.trim() === 'Select Room');
            if (elements.length > 0) {
              elements[0].click();
              return true;
            }
            return false;
          });
          if (foundElement) {
            console.log('Found and clicked Select Room with JavaScript');
          } else {
            throw new Error('Could not find Select Room element');
          }
        }
      }
    }
      await page.waitForTimeout(3000);
      console.log('[fillBookingDetails] Using keyboard navigation to focus and click the "Search" button...');
      for (let i = 0; i < 2; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300); // Small delay between Tab presses to ensure UI updates
      }
      await page.keyboard.press('Enter');
        console.log('[fillBookingDetails] "Search" button activated via keyboard navigation.');
        // Wait for rates to load
        await page.waitForTimeout(3000);
        console.log('[fillBookingDetails] "Rates page should be loading....');

  }
 
  module.exports = { fillBookingDetails }; // <--- Add this export line