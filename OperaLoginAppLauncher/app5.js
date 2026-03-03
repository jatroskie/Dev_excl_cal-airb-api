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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Function to calculate date range: yesterday to today + 365 days
function calculateDateRange() {
  const today = new Date();
  
  // Yesterday (today - 1 day)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // One year from today (today + 365 days)
  const oneYearFromToday = new Date(today);
  oneYearFromToday.setDate(today.getDate() + 365);
  
  return {
    startDate: formatDateDDMMYYYY(yesterday),
    endDate: formatDateDDMMYYYY(oneYearFromToday)
  };
}

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-dev-shm-usage'],
    slowMo: 100,
  });
  const context = await browser.newContext({
    acceptDownloads: true,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function runApp() {
  console.log('Loading app5.js - Version with room table loop and dynamic date range');
  
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
    // Calculate the default date range (yesterday to today + 365 days)
    const defaultDateRange = calculateDateRange();
    
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
      } else {
        startDate = defaultDateRange.startDate;
        endDate = defaultDateRange.endDate;
      }
    } else {
      // Use calculated date range as fallback
      startDate = defaultDateRange.startDate;
      endDate = defaultDateRange.endDate;
      console.log(`Using calculated date range: ${startDate} to ${endDate}`);
    }
    
    // Close readline interface
    rl.close();
    
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
            console.log('Network idle timeout, continuing anyway');
          });
          
          console.log('Navigated to main dashboard in new page');
          
          // Close the popup checker page if it's still open
          if (!page.isClosed()) {
            await page.close().catch(e => console.log('Error closing PopupChecker page:', e.message));
          }
          
          // Use the new page for further operations
          page = newPage;
        }
      } catch (error) {
        console.log('Error handling PopupChecker page:', error.message);
        console.log('Attempting to create a fresh page to continue...');
        
        try {
          // Create a new page and navigate to the main dashboard as fallback
          const freshPage = await context.newPage();
          await freshPage.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });
          page = freshPage;
        } catch (fallbackError) {
          console.error('Failed to create fallback page:', fallbackError.message);
        }
      }
      
      console.log('Login process completed successfully.');

      await context.setDefaultTimeout(60000);
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
        }, 5 * 60 * 1000);

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

        for (let i = 0; i < allRooms.length; i += BATCH_SIZE) {
          const batch = allRooms.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(allRooms.length/BATCH_SIZE)}`);

          for (const { type, room } of batch) {
            console.log(`Processing room ${room} (Type: ${type})...`);

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Pass room number and dates to download method
                const downloadResult = await extractor.downloadReservationCSV(room, startDate, endDate);
                console.log(`Successfully downloaded ${downloadResult.path || 'file'} for room ${room}`);
                successCount++;
                processedRooms.push({ 
                  room, 
                  type, 
                  status: 'success', 
                  dateRange: { startDate, endDate },
                  timestamp: new Date().toISOString() 
                });
                await logProgress();
                break;
              } catch (error) {
                console.error(`Attempt ${attempt}/3 failed for room ${room}: ${error.message}`);

                if (attempt === 3) {
                  failureCount++;
                  processedRooms.push({ 
                    room, 
                    type, 
                    status: 'failed', 
                    dateRange: { startDate, endDate },
                    timestamp: new Date().toISOString(), 
                    error: error.message 
                  });
                  await logProgress();

                  if (page && !page.isClosed()) {
                    try {
                      const errorScreenshot = path.join(downloadDir, `error_${room}_${Date.now()}.png`);
                      await page.screenshot({ path: errorScreenshot, fullPage: true });
                      console.log(`Error screenshot saved to: ${errorScreenshot}`);
                    } catch (screenshotError) {
                      console.error('Failed to take error screenshot:', screenshotError.message);
                    }
                  }
                }

                await new Promise(resolve => setTimeout(resolve, 5000));

                if (attempt === 3 && (error.message.includes('Target page, context or browser has been closed') ||
                                    error.message.includes('Protocol error') ||
                                    error.message.includes('Timeout') ||
                                    error.message.includes('detached'))) {
                  console.log('Severe error detected, attempting browser restart...');
                  try {
                    await extractor.restartBrowser();
                    browser = extractor.browser;
                    context = extractor.context;
                    page = extractor.page;
                    console.log('Browser restarted successfully');
                  } catch (restartError) {
                    console.error('Failed to restart browser:', restartError.message);
                    throw restartError;
                  }
                }
              }
            }
          }

          console.log(`Batch completed. Progress: ${successCount}/${allRooms.length} rooms processed successfully.`);
          if (page && !page.isClosed()) {
            try {
              await extractor.keepSessionAlive();
            } catch (keepAliveError) {
              console.warn('Failed to keep session alive between batches:', keepAliveError.message);
            }
          }
        }

        console.log(`All room CSVs processed. Success: ${successCount}, Failures: ${failureCount}`);
        console.log(`Date range used: ${startDate} to ${endDate}`);
        await logProgress();
      } else {
        console.log('No CSV download requested. Use --csv or --downloadCsv to enable.');
      }
    } catch (error) {
      console.error('App execution failed:', error.message);
      console.error('Error stack:', error.stack);
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        console.log('Keep-alive interval cleared.');
      }

      if (page && !page.isClosed()) {
        try {
          await page.close();
          console.log('Page closed successfully.');
        } catch (error) {
          console.error('Error closing page:', error.message);
        }
      }

      if (context) {
        try {
          await context.close();
          console.log('Context closed successfully.');
        } catch (error) {
          console.error('Error closing context:', error.message);
        }
      }

      if (browser) {
        try {
          await browser.close();
          console.log('Browser closed successfully.');
        } catch (error) {
          console.error('Error closing browser:', error.message);
        }
      }

      console.log('App execution completed.');
    }
  } catch (error) {
    console.error('Error during date input:', error.message);
    rl.close();
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

runApp().catch(error => {
  console.error('Unhandled exception in runApp:', error.message);
  console.error(error.stack);
  process.exit(1);
});