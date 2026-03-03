# Simulation Scenario 2: Automated Reservation Capture & Legacy System Sync

**Objective:** End-to-end simulation of receiving an Airbnb booking, syncing it to a legacy PMS (Opera), and engaging the guest.

---

## I. Data Layer (The "Actual" State)

### 1. Firestore Collections
Used for "Hot" data: Availability, Property profiles, and active task states.

**Collection:** `hotels`
```json
{
  "hotel_id": "WFV",
  "name": "Waterfront Village",
  "opera_resort_code": "WFV_01",
  "location": {
    "lat": -33.910,
    "lng": 18.420,
    "address": "Mind Pearl House, West Quay Road, V&A Waterfront"
  },
  "contacts": {
    "reception": "+27 21 555 1234",
    "emergency": "+27 82 555 9999"
  }
}
```

**Collection:** `rooms`
```json
{
  "room_id": "WFV-E003",
  "hotel_id": "WFV",
  "type": "1BED_LUX",
  "opera_room_type": "KNG",
  "mapping_ids": {
    "airbnb_listing_id": "18456732", 
    "booking_com_id": "99821_02"
  },
  "description": "Luxury 1 Bedroom Canal Facing"
}
```

### 2. PostgreSQL Schema (The "System of Record")
Used for structured, invariant records.

**Table:** `reservations`
```sql
CREATE TABLE reservations (
    res_uuid UUID PRIMARY KEY,
    platform_id VARCHAR(50), -- e.g., 'HM-QZ9921' (Airbnb Code)
    guest_name VARCHAR(100),
    check_in DATE,
    check_out DATE,
    property_code VARCHAR(20), -- 'WFV'
    room_number VARCHAR(20),   -- 'WFV-E003'
    opera_conf_number VARCHAR(50), -- Captured via automation
    status VARCHAR(20),        -- 'CAPTURED', 'SYNCED', 'CONFIRMED'
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## II. Process Simulation

### Phase 1: The Trigger (Airbnb Webhook)
**Event:** A new "Accepted" reservation arrives from Airbnb.
**Payload:**
```json
{
  "action": "reservation_accepted",
  "confirmation_code": "HM-QZ9921",
  "listing_id": "18456732",
  "start_date": "2025-11-10",
  "end_date": "2025-11-15",
  "guest": {
    "id": "gd_1029",
    "first_name": "Michael",
    "phone": "+1 555 0199"
  },
  "payout_price": {
    "amount": 1250.00,
    "currency": "USD"
  }
}
```

### Phase 2: `CaptureReservation` Microservice
**System Action:**
1.  Look up `listing_id` "18456732" in Firestore `rooms`.
    *   **Result:** Match Found -> `room_id`: "WFV-E003", `hotel_id`: "WFV".
2.  Insert record into Postgres `reservations`:
    ```sql
    INSERT INTO reservations (res_uuid, platform_id, guest_name, check_in, check_out, property_code, room_number, status)
    VALUES ('uuid-555', 'HM-QZ9921', 'Michael', '2025-11-10', '2025-11-15', 'WFV', 'WFV-E003', 'CAPTURED');
    ```

### Phase 3: `OperaAutomation` Agent (The "Robot Arms")
**Task:** Update the legacy Oracle Opera system which has no API.
**Mechanism:** Headless Browser (Playwright/Puppeteer) running in a Cloud Run container.

**Agent Execution Log (Simulation):**

1.  **Login:** Agent navigates to Opera web interface, inputs credentials.
2.  **Navigate:** Go to "Reservations" -> "New Reservation".
3.  **Input Data:**
    *   *Arrival:* 10-11-2025
    *   *Departure:* 15-11-2025
    *   *Room:* WFV-E003
    *   *Guest:* Michael [Last Name from Airbnb]
    *   *Rate:* $1250 (USD converted to ZAR)
4.  **Action:** Click "Save".
5.  **Output Extraction (OCR/DOM):**
    *   System displays popup: "Reservation created. Conf #: 8829103".
    *   Agent captures screenshot: `gs://bucket/reservations/HM-QZ9921_opera.png`.
    *   Agent parses text "8829103".
6.  **Callback:** Update Postgres.
    ```sql
    UPDATE reservations SET opera_conf_number = '8829103', status = 'SYNCED' WHERE platform_id = 'HM-QZ9921';
    ```

### Phase 4: Availability Update (Firebase)
Simultaneously, the system locks the dates to prevent double bookings on other channels (if not using a channel manager).

**Firestore Update:** `availability/WFV-E003`
```javascript
{
  "dates": {
    "2025-11-10": { "status": "booked", "source": "airbnb" },
    // ... dates in between ...
    "2025-11-14": { "status": "booked", "source": "airbnb" }
  }
}
```

---

## III. Interface Output: Guest Communication

### Phase 5: The Welcome Message
**Trigger:** `reservations` table update detected (status change to `SYNCED`).
**Logic:**
1.  Fetch Hotel Details from `hotels/WFV`.
2.  Fetch Room Code from `reservations`.
3.  Generate Message.

**Generated Message (WhatsApp/Airbnb Chat):**

> **Welcome to Waterfront Village, Michael!** 🇿🇦
>
> Your reservation is confirmed. We have blocked your dates for **Nov 10 - Nov 15**.
>
> **Your Booking Details:**
> *   **Confirmation:** HM-QZ9921 (Internal Ref: #8829103)
> *   **Property:** Waterfront Village
> *   **Apartment:** WFV-E003 (Luxury 1 Bedroom Canal Facing)
>
> **Getting Here:**
> 📍 *Mind Pearl House, West Quay Road, V&A Waterfront*
> [Google Maps Link]
>
> **Check-in Instructions:**
> You can check in at our reception desk (open 24/7) using your reference number.
>
> We look forward to hosting you!

---

## IV. Technical Implementation Snippets

### 1. Opera Automation Script (Python/Playwright)
```python
async def create_opera_reservation(details):
    page = await browser.new_page()
    await page.goto("https://opera-cloud.property.com/login")
    
    # Login Flow hidded
    await page.fill("#username", os.getenv("OPERA_USER"))
    await page.fill("#password", os.getenv("OPERA_PASS"))
    await page.click("#btn-login")

    # Entry Flow
    await page.click("text=New Reservation")
    await page.fill("input[name='arrival']", details['start_date'])
    await page.fill("input[name='room']", details['room_number'])
    
    # Save and Scrape
    await page.click("#save-booking")
    confirmation_element = await page.wait_for_selector(".confirmation-number")
    conf_num = await confirmation_element.inner_text()
    
    # Screenshot for Audit Trail
    await page.screenshot(path=f"/tmp/{details['id']}_confirmation.png")
    
    return conf_num
```
