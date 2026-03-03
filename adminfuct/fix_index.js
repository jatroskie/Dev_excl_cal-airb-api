const fs = require('fs');
const filePath = 'functions/index.js';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n'); // Split by newline

    // Start removal at line 661 (index 660)
    // End removal at line 747 (index 746)
    // We want to keep line 660 (index 659) and line 748 (index 747).

    // Check if line 661 is indeed '        }'
    if (!lines[660].includes('}')) {
        console.error('Line 661 check failed:', lines[660]);
        // Don't exit, might differ by whitespace
    }

    // Check if line 748 is .https.onRequest
    if (!lines[747].includes('.https.onRequest')) {
        console.error('Line 748 check failed:', lines[747]);
    }

    // Remove lines 661 to 747
    // Splice args: start index, count
    // Count = 747 - 661 + 1 = 87 lines

    // Wait, the output showed line numbers.
    // Let's verify context.
    // Line 660: .runWith...
    // Line 748: .https.onRequest...

    // So we remove everything BETWEEN them.
    // Indices to remove: 660 to 746 (0-indexed). 
    // Wait. Line 661 is index 660. Line 747 is index 746.

    lines.splice(660, 747 - 660);

    const newData = lines.join('\n');
    fs.writeFileSync(filePath, newData, 'utf8');
    console.log('Successfully fixed index.js');
} catch (e) {
    console.error('Failed:', e);
}
