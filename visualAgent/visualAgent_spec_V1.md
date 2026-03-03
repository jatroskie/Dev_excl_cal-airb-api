# Agentic AI PMS: Specification & Workflow Architecture

## 1. System Overview
**"Visual Management, Agentic Execution"**

The core philosophy of this system is **Hybrid Automation**.

*   **The "Agents" (AI/Bots):** Execute the routine, linear tasks (data entry, emails, syncing) in the background.
*   **The "Dashboard" (Visual):** A control tower for the Human Operator. It does not demand data entry; instead, it displays the status of the Agents. The human only intervenes when an Agent reports an "Anomaly" or "Delay" (Manage by Exception).

---

## 2. The Triggers & Workflows

### Phase 1: The Booking Event

**Trigger:** New Reservation Webhook (e.g., from Airbnb/Booking.com)

**Agent Task 1: "The Gatekeeper" (Auto-Responder)**
*   **Action:** Validate availability consistency.
*   **Action:** Send "Auto-Accept" signal to OTA (if consistent).
*   **Action:** Create Reservation Record in Google Cloud SQL for PostgreSQL with status `NEW`.

**Agent Task 2: "The Integrator" (Opera Sync)**
*   **Input:** Reservation Record
*   **Action:** Log into Opera (or use API).
*   **Action:** Create profile & booking.
*   **Visual Proof:** Capture Screen Print of the confirmation screen.
*   **Data Extraction:** Extract Opera Confirmation Number via OCR or DOM scraping.
*   **Output:** Update Google Cloud SQL for PostgreSQL Record with Opera Conf # and attach Screen Print.
*   **Anomaly:** If Opera is down or rate mismatch -> Mark as "NEEDS REVIEW" on Dashboard.

**Agent Task 3: "The Concierge" (Initial Confirmation)**
*   **Trigger:** Successful completion of Task 2.
*   **Action:** Compile Booking Details + Opera Conf #.
*   **Action:** Send Multi-channel Confirmation:
    *   *OTA Platform:* Send confirmation message via OTA platform.
    *   *Email:* Professional HTML template.
    *   *WhatsApp:* Friendly short message.
    *   *SMS:* Failover notification.
*   **Update:** Mark `Confirmation Sent = TRUE`.

### Phase 2: The Pre-Arrival Countdown

**Agent Task 4: "The Guide" (T-Minus 3 Days)**
*   **Trigger:** Schedule (Check-in Date - 3 Days).
*   **Action:** Send "Property Guide":
    *   Link to pre-arrival check-in app.
    *   Google Maps Location.
    *   Parking Instructions.
    *   Complex Rules.
    *   Lockbox / Key collection info (if static).
*   **Update:** Log `Guide Sent` timestamp.

**Agent Task 5: "The Receptionist" (T-Minus 1 Day)**
*   **Trigger:** Schedule (Check-in Date - 1 Day).
*   **Action (Guest):**
    *   Check pre-arrival app data for completion of required check-in data ETA time.
        *   If not completed, send message to guest to enquire about ETA.         
        *   ID/Passport Upload.
        *   Address/Details confirmation.
    *   Send Secure Check-in Link (QR Code).
*   **Action (Staff):**
    *   Email/WhatsApp Reception Desk with "Incoming Guest List" for tomorrow.
*   **Update:** Set `Ready for Check-in` status.

### Phase 3: The Stay & Departure (Optional Extensions)
*   **Agent Task 6:** Check-out instructions (morning of departure).
*   **Agent Task 7:** Review solicitation (after departure).

---

## 3. The Visual Dashboard (The "Control Tower")
This is where the Human Operator spends their day. It is not a data entry screen. It is a **Status Board**.

**Visual Metaphor:** Kanban or "Flight Control" Board
**Rows:** Reservations (Sorted by Urgency/Date). **Columns:** The Workflow Steps (Agents).

