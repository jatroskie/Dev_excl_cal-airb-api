import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3DyO4oPHNPLWjwxUza%2FMgeGt%2BISEt1mduz49hIanhmNIzkqLLf6yMFdkNDmtKgNubHFvkRMRnMDxFONuHw61HkLa28%2B4de7OxKIPBT%2FcgUMWGiJ3WQXp1tYo381tzA3XqMa%2FK6z60PzcOunq42s0AuAuz98iO8eg593UxvOtaNvBruldtPKcP8Y4Q2fvnw4Wlso9xbVMnNS4HpTJdxCfDfQbbZFQfzoCD47QEV1XyEw8CjUnQmoa3kD9Ka%2FdNAjkaeEpFCh54GMU%2B5YsrMuPiOONaHfklCgnZ0o8ocRkAIhB4vIiNknR%2BRhfpF9wNgKNuvmhmYOQdtkiRBT3bWMwNvbVSaMLtj5QphqemPXddiou0Y5TR8o5GtJvzlMfCNQShS%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3Df1f935e970c71bca4a6ca0bfdb9a0dc1c7043d33&ECID-Context=1.006CDDLq8ab03zOUuilnWH0005aS0001mU%3BkXjE")
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
    page.get_by_role("link", name="Bookings").click()
    page.get_by_text("Reservations", exact=True).click()
    page.get_by_text("Look To Book Sales Screen").click()
    page.get_by_role("textbox", name="Travel Agent").click()
    page.get_by_role("textbox", name="Travel Agent").fill("airbnb")
    page.get_by_role("textbox", name="Arrival").click()
    page.locator("iframe[title=\"Content\"]").content_frame.get_by_role("button", name="Select").click()
    page.get_by_role("textbox", name="Arrival").click()
    page.get_by_role("textbox", name="Arrival").fill("15.05.2025")
    page.get_by_role("textbox", name="Departure").click()
    page.get_by_role("textbox", name="Departure").fill("18.05.2025")
    page.get_by_role("textbox", name="Adults").click()
    page.get_by_role("textbox", name="Adults").fill("2")
    page.get_by_role("link", name="New Profile").click()
    page.get_by_role("link", name="New Profile").click()
    page.get_by_role("dialog", name="Guest Profile").get_by_label("Name", exact=True).click()
    page.get_by_role("dialog", name="Guest Profile").get_by_label("Name", exact=True).fill("Troskie")
    page.get_by_role("textbox", name="First Name").click()
    page.get_by_role("textbox", name="First Name").fill("Johan")
    page.get_by_role("row", name="MOBILE Communication Type").get_by_label("Communication Value").click()
    page.get_by_role("gridcell", name="Communication Value Communication Value").get_by_label("Communication Value").fill("0828820100")
    page.get_by_role("button", name="Save and Select Profile").click()
    page.get_by_role("textbox", name="Room", exact=True).click()
    page.get_by_role("textbox", name="Room", exact=True).fill("0405")
    page.get_by_role("button", name="Search", exact=True).click()
    page.get_by_role("gridcell", name="Do Not Move").locator("label").nth(1).click()
    page.get_by_role("link", name="Select Room").click()
    page.get_by_role("button", name="Search", exact=True).click()
    page.locator("[id=\"pt1\\:oc_pg_pt\\:r1\\:1\\:ltbm\\:oc_scrn_tmpl_y9qqzw\\:r4\\:0\\:dl1\\:p1\\:occ_pnl\\:ltbavlrs\\:0\\:gts1\\:i1\\:0\\:gts2\\:i2\\:1\\:cb1\\:i3\\:0\\:cbi1\\:pgl8\"]").click()
    page.get_by_role("button", name="Select", exact=True).click()
    page.locator("[id=\"pt1\\:oc_pg_pt\\:r1\\:2\\:ltbbk\\:oc_pnl_cmp\\:oc_scrn_pnl_tmpl\\:oc_scrn_tmpl_zm34g1\\:oc_scrn_pnl_pnl\\:oc_pnl_tmpl_zm34g1\\:fe29\\:odec_flem_cntnt\"]").get_by_text("ZAR").click()
    page.get_by_role("textbox", name="Discount Amount").click()
    page.get_by_role("textbox", name="Discount Amount").click()
    page.get_by_role("textbox", name="Discount Amount").fill("370")
    page.get_by_role("textbox", name="Discount Code").click()
    page.get_by_role("textbox", name="Discount Code").fill("oth")
    page.get_by_role("button", name="Book Now").click()
    page.get_by_label("Method").select_option("FCA")
    page.get_by_role("button", name="Book Now").click()
    page.get_by_text("411243261").click()
    page.get_by_role("button", name="Exit Booking").click()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright