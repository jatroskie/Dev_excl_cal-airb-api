# Agentic AI PMS: Specification & Workflow Architecture
**Version:** 2.0 (Consolidated)
**Status:** Draft / Active

## 1. System Overview
**"Visual Management, Agentic Execution"**

The core philosophy of this system is **Hybrid Automation**.

*   **The "Agents" (AI/Bots):** Execute the routine, linear tasks (data entry, emails, syncing) in the background.
*   **The "Dashboard" (Visual):** A control tower for the Human Operator. It does not demand data entry; instead, it displays the status of the Agents. The human only intervenes when an Agent reports an "Anomaly" or "Delay" (Manage by Exception).

---

## 2. Technology Stack (The "Build")

A minimal, low-maintenance stack designed for scale and simplicity.

### 2.1 Core Infrastructure
*   **Orchestrator:** **Temporal.io**.
    *   *Role:* Managing the state of long-running workflows (e.g., "Wait 3 days"). It serves as the "Clock" and "State Machine".
*   **Compute:** **Google Cloud Run**.
    *   *Role:* Hosting the stateless Python agents (the workers) and the Next.js frontend.
*   **Data Layer:** **Google Cloud SQL (PostgreSQL)**.
    *   *Role:* The Single Source of Truth. It stores:
        *   Business Data (`reservations` table).
        *   JSON Blobs for Availability/Room Metadata (replacing Firestore).
        *   Agent Logs for the dashboard.

### 2.2 Frontend (The "Control Tower")
*   **Framework:** **Next.js (React)**.
*   **Design:** Bespoke "Flight Control" Dashboard.
*   **Metric Visualization:** embedded directly in the React app using standardized charting libraries (Recharts/Visx), pulling directly from Postgres.

### 2.3 AI & Observability
*   **Agents:** Python + LangChain.
*   **Observability:** **Arize Phoenix** (Open Source).
    *   *Role:* The "Flight Recorder" for debugging LLM thoughts.
    *   *Deployment:* Self-hosted container on Cloud Run.

---

## 3. The Triggers & Workflows

### Phase 1: The Booking Event

**Trigger:** New Reservation Webhook (e.g., from Airbnb/Booking.com)

**Agent Task 1: "The Gatekeeper" (Auto-Responder)**
*   **Action:** Validate availability consistency.
*   **Action:** Send "Auto-Accept" signal to OTA (if consistent).
*   **Action:** Create Reservation Record in Google Cloud SQL with status `NEW`.

**Agent Task 2: "The Integrator" (Opera Sync)**
*   **Input:** Reservation Record from Cloud SQL.
*   **Action:** Log into Opera (via Headless Browser on Cloud Run).
*   **Action:** Create profile & booking.
*   **Visual Proof:** Capture Screen Print of the confirmation screen.
*   **Data Extraction:** Extract Opera Confirmation Number via OCR.
*   **Output:** Update Cloud SQL Record with Opera Conf # and attach Screen Print.
*   **Anomaly:** If Opera is down or rate mismatch -> Mark as "NEEDS REVIEW".

**Agent Task 3: "The Concierge" (Initial Confirmation)**
*   **Trigger:** Successful completion of Task 2.
*   **Action:** Compile Booking Details + Opera Conf #.
*   **Action:** Send Multi-channel Confirmation:
    *   *OTA Platform:* Send confirmation message.
    *   *Email:* Professional HTML template.
    *   *WhatsApp:* Friendly short message.
    *   *SMS:* Failover.
*   **Update:** Mark `Confirmation Sent = TRUE` in Cloud SQL.

### Phase 2: The Pre-Arrival Countdown

**Agent Task 4: "The Guide" (T-Minus 3 Days)**
*   **Trigger:** Temporal Schedule.
*   **Action:** Send "Property Guide" via WhatsApp/Email:
    *   Link to pre-arrival check-in app.
    *   Google Maps Location.
    *   Lockbox / Key collection info.
*   **Update:** Log `Guide Sent` timestamp.

**Agent Task 5: "The Receptionist" (T-Minus 1 Day)**
*   **Trigger:** Temporal Schedule.
*   **Action (Guest):**
    *   Check pre-arrival app data (in Cloud SQL) for completion.
    *   If incomplete: specialized AI message to nudge guest.
    *   Send Secure Check-in Link (QR Code).
*   **Action (Staff):**
    *   Digest Email to Reception Desk with "Incoming Guest List".
*   **Update:** Set `Ready for Check-in` status.

---

## 4. The Visual Dashboard (UI Specification)

**Visual Metaphor:** Kanban or "Flight Control" Board
**Rows:** Reservations (Sorted by Urgency/Date). **Columns:** The Workflow Steps (Agents).

| Guest Name | Arr Date | Step 1: OTA | Step 2: Opera | Step 3: Confirm | Step 4: Guide (T-3) | Step 5: Check-in (T-1) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| John Doe | Jan 20 | ✅ Accepted | ✅ Conf: #12345 (View Image) | ✅ WhatsApp Sent | ⏳ Pending (T-3) | ⏳ Pending (T-1) | 🟢 On Track |
| Jane Smith | Jan 21 | ✅ Accepted | ❌ ERROR: Rate Mismatch | ⏸️ Held | ⏸️ Held | ⏸️ Held | 🔴 ACTION REQ |

**Human Interactions:**
*   **Green (On Track):** Ignore. The Agents are working.
*   **Red (Action Req):** Click the cell. "Agent says: Opera Rate was $100, Airbnb was $80. Automation stopped." -> Human logs in, fixes rate, clicks "Retry Agent".

---

## 5. Simulation Data (Scenario: Reservation Capture)

This scenario demonstrates the data structures used by the agents.

### 5.1 Cloud SQL Schema (System of Record)
```sql
CREATE TABLE reservations (
    res_uuid UUID PRIMARY KEY,
    platform_id VARCHAR(50), -- e.g., 'HM-QZ9921'
    guest_name VARCHAR(100),
    check_in DATE,
    check_out DATE,
    prop_code VARCHAR(20),   -- 'WFV'
    room_code VARCHAR(20),   -- 'WFV-E003'
    opera_conf VARCHAR(50),  -- Captured via automation
    status VARCHAR(20),      -- 'NEW', 'SYNCED', 'CONFIRMED'
    meta JSONB               -- Flexible storage for OTA payloads
);
```

### 5.2 Agent Execution Log (The "Robot Arms")
**Task:** Update Legacy Opera System via Headless Browser.

1.  **Login:** Agent navigates to Opera web interface.
2.  **Input Data:** Guest: Michael, Dates: 10-15 Nov, Room: WFV-E003.
3.  **Action:** Click "Save".
4.  **Output Extraction:**
    *   System displays popup: "Reservation created. Conf #: 8829103".
    *   Agent captures screenshot: `gs://bucket/reservations/HM-QZ9921_opera.png`.
5.  **Callback:** Update Cloud SQL.
    ```sql
    UPDATE reservations SET opera_conf = '8829103', status = 'SYNCED' WHERE platform_id = 'HM-QZ9921';
    ```