| Guest Name | Arr Date | Step 1: OTA | Step 2: Opera | Step 3: Confirm | Step 4: Guide (T-3) | Step 5: Check-in (T-1) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| John Doe | Jan 20 | ✅ Accepted | ✅ Conf: #12345 (View Image) | ✅ WhatsApp Sent | ⏳ Pending (T-3) | ⏳ Pending (T-1) | 🟢 On Track |
| Jane Smith | Jan 21 | ✅ Accepted | ❌ ERROR: Rate Mismatch | ⏸️ Held | ⏸️ Held | ⏸️ Held | 🔴 ACTION REQ |
| Bob Jones | Jan 18 | ✅ Accepted | ✅ Conf: #67890 | ✅ Email Sent | ✅ Sent | ⚠️ No ETA Reply | 🟡 Warning |

**Human Interactions:**
*   **Green (On Track):** Ignore. The Agents are working.
*   **Red (Action Req):** Click the cell. "Agent says: Opera Rate was $100, Airbnb was $80. Automation stopped." -> Human logs in, fixes rate, clicks "Retry Agent".
*   **Yellow (Warning):** "Guest hasn't opened WhatsApp". Human decides to call manually.

---

**Visual Layer (Frontend):**
*   **Framework:** Custom Web App (Next.js / React).
*   **Design:** Bespoke "Control Tower" Dashboard using the "Visual Management" philosophy.

**The Agents (Backend):**
*   **Opera Scraper:** A Puppeteer/Playwright script running in a container.
*   **WhatsApp Bot:** Twilio or Meta Business API integration.
*   **ID Verifier:** Integration with an ID verification API (or AI Vision model).

---

# [Appendix] Previous Draft: Autonomous Agent Monitoring Service (Legacy)
*(Retained for reference on specialized tracing metrics)*

## Executive Summary
This document outlines the architecture for a centralized monitoring service designed to observe distributed microservices (specifically autonomous agentic LLMs) throughout the lifecycle of an apartment booking. The system prioritizes **semantic observability**—analyzing not just if a service is running, but if it is *thinking* and *acting* correctly.

## High-Level Architecture
The system utilizes an **Event-Driven Architecture** where agents emit rich telemetry data to an observability pipeline.

### Core Components
1.  **Agentic Microservices (The Sources):**
    * Specialized LLM wrappers (e.g., *Inquiry Handler*, *Booking Negotiator*, *Maintenance Scheduler*).
    * Each agent is equipped with a **Telemetry Sidecar** to capture inputs, outputs, and intermediate reasoning steps (Chain-of-Thought).
2.  **Observer/Evaluator Service:**
    * An asynchronous "LLM-as-a-Judge" service.
    * Scores agent outputs for hallucination, sentiment, and policy adherence.
3.  **Data Storage Layer:**
    * **Timeseries DB (TSDB):** For numerical metrics (latency, token usage, error rates).
    * **Vector Database:** For semantic logs (storing conversation embeddings to cluster "similar failures").
4.  **Dashboard UI:** The visualization layer for operations teams.

---

## Monitoring States & Metrics

### Lifecycle Statuses (Explicit)
These states are explicitly emitted by agents during their workflow.

* **`INITIATED`**: Trigger received (e.g., webhook from OTA, email ingress). Agent reasoning loop started.
* **`RECEIVED`**: External data ingestion point (e.g., receiving SQL query results or external API payloads).
* **`UNABLE_TO_PROCEED` (Blocker)**: Agent lacks information or tool capability to continue.
* **`REFERRED` (Human-in-the-Loop)**: 
    * Safety guardrail triggered.
    * Confidence score < Threshold (e.g., 0.7).
    * Sensitive topic detected.
* **`EXECUTED/COMPLETED`**: Final business action committed (e.g., "Reservation Created" in PMS).

### Derived Metrics (Implicit)
These metrics are calculated by the Observer Service by analyzing the trace data.

| Metric | Derivation Logic | Alert Severity |
| :--- | :--- | :--- |
| **Cognitive Looping** | Agent executes the same tool or generates identical reasoning >3 times sequentially. | **CRITICAL** |
| **Sentiment Decay** | Delta between User Sentiment $(t_0)$ and $(t_{current})$. Negative drift implies frustration. | **WARNING** |
| **Hallucination Risk** | "Observer" LLM cross-references agent claims against the Property Knowledge Base. | **HIGH** |
| **Tool Rot** | High error rate (`4xx`/`5xx`) specifically from tool outputs (e.g., Calendar API) despite valid agent requests. | **MEDIUM** |
| **Token Burn Rate** | Ratio: $\frac{\text{Total Tokens Consumed}}{\text{Successful Outcome}}$. | **INFO** |

