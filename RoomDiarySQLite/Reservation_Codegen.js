import re
from playwright.sync_api import Playwright, sync_playwright, expect
const { loginToOperaCloud } = require('./login3');


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

def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3DMgcfGq0aLQ4ZOmeciJ2b8FPW3ZEb5Ihvx3Q%2BByQ81n6zeEkPXueCOugmBUsMb0duMdmBwkrSYR9jh5%2FtWXy0%2B56pZn0H2foFUfQ8KNKU9jKxsXGDQFsSg3VtuFGbEOarolqLZpc%2F3IREG2OqSHH2POsZTSxdokTnu%2Fntc77bGIri1rSJTTymr6S%2FI1g6Z5wg8oiiphtPt7qWTy2ewd3LyGEwckBbO0gPjvMJqRZLqc98Ehr%2F6vXsWwcUfHbtMh3a7ZGnbJhB1DPk2WO6qWM8Q0khz3JJOydjguh7gLs2nSsgoDdoe1g6q9ptt3kdPzaTLlGtiIgYp5fJVoR%2BBPUFEdpVkvslxRd8dlSEsB2BiahWYg7SY73bDdbLYbNPOfAg%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D6ef489179f263e4bf51c28217660a82ac00b0465&ECID-Context=1.006CCUpySg703zOUuipmWH0006n50000UJ%3BkXjE")
    page.get_by_role("textbox", name="User Name").click()
    page.get_by_role("textbox", name="User Name").fill("johant")
    page.get_by_role("textbox", name="Password").click()
    page.get_by_role("textbox", name="Password").fill("Dexter123456#")
    page.get_by_role("button", name="Sign In").click()
    page.get_by_role("link", name="Click to go to OPERA Cloud").click()
    with page.expect_popup() as page1_info:
        page.goto("https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/adf.task-flow?adf.tfId=opera-cloud-index&adf.tfDoc=/WEB-INF/taskflows/opera-cloud-index.xml")
    page1 = page1_info.value
    page1.close()
    page.goto("https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud")
    timeout: 60000 
    page.get_by_role("link", name="Bookings").click()

    await bookingsMenuItem.click();
    console.log('Bookings menu clicked successfully.');
    await page.waitForTimeout(2000);


    //page.get_by_text("Reservations", exact=True).click()
     // Look for Reservations submenu - use the exact table structure from the HTML
     console.log('Clicking Reservations submenu...');
     const reservationsMenuItem = page.locator('tr[role="menuitem"] td:has-text("Reservations")').first();
     await reservationsMenuItem.waitFor({ state: 'visible', timeout: 10000 });
     await reservationsMenuItem.click();

    page.get_by_text("Look To Book Sales Screen").click()
    await page.waitForTimeout(2000);

    page.get_by_role("textbox", name="Travel Agent").click()
    page.get_by_role("textbox", name="Travel Agent").fill("airbnb")
    page.locator("div").filter(has_text=re.compile(r"^Travel AgentSource$")).get_by_role("link").first.click()

    page.locator("iframe[title=\"Content\"]").content_frame.locator("[id=\"pt1\\:oc_srch_lov_tmpl\\:r1\\:0\\:pt1\\:oc_srch_tmpl_esmin1\\:ode_bscrn_tmpl\\:lkuprgn\\:0\\:pt1\\:oc_srch_rslts_tbl_tmpl\\:ab1\\:odec_axn_br_axns_pstv_i\\:0\\:odec_axn_br_axn_pstv\"]").click()
    page.get_by_role("link", name="New Profile").click()
    page.get_by_role("dialog", name="Guest Profile").get_by_label("Name", exact=True).click()
    page.get_by_role("dialog", name="Guest Profile").get_by_label("Name", exact=True).fill("Troskie")
    page.get_by_role("textbox", name="First Name").click()
    page.get_by_role("textbox", name="First Name").fill("Johan")
    page.get_by_role("row", name="MOBILE Communication Type").get_by_label("Communication Value").click()
    page.get_by_role("gridcell", name="Communication Value Communication Value").get_by_label("Communication Value").fill("0828820100")
    page.get_by_role("button", name="Save and Select Profile").click()
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
    page.get_by_role("textbox", name="Adults").fill("2")
    
    const roomInput = page.getByRole('textbox', { name: 'Room' }).nth(0);
    await roomInput.click();
    await roomInput.fill(roomNumber);

    page.get_by_role("button", name="Search", exact=True).click()
    page.get_by_label("Room Details").get_by_role("button", name="Search", exact=True).click()
    page.get_by_role("link", name="Modify Search Criteria").click()
    page.get_by_role("dialog", name="Room Details").get_by_label("Room", exact=True).click()
    page.get_by_role("dialog", name="Room Details").get_by_label("Room", exact=True).fill("0420")
    page.get_by_label("Room Details").get_by_role("button", name="Search", exact=True).click()
    page.get_by_role("link", name="Select Room").click()
    page.get_by_role("button", name="Search", exact=True).click()
    page.locator("[id=\"pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8\"]").click()
    
    page.get_by_role("button", name="Select", exact=True).click()
    page.get_by_role("textbox", name="Discount Amount").click()
    page.get_by_role("textbox", name="Discount Amount").fill("368")
    page.get_by_role("textbox", name="Discount Code").click()
    page.get_by_role("textbox", name="Discount Code").fill("oth")
    page.get_by_label("Method").select_option("FCA")
    page.get_by_role("button", name="Book Now").click()
    page.get_by_role("link", name="Notes (1)").click()
    page.get_by_role("link", name="New").click()
    page.get_by_role("textbox", name="Type").click()
    page.get_by_role("textbox", name="Type").fill("PAY")
    page.get_by_role("textbox", name="Comment").click()
    page.get_by_role("textbox", name="Comment").click()
    page.get_by_role("textbox", name="Comment").fill("Johan Troskie - AirBnB")
    page.locator("div").filter(has_text=re.compile(r"^Save$")).click()
    page.get_by_role("link", name="Close").click()
    page.get_by_role("button", name="Exit Booking").click()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
