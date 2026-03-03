# Agentic AI PMS: Specification & Workflow Architecture
**Version:** 3.0 (Google Native / Firebase Edition)
**Status:** Draft / Active

## 1. System Overview
**"Visual Management, Agentic Execution"**

The core philosophy of this system is **Hybrid Automation**.

*   **The "Agents" (AI/Bots):** Execute the routine, linear tasks (data entry, emails, syncing) in the background.
*   **The "Dashboard" (Visual):** A control tower for the Human Operator. It does not demand data entry; instead, it displays the status of the Agents. The human only intervenes when an Agent reports an "Anomaly" or "Delay" (Manage by Exception).

---

## 2. Technology Stack (The "Build")

A **Zero-Duplication** stack leveraging your existing Google/Firebase ecosystem.

### 2.1 Core Infrastructure
*   **Orchestrator:** **Google Cloud Tasks**.
    *   *Role:* The "Scheduler". Instead of a complex server like Temporal, we simply push a task to a queue saying "Wake up and run 'Send Guide' in 3 days". It is serverless, free (up to 1M tasks), and native to Google.
*   **Compute:** **Google Cloud Run** & **Firebase Functions**.
    *   *Cloud Run:* Hosting the Python Agents (Headless Browsers need Docker) and the Next.js Frontend.
    *   *Cloud Functions:* Handling simple webhooks (e.g., Airbnb Ingress).
*   **Data Layer:** **Google Cloud Firestore**.
    *   *Role:* The Single Source of Truth.
    *   *Collections:*
        *   `reservations` (The active state).
        *   `rooms` (Your existing property data).
        *   `availability` (Calendar blockers).

### 2.2 Frontend (The "Control Tower")
*   **Framework:** **Next.js (React)**.
*   **Hosting:** Firebase Hosting (served via Cloud Run or Edge).
*   **Design:** Bespoke "Flight Control" Dashboard.
*   **Data Fetching:** Direct subscription to Firestore (Real-time updates without polling).

### 2.3 AI & Observability
*   **Agents:** Python + LangChain (running on Cloud Run).
*   **Observability:** **Arize Phoenix**.
    *   *Role:* Specialized "Flight Recorder" for LLM traces.
    *   *Why keep it?* Google Cloud Logging is for *system* errors ("Function crashed"). Phoenix is for *logic* errors ("Why did the AI offer a discount?"). It runs as a sidecar container and doesn't duplicate data storage (can use local ephemeral or a small volume).

---

## 3. The Triggers & Workflows

### Phase 1: The Booking Event

**Trigger:** New Reservation Webhook (e.g., from Airbnb/Booking.com)

**Agent Task 1: "The Gatekeeper" (Auto-Responder)**
*   **Action:** Query Firestore `rooms` for policies.
*   **Action:** Check Firestore `availability`.
*   **Action:** Create Document in `reservations` collection (Status: `NEW`).

**Agent Task 2: "The Integrator" (Opera Sync)**
*   **Input:** Firestore Document `reservations/{id}`.
*   **Action:** Log into Opera (via Headless Browser on Cloud Run).
*   **Action:** Create profile & booking.
*   **Visual Proof:** Capture Screen Print -> Save to **Google Cloud Storage (GCS)**.
*   **Data Extraction:** Extract Opera Confirmation Number via OCR.
*   **Output:** Update Firestore Document with `opera_conf_number` and `gcs_screenshot_url`.
*   **Anomaly:** If fail -> Update Status to `NEEDS_REVIEW`.

**Agent Task 3: "The Concierge" (Initial Confirmation)**
*   **Trigger:** Firestore `onUpdate` trigger (when status becomes `SYNCED`).
*   **Action:** Send Multi-channel Confirmation.
*   **Update:** Update Firestore `confirmation_sent: true`.
*   **Scheduling:** **Enqueue Google Cloud Task** -> Target: "The Guide", ScheduleTime: `CheckIn - 3 days`.

### Phase 2: The Pre-Arrival Countdown

