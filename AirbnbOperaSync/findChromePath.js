function findChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome Canary\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' // Edge as fallback
  ];
  
  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        console.log(`Found browser at: ${path}`);
        return path;
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  throw new Error('Could not find Chrome or compatible browser');
}

// Then use it in your script
const chromePath = findChromePath();
Once you find the path, update the chromePath variable in your automation script.RetryClaude can make mistakes. Please double-check responses.