---

## Data Schema: The Agent Trace
Logs are structured as rich JSON objects (Traces) rather than flat text lines.

```json
{
  "trace_id": "booking-uuid-5521-ax9",
  "agent_id": "negotiator-agent-v2",
  "timestamp": "2025-10-24T08:30:00Z",
  "lifecycle_event": "STEP_COMPLETE",
  "status": "IN_PROGRESS",
  "context": {
    "booking_stage": "negotiation",
    "property_id": "prop_001",
    "platform": "Airbnb"
  },
  "llm_stats": {
    "model": "gpt-4-turbo",
    "input_tokens": 450,
    "output_tokens": 120,
    "latency_ms": 1200,
    "total_cost_usd": 0.015
  },
  "derived_signals": {
    "sentiment_score": -0.2, 
    "loop_count": 0,
    "confidence_score": 0.88,
    "observer_flag": "none"
  }
}
```

## Recommended Technology Stack
*   **Instrumentation:** OpenTelemetry (Python SDK).
*   **LLM Observability:** Arize Phoenix.
*   **Analytics DB:** ClickHouse (for high-volume log aggregation).
*   **Visualization:** Grafana (Metrics) + Streamlit/React (Trace Inspector).

---


# [Appendix] Detailed Simulated Scenarios

## Autonomous Booking Agent Lifecycle Simulation

This detailed simulation covers the full lifecycle of an autonomous booking agent handling a guest inquiry. It is broken down into Data Layer, Process Simulation, and Interface Output.

### I. The Data Layer (Firestore & Vector Store)

Before the agent can "think," it needs a structured memory. This is the Knowledge Graph the LLM queries.

#### 1. Property Document (Firestore)

**Path:** `properties/prop_104_oceanview`

**JSON**
```json
{
  "property_id": "prop_104",
  "name": "Oceanview Penthouse 104",
  "address": {
    "street": "123 Coastal Hwy",
    "city": "Cape Town",
    "zip": "8001"
  },
  "logistics": {
    "wifi_ssid": "OceanView_Guest",
    "wifi_pass": "SeaBreeze2025",
    "check_in_time": "15:00",
    "key_box_code": "4491"
  },
  "amenities": ["pool", "gym", "nespresso_machine", "ocean_view_balcony"],
  "house_rules": {
    "pets": false,
    "smoking": false,
    "quiet_hours": "22:00 - 08:00"
  },
  "media": {
    "cover_photo": "gs://bucket/prop_104/cover.jpg",
    "guide_pdf": "gs://bucket/prop_104/guide_v2.pdf"
  }
}
```

#### 2. Vector Knowledge Base (Embeddings)

**Use Case:** The agent searches this for fuzzy questions like "Is it safe for kids?" or "How far is the airport?"

*   **Chunk 1:** "The balcony has a glass railing that is 1.2m high, making it safe for children under supervision."
*   **Chunk 2:** "Directions from CPT Airport: Take N2 Highway towards City Bowl. Approx 20 mins by Uber ($15)."

### II. Process Simulation: The "Inquiry" Lifecycle

#### Phase 1: The Trigger (Ingestion)

*   **Event:** A potential guest, "Sarah," sends a message via Airbnb/WhatsApp.
*   **Input Payload (Webhook):**

**JSON**
```json
{
  "event_type": "inquiry_new",
  "platform": "airbnb",
  "guest_id": "guest_559",
  "message": "Hi! We land at CPT around 10 PM. Is late check-in okay? Also, is there a coffee machine?",
  "timestamp": "2025-10-24T14:30:00Z"
}
```

#### Phase 2: The "Thinking" Phase (Agent Execution)

Here is the Chain-of-Thought (CoT) trace generated by the Agentic LLM as it processes the request.