**Agent Task 4: "The Guide" (T-Minus 3 Days)**
*   **Trigger:** Google Cloud Task (wakes up worker).
*   **Action:** Send "Property Guide" via WhatsApp/Email.
*   **Update:** Update Firestore `guide_sent: true`.
*   **Scheduling:** **Enqueue Google Cloud Task** -> Target: "The Receptionist", ScheduleTime: `CheckIn - 1 day`.

**Agent Task 5: "The Receptionist" (T-Minus 1 Day)**
*   **Trigger:** Google Cloud Task.
*   **Action (Guest):** Check Firestore for "Pre-arrival form completed". If not, nudge guest.
*   **Action (Staff):** Send Digest Email.
*   **Update:** Set `status: ready_for_checkin`.

---

## 4. The Visual Dashboard (UI Specification)

**Visual Metaphor:** Kanban or "Flight Control" Board
**Rows:** Reservations (from Firestore). **Cols:** Workflow Steps.

| Guest Name | Arr Date | Step 1: OTA | Step 2: Opera | Step 3: Confirm | Step 4: Guide (T-3) | Step 5: Check-in (T-1) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| John Doe | Jan 20 | ✅ Accepted | ✅ Conf: #12345 (View Image) | ✅ WhatsApp Sent | ⏳ Pending (T-3) | ⏳ Pending (T-1) | 🟢 On Track |
| Jane Smith | Jan 21 | ✅ Accepted | ❌ ERROR: Rate Mismatch | ⏸️ Held | ⏸️ Held | ⏸️ Held | 🔴 ACTION REQ |

**Human Interactions:**
*   **Real-time:** Dashboard uses Firestore listeners. If an agent updates a status, the cell turns Green instantly on the operator's screen.

---

## 5. Simulation Data (Scenario: Reservation Capture)

This scenario demonstrates the data structures used by the agents.

### 5.1 Firestore Data Model (NoSQL)
**Collection:** `reservations`
**Document ID:** `res_WFV_1029`
```json
{
  "platform_id": "HM-QZ9921",
  "guest": {
    "name": "Michael",
    "phone": "+15550199"
  },
  "dates": {
    "check_in": "2025-11-10",
    "check_out": "2025-11-15"
  },
  "property": {
    "code": "WFV",
    "room": "WFV-E003"
  },
  "workflow": {
    "status": "SYNCED",
    "opera_conf": "8829103",
    "screenshot_url": "gs://bucket/reservations/HM-QZ9921_opera.png",
    "confirmation_sent": true,
    "guide_sent": false
  },
  "meta_payload": { ... } // Full Airbnb JSON
}

**Subcollection:** `reservations/{res_id}/audit_logs` (History)
*Solves the "Who changed what and when?" requirement.*
```json
{
  "log_id": "log_88291",
  "timestamp": "2025-12-11T10:05:00Z",
  "actor": "James (Human Operator)",
  "action": "UPDATE_CHECKOUT",
  "changes": {
    "field": "dates.check_out",
    "old_value": "2025-02-11",
    "new_value": "2025-02-15"
  }
}
```

**Subcollection:** `reservations/{res_id}/ledger` (Financials)
*Append-only financial records.*
```json
{
  "tx_id": "tx_9921",
  "timestamp": "2025-11-10T08:00:00Z",
  "type": "PAYOUT_RECEIVED",
  "amount_cents": 125000,
  "currency": "USD",
  "source": "Airbnb",
  "status": "CLEARED"
}
```
```

### 5.2 Agent Execution Log (The "Robot Arms")
**Task:** Update Legacy Opera System via Headless Browser.

1.  **Login:** Agent navigates to Opera web interface.
2.  **Input Data:** Guest: Michael, Dates: 10-15 Nov, Room: WFV-E003.
3.  **Action:** Click "Save".
4.  **Output Extraction:**
    *   System displays popup: "Reservation created. Conf #: 8829103".
    *   Agent captures screenshot: `gs://bucket/reservations/HM-QZ9921_opera.png`.
5.  **Callback:** Update Firestore Document.
    ```python
    db.collection("reservations").document("res_WFV_1029").update({
        "workflow.opera_conf": "8829103",
        "workflow.status": "SYNCED"
    })
    ```
