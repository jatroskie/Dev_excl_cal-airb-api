// Modified downloadReservationCSV method with dynamic date calculation

async downloadReservationCSV(roomNumber, startDateParam, endDateParam) {
  console.log(`Starting download process for room ${roomNumber}...`);
  try {
    // Fix: Use this.page instead of expecting a page parameter
    const page = this.page;
    if (!page) {
      throw new Error("No page object available");
    }
    
    // Verify we're on the main interface before proceeding
    await this.verifyMainInterface(page, roomNumber);
    
    // Navigate to the Manage Reservation screen if not already there
    const currentUrl = await page.url();
    if (!currentUrl.includes('Reservation')) {
      console.log("Navigating to Manage Reservation screen...");
      await this.navigateToManageReservation(page);
    } else {
      console.log("Already on Manage Reservation screen, skipping navigation.");
      // If already on the search screen, click "Modify Search Criteria" to prepare for a new search
      try {
        const modifySearchButton = page.getByRole('link', { name: 'Modify Search Criteria' });
        if (await modifySearchButton.isVisible({ timeout: 5000 })) {
          console.log("Modify Search Criteria clicked...");
          await modifySearchButton.click();
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.log("Modify Search not visible or couldn't be clicked, continuing with search...");
      }
    }
    
    // Search for the room
    console.log(`Searching for room ${roomNumber}...`);
    
    // Calculate default date range if not provided (yesterday to today + 365 days)
    let startDate, endDate;
    
    if (startDateParam && endDateParam) {
      // Use provided dates if available
      startDate = startDateParam;
      endDate = endDateParam;
      console.log(`Using provided date range: ${startDate} to ${endDate}`);
    } else {
      // Calculate dynamic date range (yesterday to today + 365 days)
      const today = new Date();
      
      // Yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // One year from today
      const oneYearFromToday = new Date(today);
      oneYearFromToday.setDate(today.getDate() + 365);
      
      // Format as DD.MM.YYYY
      startDate = formatDateDDMMYYYY(yesterday);
      endDate = formatDateDDMMYYYY(oneYearFromToday);
      
      console.log(`Using calculated date range: ${startDate} to ${endDate}`);
    }
    
    try {
      // Fill Arrival From date
      const arrivalFromInput = page.getByRole('textbox', { name: 'Arrival From' });
      console.log("Arrival From input found, clicking to activate...");
      await arrivalFromInput.click();
      console.log("Arrival From input found, filling...");
      await arrivalFromInput.fill(startDate);
      
      // Fill Arrival To date
      const arrivalToInput = page.getByRole('textbox', { name: 'Arrival To' });
      console.log("Arrival To input found, clicking to activate...");
      await arrivalToInput.click();
      console.log("Arrival To input found, filling...");
      await arrivalToInput.fill(endDate);
      
      // UPDATED: Use .nth(0) to select the first Room input
      const roomInput = page.getByRole('textbox', { name: 'Room' }).nth(0);
      await roomInput.click();
      await roomInput.fill(roomNumber);
      
      // Click Search
      console.log("Clicking Search button...");
      const searchButton = page.getByRole('button', { name: 'Search' }).nth(1);
      await searchButton.click();
      console.log("Search button clicked successfully.");
      
      // Wait for search results or "no results" message
      await page.waitForTimeout(3000);
      
      // Check if there are no search results
      const noResultsElement = page.locator('text="You have no search results yet."');
      const hasNoResults = await noResultsElement.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasNoResults) {
        console.log(`No reservation results found for room ${roomNumber}, skipping CSV export.`);
        // Create an empty CSV file to indicate processing was completed
        const downloadPath = path.join(__dirname, 'downloads', `${roomNumber}_reservations.csv`);
        fs.writeFileSync(downloadPath, 'No reservations found for this room');
        console.log(`Created empty CSV file for room ${roomNumber} at ${downloadPath}`);
        return { success: true, message: `No reservations found for room ${roomNumber}`, path: downloadPath };
      }
      
      // If we have results, proceed with the export
      console.log("View Options clicked...");
      const viewOptionsLink = page.getByRole('link', { name: 'View Options' });
      await viewOptionsLink.waitFor({ state: 'visible', timeout: 5000 });
      await viewOptionsLink.click();
      
      console.log("Export clicked...");
      const exportLink = page.getByRole('menuitem', { name: 'Export' });
      await exportLink.waitFor({ state: 'visible', timeout: 5000 });
      await exportLink.click();
      
      console.log("CSV clicked...");
      const csvLink = page.locator('label:has-text("CSV"), *:text("CSV")').first();
      await csvLink.waitFor({ state: 'visible', timeout: 5000 });
      await csvLink.click();
                 
      // Wait for export dialog to appear
      const exportDialog = page.locator('div[role="dialog"]').filter({ hasText: 'Export' });
      await exportDialog.waitFor({ state: 'visible', timeout: 10000 });
      
      // Wait for file name input field and fill it
      const filenameInput = page.getByRole('textbox', { name: 'File Name' });
      await filenameInput.waitFor({ state: 'visible', timeout: 5000 });
      await filenameInput.fill(roomNumber);
      console.log("Entered file name as room number...");
      
      // Set up download path
      const downloadPath = path.join(__dirname, 'downloads', `${roomNumber}_reservations.csv`);
      
      // NEW: Create a download promise before clicking the export button
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      
      // Click Export button to start download
      const exportButton = page.getByRole('button', { name: 'Export' }).last();
      await exportButton.click();
      console.log("Export (download) button clicked...");
      
      // Wait for the download to start
      console.log("Waiting for download to start...");
      const download = await downloadPromise;
      console.log(`Download started: ${download.suggestedFilename()}`);
      
      // Wait for the download to complete and save the file
      console.log("Waiting for download to complete...");
      const downloadSavePath = path.join(__dirname, 'downloads', `${roomNumber}_reservations.csv`);
      await download.saveAs(downloadSavePath);
      console.log(`Download completed and saved to: ${downloadSavePath}`);
      
      return { success: true, path: downloadSavePath };
      
    } catch (error) {
      console.error(`Reservation CSV download failed for room ${roomNumber}: ${error.message}`);
      
      // Take a screenshot of the error
      const errorScreenshotPath = path.join(__dirname, 'downloads', `error_${roomNumber}_${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshotPath });
      console.log(`Saved error screenshot to ${errorScreenshotPath}`);
      
      throw error; // Rethrow to be handled by the caller
    }
  } catch (error) {
    throw error; // Rethrow to be handled by the caller
  }
}

// Helper function to format dates as DD.MM.YYYY
function formatDateDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}