**INTERNAL MONOLOGUE (The "Brain"):**

1.  **Analyze Intent:** User is asking two questions: (1) Logistics (Late Check-in) and (2) Amenities (Coffee Machine).
2.  **Tool Call 1 (Get Property Details):** I need to check the check_in_method for property prop_104.
    *   **Result:** "Self check-in via Keybox. Code is available 24/7."
    *   **Inference:** Late check-in is fine because it is automated.
3.  **Tool Call 2 (Search Amenities):** Checking amenities list.
    *   **Result:** Found "nespresso_machine".
4.  **Formulate Answer:** Combine these facts into a warm, helpful response.
5.  **Safety Check:** Did the user ask for a discount? No. Proceed.

**Agent Output (Structured JSON):**

The agent does not just output text; it outputs a Action Object.

**JSON**
```json
{
  "action": "reply_message",
  "confidence": 0.98,
  "reasoning_trace": "Confirmed self-checkin allows late arrival. Confirmed Nespresso presence.",
  "response_content": {
    "text": "Hi Sarah! Yes, late check-in is absolutely fine. We have a **self-check-in keybox** so you can arrive anytime after 3 PM without stress.\n\nAnd yes, there is a **Nespresso machine** in the kitchen with a starter pack of pods waiting for you! ☕",
    "attachments": [
      {
        "type": "image",
        "url": "gs://bucket/prop_104/kitchen_coffee.jpg",
        "alt_text": "The Nespresso station in the kitchen"
      }
    ]
  }
}
```

#### Phase 3: The Dashboard Interface (Monitoring)

This is what you (the operator) see on the monitoring dashboard for this specific interaction.

*   **Status:** COMPLETED 🟢
*   **Latency:** 1.2s
*   **Cost:** $0.004

| Step | Action | Detail |
| :--- | :--- | :--- |
| 1 | INPUT | "Hi! We land at CPT around 10 PM..." |
| 2 | SEARCH | `vector_db.query("late check in policy")` → Match: "Keybox 24/7" |
| 3 | SEARCH | `firestore.get("amenities")` → Match: "Nespresso Machine" |
| 4 | OUTPUT | Generated response confirming Keybox and Coffee. |

### III. The User Interface (What the Guest Sees)

The JSON output from Phase 2 is rendered by the platform (e.g., WhatsApp or a Custom App).

**Visual Rendering:**

> **Host (AI Assistant)**
>
> Hi Sarah! 👋
>
> Yes, late check-in is absolutely fine. We have a self-check-in keybox so you can arrive anytime after 3 PM without stress.
>
> And yes, there is a Nespresso machine in the kitchen with a starter pack of pods waiting for you! ☕
>
> *Sent 1 minute ago*

---

## Simulation Scenario 2: Automated Reservation Capture & Legacy System Sync

**Objective:** End-to-end simulation of receiving an Airbnb booking, syncing it to a legacy PMS (Opera), and engaging the guest.

### I. Data Layer (The "Actual" State)

#### 1. Firestore Collections
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

#### 2. PostgreSQL Schema (The "System of Record")
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

### II. Process Simulation

#### Phase 1: The Trigger (Airbnb Webhook)
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

#### Phase 2: `CaptureReservation` Microservice
**System Action:**
1.  Look up `listing_id` "18456732" in Firestore `rooms`.
    *   **Result:** Match Found -> `room_id`: "WFV-E003", `hotel_id`: "WFV".
2.  Insert record into Postgres `reservations`:
    ```sql
    INSERT INTO reservations (res_uuid, platform_id, guest_name, check_in, check_out, property_code, room_number, status)
    VALUES ('uuid-555', 'HM-QZ9921', 'Michael', '2025-11-10', '2025-11-15', 'WFV', 'WFV-E003', 'CAPTURED');
    ```

#### Phase 3: `OperaAutomation` Agent (The "Robot Arms")
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

#### Phase 4: Availability Update (Firebase)
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

### III. Interface Output: Guest Communication

#### Phase 5: The Welcome Message
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

### IV. Technical Implementation Snippets

#### 1. Opera Automation Script (Python/Playwright)
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
