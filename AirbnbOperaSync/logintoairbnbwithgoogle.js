const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

async function loginToAirbnbWithGoogle() {
  let client;
  
  try {
    // Launch Chrome with specific flags to avoid detection
    const { spawn } = require('child_process');
    const chromePath = process.platform === 'win32' 
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome';
    
    const chrome = spawn(chromePath, [
      '--remote-debugging-port=9222',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${path.join(__dirname, 'chrome-profile')}`,
      '--disable-dev-shm-usage'
    ]);
    
    // Wait for Chrome to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Connect to Chrome instance
    client = await CDP();
    const { Network, Page, Runtime, DOM, Emulation } = client;
    
    // Setup event handlers
    await Promise.all([
      Network.enable(),
      Page.enable(),
      DOM.enable(),
      Runtime.enable()
    ]);
    
    // Set user agent to appear more like a real browser
    await Network.setUserAgentOverride({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    
    // Modify navigator properties to avoid fingerprinting
    await Runtime.evaluate({
      expression: `
        // Overwrite the automation property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
        
        // Hide automation-related permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          if (parameters.name === 'notifications' || 
              parameters.name === 'midi' || 
              parameters.name === 'camera' || 
              parameters.name === 'microphone' || 
              parameters.name === 'geolocation' || 
              parameters.name === 'clipboard-read') {
            return Promise.resolve({ state: 'prompt', onchange: null });
          }
          return originalQuery(parameters);
        };
        
        // Emulate human-like behavior
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            return [1, 2, 3, 4, 5].map(() => {
              return {
                name: ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client'][Math.floor(Math.random() * 3)]
              };
            });
          }
        });
      `
    });
    
    console.log('Navigating to Airbnb...');
    await Page.navigate({ url: 'https://www.airbnb.com/' });
    await Page.loadEventFired();
    
    // Wait a bit to simulate human delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    console.log('Looking for login button...');
    // Click login with human-like delay
    await Runtime.evaluate({
      expression: `
        (() => {
          // Add human-like mouse movement
          const loginButton = document.querySelector('button[data-testid="cypress-headernav-login"]');
          if (loginButton) {
            // Create and dispatch events in a more realistic way
            const rect = loginButton.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // Mouse move
            const moveEvent = new MouseEvent('mousemove', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y
            });
            document.dispatchEvent(moveEvent);
            
            // Small delay
            setTimeout(() => {
              loginButton.click();
            }, ${Math.random() * 400 + 100});
          } else {
            console.log('Login button not found');
          }
        })()
      `
    });
    
    // Wait for the login modal
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 2000));
    
    console.log('Looking for Google login option...');
    // Click on Google login
    await Runtime.evaluate({
      expression: `
        (() => {
          const googleButton = document.querySelector('button[data-testid="social-auth-button-google"]');
          if (googleButton) {
            const rect = googleButton.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // Mouse move
            const moveEvent = new MouseEvent('mousemove', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y
            });
            document.dispatchEvent(moveEvent);
            
            // Click after short delay
            setTimeout(() => {
              googleButton.click();
            }, ${Math.random() * 400 + 100});
          } else {
            console.log('Google button not found');
          }
        })()
      `
    });
    
    // Wait for Google login page
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Entering Google credentials...');
    // Enter email with human-like typing
    await Runtime.evaluate({
      expression: `
        (() => {
          const emailInput = document.querySelector('input[type="email"]');
          if (emailInput) {
            emailInput.focus();
            // Type with random delays between each character
            const email = 'jatroskie@gmail.com';
            let index = 0;
            
            const typeNextChar = () => {
              if (index < email.length) {
                emailInput.value += email.charAt(index);
                const event = new Event('input', { bubbles: true });
                emailInput.dispatchEvent(event);
                index++;
                setTimeout(typeNextChar, ${Math.random() * 150 + 50});
              } else {
                // Click next after typing
                setTimeout(() => {
                  const nextButton = document.querySelector('#identifierNext');
                  if (nextButton) nextButton.click();
                }, ${Math.random() * 500 + 500});
              }
            };
            
            typeNextChar();
          } else {
            console.log('Email input not found');
          }
        })()
      `
    });
    
    // Wait for password field
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Enter password with human-like typing
    await Runtime.evaluate({
      expression: `
        (() => {
          const passwordInput = document.querySelector('input[type="password"]');
          if (passwordInput) {
            passwordInput.focus();
            // Type with random delays between each character
            const password = 'Tilda147#';
            let index = 0;
            
            const typeNextChar = () => {
              if (index < password.length) {
                passwordInput.value += password.charAt(index);
                const event = new Event('input', { bubbles: true });
                passwordInput.dispatchEvent(event);
                index++;
                setTimeout(typeNextChar, ${Math.random() * 200 + 100});
              } else {
                // Click next after typing
                setTimeout(() => {
                  const nextButton = document.querySelector('#passwordNext');
                  if (nextButton) nextButton.click();
                }, ${Math.random() * 800 + 700});
              }
            };
            
            typeNextChar();
          } else {
            console.log('Password input not found');
          }
        })()
      `
    });
    
    console.log('Waiting for login to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if login was successful
    const isLoggedIn = await Runtime.evaluate({
      expression: `
        (() => {
          return document.querySelector('[aria-label="Account"]') !== null;
        })()
      `
    });
    
    if (isLoggedIn.result.value) {
      console.log('Successfully logged in to Airbnb with Google!');
    } else {
      console.log('Login might have failed or detection occurred');
    }
    
    // Keep the browser open for manual inspection
    console.log('Browser will remain open for inspection');
    
  } catch (err) {
    console.error('Error during automation:', err);
  }
}

loginToAirbnbWithGoogle();