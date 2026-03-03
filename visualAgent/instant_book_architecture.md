# Executive Summary: The "Instant-Book" Shift

The core shift in this architecture is moving from a **Passive/Lagging Synchronization** model (Opera syncing to Firestore every 2-3 hours via iCal) to an **Active/Real-Time Event** model.

By making **Firestore the "Source of Truth,"** we enable the Airbnb API immediately. This eliminates the risk of "Instant Book" double-bookings because the availability check happens against Firestore (milliseconds) rather than waiting for an Opera sync (hours).

---

## 1. High-Level Architectural Pattern

We will utilize **Pattern 4: Event-Driven State Management** (from your MuleSoft reference).

*   **The Event Bus:** Google Eventarc (triggered by Firestore writes).
*   **The State Store:** Firestore (Single Source of Truth).
*   **The Services:** Agentic Microservices (Cloud Run) that react to state changes.

---

## 2. Microservice Hosting & Communication

### A. The "Gatekeeper" Service (Ingestion & Availability)
*   **Type:** Cloud Run (Python/FastAPI).
*   **Trigger:**
    1.  **Airbnb Webhook:** Incoming reservation.
    2.  **Airbnb Availability Check:** Real-time query from Airbnb (Availability API).
*   **Logic:**
    *   When Airbnb queries "Is Room X free?", the Gatekeeper queries the **Firestore Availability Pool** (not Opera).
    *   If free, it returns `TRUE`.
    *   If a booking occurs, it instantly writes to Firestore and decrements the pool.
*   **Strategic Change:** This replaces the reliance on robots collecting `.ics` files. Availability is now "Push" (API) rather than "Pull" (iCal scrape).

### B. The "Legacy Sync" Service (iCal Generator)
*   **Type:** Cloud Functions (Serverless).
*   **Context:** While Airbnb moves to API, Booking.com (and others) may still rely on iCal temporarily or permanently until moved.
*   **Function:** `GET /ical/{room_id}.ics`
*   **Logic:**
    *   Instead of serving a static file generated every 3 hours, this function **dynamically generates the iCal data from Firestore** at the moment of the request.
*   **Result:** Even Booking.com gets near-real-time availability, drastically reducing double-booking risks compared to the old 3-hour window.

### C. The "Integrator" Service (Opera Write-Back)
*   **Type:** Agentic Microservice (Cloud Run + Vertex AI).
*   **Trigger:** `Firestore.onUpdate` (Status: ACCEPTED).
*   **Role:** The "Writer."
*   **Logic Options (Per your note):**
    1.  **API Mode:** If Opera has an exposed API, push the JSON payload.
    2.  **Visual Agent Mode (Web Automation):** If no API, the Agent launches a headless browser (Puppeteer/Playwright), logs into Opera, and physically "types" the reservation details.
    3.  **Human Routing:** If the Agent fails or confidence is low, it flags the dashboard for a human to manually enter into Opera.

---

## 3. Data Architecture (Firestore Schema)

To handle the "Unallocated" logic (Booking.com room types vs. Airbnb specific rooms), we use a **Ledger-Based Inventory** approach in Firestore.

*   **Collection:** `inventory_ledger`
*   **Document ID:** `{date}_{room_type_id}`
*   **Fields:**
    *   `total_physical_units`: 10
    *   `hard_allocated_ids`: `["room_101", "room_102"]` (Airbnb specific bookings)
    *   `soft_allocated_count`: 3 (Booking.com "Run of House" bookings)
    *   `blocked_maintenance`: 0
    *   `calculated_availability`: 5 (10 - 2 - 3 - 0)

### The "Ghost" Allocation Logic:
When a generic Booking.com reservation arrives (via legacy sync):
1.  It is written to Firestore with `room_id: null`.
2.  The `soft_allocated_count` increases.
3.  **Crucial:** The Gatekeeper Service sees `calculated_availability` drop. If it hits 0, it sends a **Stop Sell signal** to the Airbnb API immediately, even if specific room numbers (like Room 105) technically look empty in Opera.

---

## 4. Visual Dashboard ("Flight Control")

*   **Tech:** Next.js + Firestore `onSnapshot` (Real-time).

### A. Interaction Design: "Human-in-the-Loop"
The Dashboard is not for data entry; it is for **State Resolution**.

*   **State: RED (Conflict/Unsynced)**
    *   **Scenario:** Airbnb booked instantly, but the Agent could not write it to Opera (e.g., Opera was down or locked).
    *   **UI:** The Reservation Card pulses Red.
    *   **Action:** User clicks the card.
    *   **Context:** The "Trace" tab shows: *Agent: "I attempted to login to Opera but verified a timeout."*
    *   **Resolution:** User manually enters booking in Opera, then clicks a button "Manually Synced" on the dashboard. The card turns Green.

*   **State: BLUE (Unallocated)**
    *   **Scenario:** Booking.com reservation exists but has no room number.
    *   **UI:** These sit in a specific "Unallocated" swimlane.
    *   **Action:** User (or Agent) drags and drops the card onto a specific room row (e.g., Room 104).
    *   **Backend:** This updates Firestore `hard_allocated_ids` and decreases `soft_allocated_count`.

### B. The Audit Trace (Trusting the Agent)
Since we are using "Agentic" services (Vertex AI), we must visualize their "thinking" to build trust.

**The "Brain" Panel:** On any reservation, a staff member can view the logic log:
> 10:05:01 - Received Booking Payload.
> 10:05:02 - Checked Inventory Ledger. Availability = YES.
> 10:05:03 - Locked Inventory.
> 10:05:05 - Pushed to Airbnb API: Success.
> 10:05:06 - Attempting Opera Sync...

---

## 5. Summary of Analysis & Benefits

### Immediate Revenue Impact:
*   **Old Way:** Delays in syncing meant you couldn't trust "Instant Book," losing impulse buyers.
*   **New Way:** **Firestore is the master.** We trust the database, enabling Airbnb Instant Book with 100% confidence.

### Solving the "Unallocated" Risk:
By calculating availability using the "Inventory Ledger" formula (Physical - Specific - Unallocated), we prevent overbooking. Even if Room 105 looks empty, if there is a "floater" reservation from Booking.com, the system knows Room 105 is effectively taken.

### Audit & Compliance:
Using Firestore subcollections for `audit_logs` ensures that whether an Agent, a Human, or an API made a change, it is recorded. This is superior to Opera's logs which are often opaque regarding API changes.

### Legacy Bridge:
We don't have to kill Opera today. We treat Opera as a **"Subscriber"** to Firestore. This allows TPF to modernize the customer experience (Instant Book) immediately, while slowly migrating the back-office admin away from Opera over time.
