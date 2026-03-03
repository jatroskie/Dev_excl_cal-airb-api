from playwright.sync_api import sync_playwright
import time

def login_to_airbnb(username, password):
    with sync_playwright() as p:
        # Use a persistent context instead of incognito
        browser = p.chromium.launch_persistent_context(
            "./user-data-dir",
            headless=False,  # Set to True in production
            slow_mo=50  # Slow down operations (remove in production)
        )
        
        page = browser.new_page()
        
        try:
            # Navigate to Airbnb
            page.goto('https://www.airbnb.com/')
            
            # Click on the login button
            page.click('button[data-testid="cypress-headernav-login"]')
            
            # Wait for the login modal to appear
            page.wait_for_selector('div[data-testid="login-signup-modal"]')
            
            # Click on "Continue with email"
            page.click('button[data-testid="social-auth-button-email"]')
            
            # Enter email
            page.fill('input[id="jatroskie@gmail.com"]', username)
            
            # Click continue
            page.click('button[data-testid="signup-login-submit-btn"]')
            
            # Wait for password field and enter password
            page.wait_for_selector('input[id="email-signup-password"]')
            page.fill('input[id="email-signup-password"]', password)
            
            # Click login button
            page.click('button[data-testid="signup-login-submit-btn"]')
            
            # Wait for login to complete
            page.wait_for_selector('button[data-testid="user-profile-menu-button"]', timeout=60000)
            
            print('Successfully logged in to Airbnb')
            
            # Here you can add code to extract calendar data
            # ...
            
            return browser, page
            
        except Exception as e:
            print(f"Error during login: {e}")
            browser.close()
            raise e

# Example usage
if __name__ == "__main__":
    try:
        browser, page = login_to_airbnb('your-email@example.com', 'your-password')
        
        # Add your calendar sync code here
        
        # Uncomment to close browser when done
        # browser.close()
        
    except Exception as e:
        print(f"Failed to run the script: {e}")+