// nodeScheduler2_run.js
const schedule = require('node-schedule');
const { exec } = require('child_process');
const fs = require('fs').promises; // Use promises API for async operations
const path = require('path');

// --- Configuration ---
// Base directory where the target script and data reside
const targetBaseDir = 'C:\\Users\\Johan\\cal_airb_api'; // Use double backslashes in JS strings

// Path to the script you want to run, relative to targetBaseDir
const scriptToRunRelative = 'Scheduler2.js';
const scriptToRunFullPath = path.join(targetBaseDir, scriptToRunRelative);

// Files/patterns to manage before each run
const downloadsDir = path.join(targetBaseDir, 'downloads');
const calendarDataFile = path.join(targetBaseDir, 'calendar-data.json'); // Still deleted
const operaDataFile = path.join(targetBaseDir, 'opera_data.json');     // Archived now
const archiveDir = path.join(targetBaseDir, 'OD_archive'); // Archive subfolder

// Cron Schedules
const cronScheduleDay = '0 7-18 * * *';
const cronScheduleNight = '30 19,22,1,4 * * *';
// --- End Configuration ---

// --- Helper Function: Delete file if it exists ---
async function deleteFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`   - Deleted: ${path.basename(filePath)}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`   - Not found (already deleted?): ${path.basename(filePath)}`);
    } else {
      console.error(`   - Error deleting ${path.basename(filePath)}:`, error.message);
    }
  }
}

// --- Helper Function: Generate timestamped filename for archive ---
function getArchiveTimestampFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    // Adds .json extension automatically
    return `OD_${year}${month}${day}_${hours}${minutes}${seconds}.json`;
}


// --- Core Task Function: Cleanup and Run Script ---
async function performCleanupAndRunScript(triggeredBySchedule) {
  const currentTime = new Date();
  console.log(`\n[${currentTime.toISOString()}] Triggering job via schedule: ${triggeredBySchedule}`);

  // --- Step 1: Perform Cleanup and Archiving ---
  console.log(`[${currentTime.toISOString()}] Starting pre-run cleanup & archive...`);
  try {
    // --- Archive opera_data.json ---
    console.log(`   - Checking for existing ${path.basename(operaDataFile)} to archive...`);
    try {
        // Check if source exists *before* trying to access/rename
        await fs.access(operaDataFile, fs.constants.F_OK); // Throws error if not found

        // Ensure archive directory exists
        console.log(`   - Ensuring archive directory exists: ${archiveDir}`);
        await fs.mkdir(archiveDir, { recursive: true }); // Create if not exists

        // Generate new filename and path
        const archiveFilename = getArchiveTimestampFilename();
        const archiveFilePath = path.join(archiveDir, archiveFilename);

        // Rename/Move the file
        console.log(`   - Attempting to archive ${path.basename(operaDataFile)} to ${archiveFilePath}`);
        await fs.rename(operaDataFile, archiveFilePath);
        console.log(`   - Archived successfully.`);

    } catch (error) {
        if (error.code === 'ENOENT') {
            // This is okay, the file just didn't exist to be archived
            console.log(`   - ${path.basename(operaDataFile)} not found, nothing to archive.`);
        } else {
            // Log other errors during archive process (e.g., permissions)
            console.error(`   - Error archiving ${path.basename(operaDataFile)}:`, error.message);
            // Decide if this is critical - maybe continue?
        }
    }

    // --- Delete other specified files ---
    await deleteFileIfExists(calendarDataFile);

    // --- Delete *.csv files in downloads directory ---
    console.log(`   - Deleting *.csv in ${downloadsDir}`);
    let csvFilesDeleted = 0;
    try {
      const filesInDownloads = await fs.readdir(downloadsDir);
      const csvFiles = filesInDownloads.filter(file => file.toLowerCase().endsWith('.csv'));

      if (csvFiles.length === 0) {
         console.log(`   - No *.csv files found in ${downloadsDir}`);
      } else {
         for (const csvFile of csvFiles) {
           const fullCsvPath = path.join(downloadsDir, csvFile);
           // Use the helper, which handles ENOENT gracefully if file disappears between readdir and unlink
           await deleteFileIfExists(fullCsvPath);
           csvFilesDeleted++;
         }
         console.log(`   - Finished deleting ${csvFilesDeleted} *.csv file(s).`);
      }
    } catch (error) {
       if (error.code === 'ENOENT') {
           console.log(`   - Downloads directory not found: ${downloadsDir}`);
       } else {
           console.error(`   - Error accessing downloads directory ${downloadsDir}:`, error.message);
       }
    }
    console.log(`[${currentTime.toISOString()}] Pre-run cleanup & archive finished.`);

  } catch (cleanupError) {
    // Catch errors from fs operations like mkdir if they happen outside specific try/catch
    console.error(`[${currentTime.toISOString()}] CRITICAL ERROR during cleanup/archive phase:`, cleanupError);
    // Optional: Decide if you want to skip running the script
    // return;
  }

  // --- Step 2: Execute the Scheduler2.js script ---
  console.log(`[${currentTime.toISOString()}] Running ${scriptToRunRelative} in directory ${targetBaseDir}...`);

  // Execute the script using Node.js, setting the 'cwd'
  exec(`node "${scriptToRunRelative}"`, { cwd: targetBaseDir }, (error, stdout, stderr) => {
    const finishedTime = new Date();
    if (error) {
      console.error(`[${finishedTime.toISOString()}] Error executing ${scriptToRunRelative}:`, error);
      return;
    }
    if (stderr) {
      console.error(`[${finishedTime.toISOString()}] Stderr from ${scriptToRunRelative}:\n--- STDERR START ---\n${stderr}\n--- STDERR END ---`);
    }
    if (stdout) {
       console.log(`[${finishedTime.toISOString()}] Stdout from ${scriptToRunRelative}:\n--- STDOUT START ---\n${stdout}\n--- STDOUT END ---`);
    } else if (!stderr) { // Avoid logging "no output" if there was only stderr
        console.log(`[${finishedTime.toISOString()}] ${scriptToRunRelative} ran successfully with no stdout.`);
    }
    console.log(`[${finishedTime.toISOString()}] Finished running ${scriptToRunRelative}. Triggered by: ${triggeredBySchedule}`);
  });
}

// --- Schedule Setup ---
console.log(`Scheduler starting up...`);
console.log(` - Target Directory: ${targetBaseDir}`);
console.log(` - Script to run: ${scriptToRunRelative} (within target dir)`);
console.log(` - Archive Directory for opera_data.json: ${archiveDir}`);
console.log(` - Schedule 1 (Day): '${cronScheduleDay}' (Every hour 07:00-18:00)`);
console.log(` - Schedule 2 (Night): '${cronScheduleNight}' (Every 3 hours 19:30-04:30)`);
console.log(`Current time: ${new Date()}`);

// Schedule the first job (Daytime)
const jobDay = schedule.scheduleJob(cronScheduleDay, function() {
  performCleanupAndRunScript(cronScheduleDay); // Pass schedule identifier
});

// Schedule the second job (Nighttime)
const jobNight = schedule.scheduleJob(cronScheduleNight, function() {
  performCleanupAndRunScript(cronScheduleNight); // Pass schedule identifier
});

// Optional: Log next invocations
if (jobDay) {
  console.log(`\nNext invocation for Day schedule (${cronScheduleDay}) : ${jobDay.nextInvocation()?.toISOString() || 'N/A'}`);
} else {
  console.error('Could not schedule the Day job. Check the cron schedule format.');
}
if (jobNight) {
  console.log(`Next invocation for Night schedule (${cronScheduleNight}): ${jobNight.nextInvocation()?.toISOString() || 'N/A'}`);
} else {
  console.error('Could not schedule the Night job. Check the cron schedule format.');
}

// Keep the script running
console.log('\nScheduler is active. Press Ctrl+C to stop.');

// Optional: Handle graceful shutdown
process.on('SIGINT', function() {
  console.log('\nGracefully shutting down scheduler...');
  schedule.gracefulShutdown()
    .then(() => process.exit(0));
});