// Think this is the main function to create a booking
// It imports several other functions to perform specific tasks
// It also handles the login process and manages the browser context
// It uses async/await for asynchronous operations and error handling
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright'); // Ensure you have playwright installed


async function createBooking(clientName, firstName, telephoneNumber, roomNumber, startDate, endDate, airRate, discountCode = 'OTH') {
  let browser = null;
  let context = null;
  let page = null;

  try {
    // Step 1: Log in
    //------------------------------------------------------------
        const { loginToOperaCloud } = require('./login3');
    const loginResult = await loginToOperaCloud();
    ({ browser, context, page } = loginResult);
    if (loginResult.error) {
      throw new Error(`Login failed: ${loginResult.error.message}`);
    }
    const currentUrl = await page.url();
    console.log(`Login successful. Current URL: ${currentUrl}`);

    if (currentUrl.includes('PopupChecker') || !currentUrl.includes('OperaCloud')) {
      console.log('Need to navigate to main application...');
      console.log('Creating new page for main application...');
      page = await context.newPage();
      
      const appUrl = 'https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud';
      console.log(`Navigating to main application URL: ${appUrl}`);
      
      await page.goto(appUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        console.log('Network idle timeout, continuing anyway');
      });
    }
    const downloadsPath = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
  
    // Step 2: Navigate to booking screen - Started to test
    //-----------------------------------------------------------
    const { navigateToBookingScreen } = require('./funky_navigateToBookingScreen.js');
    const NavigateResult = await navigateToBookingScreen(page, downloadsPath);
    if (NavigateResult.error) {
      throw new Error(`Navigation to booking screen failed: ${NavigateResult.error.message}`);
    }

     // Step 3: Enter travel agent details - Started, to test
     //-------------------------------------------------------------
     const { enterTravelAgentDetails } = require('./funky_enterTravelAgentDetails.js');
     const TravelAgentResult = await enterTravelAgentDetails(page, 'AirBnB', downloadsPath);
     if (TravelAgentResult.error) {
       throw new Error(`Entering travel agent details failed: ${TravelAgentResult.error.message}`);
     }
      console.log('Proceeding with Fill booking detials...');
      
    // Step 4: Fill booking details 
    //------------------------------------------------------------
    
    const { fillBookingDetails } = require('./funky_fillBookingDetails.js');
    const fillDetailsResult = await fillBookingDetails(page, startDate, endDate, roomNumber);
    if (fillDetailsResult.error) {
      throw new Error(`Filling booking details failed: ${fillDetailsResult.error.message}`);
    }
    console.log('Proceeding with Select Room and Rate...')
        
    // Step 5: Select room and rate
    //------------------------------------------------------------
    const { selectRoomAndRate } = require('./funky_selectRoomAndRate.js');
    const selectRoomResult = await selectRoomAndRate(page);
    if (selectRoomResult.error) {
      throw new Error(`Selecting room and rate failed: ${selectRoomResult.error.message}`);
    }
    console.log('Proceeding with Set Discounts or Payment Methods...')
 
    timeout: 10000 
    // Step 6-9: Perform booking tasks
    const { setDiscountsOrPaymentMethods } = require('./funky_setDiscountsOrPaymentMeth.js');
    const selectDiscountResult = await setDiscountsOrPaymentMethods(page);
    
    const { createGuestProfile } = require('./funky_createGuestProfile.js');
    const { clickBookNowButton } = require('./funky_clickBookNowButton.js');
    const { handleErrorsOrConfirmBooking } = require('./funky_handleErrorsOrConfirmBooking.js');
    await setDiscountsOrPaymentMethods(page, discountCode);
    await createGuestProfile(page, clientName, firstName, telephoneNumber);
    await clickBookNowButton(page);
    await handleErrorsOrConfirmBooking(page);

    return { success: true, message: `Booking completed for ${firstName} ${clientName}` };
  } catch (error) {
    console.log('Error during booking:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

createBooking("Smith", "John", "+27828820100", "TBA-0405", "01-05-2025", "05-05-2025", "1950", 'OTH')