// run app5.js with the following command: node app5.js --extractReservations --downloadCsv --useCustomDates
// The above command will prompt the user to enter the start and end dates for the date range
// The app will then download CSV files for the specified date range for the specified room types
// The app will keep track of progress and log success/failure for each room
// The app will also take a screenshot in case of an error and save it in the downloads folder
// to run: node app5.js --extractReservations --downloadCsv --startDate=01.01.2024 --endDate=31.07.2025

const { chromium } = require('playwright');
const { loginToOperaCloud } = require('./login3');
const OperaCloudExtractor = require('./extractor5.9.1'); // Updated to use the latest extractor


const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify the readline question method
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Function to format date as DD.MM.YYYY
function formatDateDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Function to calculate default date range: today - 7 days to today + 365 days
function calculateDateRange() {
  const today = new Date();

  // Start date: Today minus 7 days
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7); // Subtract 7 days

  // End date: One year from today (today + 365 days)
  const oneYearFromToday = new Date(today);
  oneYearFromToday.setDate(today.getDate() + 365);

  return {
    startDate: formatDateDDMMYYYY(sevenDaysAgo), // Use the calculated start date
    endDate: formatDateDDMMYYYY(oneYearFromToday)
  };
}

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: true, // Set to false for debugging if needed
    args: ['--disable-dev-shm-usage', '--start-maximized'], // Added start-maximized
    slowMo: 100, // Adjust slowMo as needed
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: null // Use the browser's maximized viewport
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function runApp() {
  // --- Updated Log Message ---
  console.log('Loading app5.js - Version with room table loop and dynamic date range (Default: Today-7 days to Today+365 days)');

  // Get dates from command line arguments or calculate dynamically
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    const flag = key.replace('--', '');
    acc[flag] = value !== undefined ? value : true;
    return acc;
  }, {
    extractGuests: false,
    extractReservations: false,
    downloadCsv: false,
    useCustomDates: false
  });

  console.log('Parsing command-line arguments...');
  console.log('Args parsed:', args);

  try {
    // Calculate the default date range (today - 7 days to today + 365 days)
    const defaultDateRange = calculateDateRange(); // Uses the updated function

    // Prioritize command line arguments for dates
    let startDate, endDate;

    if (args.startDate && args.endDate) {
      // Use dates from command line args
      startDate = args.startDate;
      endDate = args.endDate;
      console.log(`Using command line date range: ${startDate} to ${endDate}`);
    } else if (args.useCustomDates === true) {
      // User wants to be prompted for dates
      console.log(`Default date range: ${defaultDateRange.startDate} to ${defaultDateRange.endDate}`);
      const useDefault = await askQuestion('Use default date range? (Y/n): ');

      if (useDefault.toLowerCase() === 'n') {
        startDate = await askQuestion('Enter start date (DD.MM.YYYY): ');
        endDate = await askQuestion('Enter end date (DD.MM.YYYY): ');
        console.log(`Using custom date range: ${startDate} to ${endDate}`);
      } else {
        startDate = defaultDateRange.startDate;
        endDate = defaultDateRange.endDate;
        console.log(`Using default date range: ${startDate} to ${endDate}`);
      }
      rl.close(); // Close readline only if it was used
    } else {
      // Use calculated default date range as fallback
      startDate = defaultDateRange.startDate;
      endDate = defaultDateRange.endDate;
      console.log(`Using calculated default date range: ${startDate} to ${endDate}`);
      rl.close(); // Close readline as it wasn't needed
    }


    let browser, context, page, keepAliveInterval;
    try {
      console.log('Starting login process...');
      const loginResult = await loginToOperaCloud();

      // Check if login returned an error
      if (loginResult.error) {
        console.error('Login failed, but continuing with cleanup:', loginResult.error.message);
        browser = loginResult.browser;
        context = loginResult.context;
        page = loginResult.page;
        throw new Error('Login process failed, cannot continue with application tasks');
      }

      // Login was successful
      browser = loginResult.browser;
      context = loginResult.context;
      page = loginResult.page;

      // Handle the PopupChecker page before proceeding
      try {
        const currentUrl = await page.url();
        console.log('Page URL after login:', currentUrl);

        if (currentUrl.includes('PopupChecker')) {
          console.log('PopupChecker page detected, creating new page for main dashboard...');
          // Create a new page in the same context
          const newPage = await context.newPage();
          // Navigate to the main dashboard
          await newPage.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });

          // Wait for the page to load properly
          await newPage.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout after navigating to dashboard, continuing anyway');
          });

          console.log('Navigated to main dashboard in new page');

          // Close the popup checker page if it's still open
          if (!page.isClosed()) {
            await page.close().catch(e => console.log('Error closing PopupChecker page:', e.message));
          }

          // Use the new page for further operations
          page = newPage;
        } else {
           console.log('PopupChecker page not detected, continuing with current page.');
           // Ensure page is ready
           await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
             console.log('Network idle timeout after login, continuing anyway');
           });
        }
      } catch (error) {
        console.log('Error handling PopupChecker page or ensuring page readiness:', error.message);
        console.log('Attempting to create a fresh page to continue...');

        try {
          // Close potentially problematic page first
          if (page && !page.isClosed()) {
            await page.close().catch(e => console.log('Error closing potentially problematic page:', e.message));
          }
          // Create a new page and navigate to the main dashboard as fallback
          const freshPage = await context.newPage();
          await freshPage.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });
           await freshPage.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log('Network idle timeout on fallback page, continuing anyway');
          });
          page = freshPage;
          console.log('Successfully created fallback page and navigated to dashboard.');
        } catch (fallbackError) {
          console.error('Failed to create fallback page:', fallbackError.message);
          // Depending on severity, might want to throw here
        }
      }

      console.log('Login process completed successfully.');

      await context.setDefaultTimeout(60000); // Increase default timeout
      console.log('Configuring download behavior...');
      const downloadDir = path.join(__dirname, 'downloads');
      await fs.mkdir(downloadDir, { recursive: true });

      // Create extractor instance with proper parameters
      const extractor = new OperaCloudExtractor(page, context, browser, launchBrowser, loginToOperaCloud);

      if (args.downloadCsv || args.csv) {
        const roomTypes = {
          'STU-BALC': ['0302', '0303', '0400', '0401', '0402', '0501', '0502', '0503', '0514'],
          'STU-URB': ['0304', '0305', '0306', '0307', '0308', '0309', '0311', '0312', '0313', '0314', '0318', '0319', '0320', '0321', '0323', '0403', '0404', '0405', '0406', '0407', '0408', '0409', '0411', '0412', '0416', '0417', '0418', '0419', '0420'],
          '1-BR': ['0315', '0317', '0413', '0415'],
          'STU-LUX': ['0504', '0506', '0507', '0508', '0509', '0511', '0516', '0517', '0518', '0519', '0520'],
          '2-BR': ['0513', '0515']
        };

        await fs.mkdir(downloadDir, { recursive: true });

        keepAliveInterval = setInterval(async () => {
          if (page && !page.isClosed()) {
            try {
              await extractor.keepSessionAlive();
            } catch (err) {
              console.warn('Keep alive session check failed:', err.message);
            }
          }
        }, 5 * 60 * 1000); // 5 minutes

        let successCount = 0;
        let failureCount = 0;
        let processedRooms = [];

        const logProgress = async () => {
          try {
            const progressLog = {
              timestamp: new Date().toISOString(),
              dateRange: { startDate, endDate },
              successCount,
              failureCount,
              processedRooms,
              totalRooms: Object.values(roomTypes).flat().length
            };
            await fs.writeFile(
              path.join(downloadDir, 'progress.json'),
              JSON.stringify(progressLog, null, 2)
            );
          } catch (err) {
            console.error('Failed to write progress log:', err.message);
          }
        };

        const BATCH_SIZE = 5;
        let allRooms = [];
        for (const [type, rooms] of Object.entries(roomTypes)) {
          for (const room of rooms) {
            allRooms.push({ type, room });
          }
        }

        console.log(`Starting CSV download for ${allRooms.length} rooms...`);
        console.log(`Date Range: ${startDate} to ${endDate}`);

        for (let i = 0; i < allRooms.length; i += BATCH_SIZE) {
          const batch = allRooms.slice(i, i + BATCH_SIZE);
          console.log(`--- Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(allRooms.length/BATCH_SIZE)} (Rooms ${i+1} to ${Math.min(i + BATCH_SIZE, allRooms.length)}) ---`);

          // Small delay before starting a batch
          await new Promise(resolve => setTimeout(resolve, 1000));

          for (const { type, room } of batch) {
            console.log(`\nProcessing room ${room} (Type: ${type})...`);

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before attempting download
                // Pass room number and dates to download method
                const downloadResult = await extractor.downloadReservationCSV(room, startDate, endDate);
                console.log(`[Success] Room ${room}: Successfully downloaded ${downloadResult.path || 'file'}`);
                successCount++;
                processedRooms.push({
                  room,
                  type,
                  status: 'success',
                  dateRange: { startDate, endDate },
                  timestamp: new Date().toISOString()
                });
                await logProgress();
                break; // Exit retry loop on success
              } catch (error) {
                console.error(`[Attempt ${attempt}/3 Failed] Room ${room}: ${error.message}`);

                if (attempt === 3) {
                  failureCount++;
                  processedRooms.push({
                    room,
                    type,
                    status: 'failed',
                    dateRange: { startDate, endDate },
                    timestamp: new Date().toISOString(),
                    error: error.message,
                    stack: error.stack // Optionally log stack trace for failures
                  });
                  await logProgress();

                  // Take screenshot on final failure
                  if (page && !page.isClosed()) {
                    try {
                      const errorScreenshot = path.join(downloadDir, `error_room_${room}_${Date.now()}.png`);
                      await page.screenshot({ path: errorScreenshot, fullPage: true });
                      console.log(`Error screenshot saved to: ${errorScreenshot}`);
                    } catch (screenshotError) {
                      console.error('Failed to take error screenshot:', screenshotError.message);
                    }
                  }
                }

                // Longer delay before retrying
                await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // Increase delay per attempt

                // Check for fatal errors that require browser restart
                 if (attempt < 3 && (error.message.includes('Target page, context or browser has been closed') ||
                                    error.message.includes('Protocol error') ||
                                    error.message.includes('Timeout') || // Consider restarting on timeout too
                                    error.message.includes('detached') ||
                                    error.message.includes('Session closed'))) {
                  console.log(`Severe error detected on attempt ${attempt} for room ${room}. Attempting browser restart...`);
                  try {
                    // Pass the current page reference if needed by restart logic
                    await extractor.restartBrowser(page);
                    browser = extractor.browser;
                    context = extractor.context;
                    page = extractor.page;
                    console.log('Browser restarted successfully. Retrying room...');
                    // Optionally break the inner loop and retry the room in the outer loop,
                    // or continue with the next attempt in this loop with the new browser instance.
                    // Continuing the loop is simpler here.
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait after restart
                  } catch (restartError) {
                    console.error('Failed to restart browser:', restartError.message);
                    console.error('Aborting processing for room', room, 'due to restart failure.');
                    // Mark as failed and break the attempt loop for this room
                     if (attempt < 3) { // Ensure failure is logged if restart fails before final attempt
                         failureCount++;
                         processedRooms.push({
                             room, type, status: 'failed', dateRange: { startDate, endDate },
                             timestamp: new Date().toISOString(),
                             error: `Browser restart failed: ${restartError.message}. Original error: ${error.message}`
                         });
                         await logProgress();
                     }
                    break; // Stop trying this room
                  }
                } else if (attempt === 3 && error.message.includes('Severe error detected')) {
                    // If restart failed on the last attempt, ensure it's logged and move on.
                    console.error(`Room ${room} failed permanently after restart attempt(s).`);
                }
              } // End catch block
            } // End attempt loop
            // Small delay between rooms in a batch
            await new Promise(resolve => setTimeout(resolve, 1500));
          } // End batch loop

          console.log(`--- Batch ${Math.floor(i/BATCH_SIZE) + 1} completed. Progress: ${successCount}/${allRooms.length} rooms successful. Failures: ${failureCount} ---`);

          // Keep session alive between batches
          if (page && !page.isClosed() && (i + BATCH_SIZE < allRooms.length)) { // Don't need keep-alive after last batch
             console.log("Attempting to keep session alive between batches...");
             try {
                await extractor.keepSessionAlive();
             } catch (keepAliveError) {
                console.warn('Failed to keep session alive between batches:', keepAliveError.message);
                // Consider attempting a browser restart here if keep-alive fails critically
             }
             await new Promise(resolve => setTimeout(resolve, 2000)); // Wait after keep-alive
          }
        } // End all rooms loop

        console.log(`\n=================================================`);
        console.log(`All room CSV processing finished.`);
        console.log(`Date range processed: ${startDate} to ${endDate}`);
        console.log(`Total Rooms: ${allRooms.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failures: ${failureCount}`);
        console.log(`Progress log saved to: ${path.join(downloadDir, 'progress.json')}`);
        console.log(`=================================================`);

        await logProgress(); // Final progress log update
      } else {
        console.log('No CSV download requested. Use --csv or --downloadCsv flag to enable.');
      }
    } catch (error) {
      console.error('App execution failed:', error.message);
      console.error('Error stack:', error.stack);
      // Attempt to take a final screenshot if possible
       if (page && !page.isClosed()) {
           try {
               const finalErrorScreenshot = path.join(__dirname, 'downloads', `FATAL_ERROR_${Date.now()}.png`);
               await page.screenshot({ path: finalErrorScreenshot, fullPage: true });
               console.log(`Fatal error screenshot saved to: ${finalErrorScreenshot}`);
           } catch (screenshotError) {
               console.error('Failed to take fatal error screenshot:', screenshotError.message);
           }
       }
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        console.log('Keep-alive interval cleared.');
      }

      console.log('Closing browser resources...');
      if (page && !page.isClosed()) {
        try {
          await page.close();
          console.log('Page closed successfully.');
        } catch (error) {
          console.error('Error closing page:', error.message);
        }
      } else {
        console.log('Page was already closed or not initialized.');
      }

      if (context) {
        try {
          await context.close();
          console.log('Context closed successfully.');
        } catch (error) {
          console.error('Error closing context:', error.message);
        }
      } else {
         console.log('Context was not initialized.');
      }

      if (browser) {
        try {
          await browser.close();
          console.log('Browser closed successfully.');
        } catch (error) {
          console.error('Error closing browser:', error.message);
        }
      } else {
         console.log('Browser was not initialized.');
      }

      // Ensure readline is closed if it wasn't closed earlier
      if (!rl.closed) {
        rl.close();
        console.log('Readline interface closed.');
      }

      console.log('App execution completed.');
    }
  } catch (error) {
    console.error('Error during initial setup or date input:', error.message);
    if (!rl.closed) { // Ensure rl is closed on early errors
        rl.close();
    }
    process.exit(1);
  }
}

process.on('uncaughtException', (error, origin) => {
  console.error('<<<<< UNCAUGHT EXCEPTION >>>>>');
  console.error('Origin:', origin);
  console.error('Error Message:', error.message);
  console.error(error.stack);
  process.exit(1); // Mandatory exit after uncaught exception
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('<<<<< UNHANDLED REJECTION >>>>>');
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason instanceof Error ? reason.message : reason);
   if (reason instanceof Error) {
        console.error(reason.stack);
   }
  // Consider whether to exit here. It might depend on the nature of the rejection.
  // For stability, exiting might be safer: process.exit(1);
});

runApp().catch(error => {
  console.error('<<<<< ERROR IN runApp EXECUTION >>>>>');
  console.error('Error Message:', error.message);
  console.error(error.stack);
  process.exit(1);
});