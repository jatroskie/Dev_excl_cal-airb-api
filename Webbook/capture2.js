// capture2.js
// Ensure UTF-8 encoding
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

// Debug helper - logs to stderr so it doesn't interfere with the confirmation number output
function debug(message, data = {}) {
  const debugMessage = `DEBUG: ${message} ${JSON.stringify(data)}`;
  process.stderr.write(debugMessage + '\n');
}

// Sleep function to create wait states
function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Main async process
async function processReservation() {
  try {
    // Get command-line arguments (skip first two: 'node' and 'capture2.js')
    const args = process.argv.slice(2);
    debug('Received arguments', args);

    // Expected arguments in order: surname, name, phone, property, roomId, checkin, checkout, dailyRate, discountCode
    const [
      surname,
      name,
      phone,
      property,
      roomId,
      checkin,
      checkout,
      dailyRate,
      discountCode
    ] = args;

    // Simple validation function
    function isValidString(str) {
      return typeof str === 'string' && str.trim().length > 0;
    }

    // Function to parse DD.MM.YYYY format date strings
    function parseDate(dateStr) {
      debug('Parsing date', { dateStr });
      
      // Split the string by "." and convert to proper date format
      const parts = dateStr.split('.');
      
      if (parts.length !== 3) {
        debug('Invalid date format - wrong number of parts', { parts });
        return null;
      }
      
      const [day, month, year] = parts.map(Number);
      
      // Validate the numeric values
      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        debug('Invalid date components - not numeric', { day, month, year });
        return null;
      }
      
      // Create date with explicit year, month (0-indexed), day
      const date = new Date(year, month - 1, day);
      
      // Validate the date is valid (e.g., not 31.02.2025)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        debug('Invalid date - parsed date does not match input', { 
          inputDay: day, 
          inputMonth: month, 
          inputYear: year,
          parsedDay: date.getDate(),
          parsedMonth: date.getMonth() + 1,
          parsedYear: date.getFullYear()
        });
        return null;
      }
      
      debug('Successfully parsed date', { 
        input: dateStr, 
        result: date.toISOString(),
        components: { day, month, year }
      });
      
      return date;
    }

    // Check required fields
    const requiredFields = [surname, name, phone, property, roomId, checkin, checkout, dailyRate];
    if (!requiredFields.every(isValidString)) {
      process.stderr.write('Error: All required fields must be non-empty strings\n');
      process.exit(1); // Exit with error code to signal failure
    }

    // Validate dates
    debug('Validating dates', { checkin, checkout });
    const checkinDate = parseDate(checkin);
    const checkoutDate = parseDate(checkout);

    if (!checkinDate || !checkoutDate) {
      process.stderr.write('Error: Invalid date format. Use DD.MM.YYYY\n');
      process.exit(1);
    }

    debug('Comparing dates', { 
      checkinDate: checkinDate.toISOString(), 
      checkoutDate: checkoutDate.toISOString(),
      comparison: checkinDate >= checkoutDate ? 'checkin >= checkout' : 'checkin < checkout'
    });

    if (checkinDate >= checkoutDate) {
      process.stderr.write('Error: Invalid dates. Check-out must be after check-in.\n');
      process.exit(1);
    }

    // Validate daily rate
    const rate = parseFloat(dailyRate);
    debug('Validating daily rate', { inputRate: dailyRate, parsedRate: rate });

    if (isNaN(rate) || rate <= 0) {
      process.stderr.write('Error: Daily rate must be a positive number.\n');
      process.exit(1);
    }

    // Generate a 9-digit confirmation number starting with 4
    function generateConfirmationNumber() {
      const randomNum = Math.floor(Math.random() * 90000000); // 0 to 89,999,999
      const paddedNum = String(randomNum).padStart(8, '0'); // Ensure 8 digits
      return `4${paddedNum}`; // Prepend "4" to make it 9 digits
    }

    // Get property name for better display
    const propertyNames = {
      'TBA': 'The Barracks',
      'TTBH': 'The Trade',
      'LAW': 'Lawhill Luxury Suites',
      'TQA': 'The Quarter Apartments',
      'CRY': 'The Crystal Apartments',
      'MPV': 'Mouille Point Village',
      'HES': 'Harbouredge Suites'
    };
    
    const propertyName = propertyNames[property] || property;
    const roomNumber = roomId.split('-')[1];

    // Log received data for debugging (to stderr)
    debug('Received reservation data', {
      surname,
      name,
      phone,
      property,
      roomId,
      checkin,
      checkout,
      dailyRate,
      discountCode: discountCode || 'None'
    });

    // Simulate process with 10-second delays between each step
    debug('Starting reservation process');
    await sleep(10);
    
    debug('Logging into Opera PMS');
    await sleep(10);
    
    debug('Successfully logged in');
    await sleep(10);
    
    debug(`Capturing reservation for ${propertyName} - Room ${roomNumber}`);
    await sleep(10);
    
    debug(`Switching Opera to ${property}`);
    await sleep(10);
    
    debug('Opening Look to Book Sales Capture');
    await sleep(10);
    
    debug('Capturing guest data');
    await sleep(10);
    
    debug('Processing payment details');
    await sleep(10);
    
    debug(`Processing checkout date ${checkout}`);
    await sleep(10);
    
    debug(`Processing checkin date ${checkin}`);
    await sleep(10);
    
    debug('Finalizing reservation');
    await sleep(10);

    // Generate and output the confirmation number
    const confirmationNumber = generateConfirmationNumber();
    debug('Generated confirmation number', { confirmationNumber });
    
    // IMPORTANT: Only output the confirmation number to stdout, with no other text or debug info
    // This is what the server is looking for
    process.stdout.write(confirmationNumber);
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    debug('Error processing reservation', { error: error.message, stack: error.stack });
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the process
processReservation();