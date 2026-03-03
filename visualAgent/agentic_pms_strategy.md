# Agentic PMS Strategy: The "Hybrid Automation" Model

This detailed plan consolidates the architectural mission, the "Single Source of Truth" strategic shift, and the technical implementation roadmap. It utilizes the **Event-Driven State Management** pattern to decouple the modern agents from the legacy Opera system while ensuring data consistency.

### Executive Strategy: The "Hybrid Automation" Model
The core objective is to deprecate the legacy system (Opera) as the decision-maker, demoting it to a data repository for older channels (like Booking.com), while promoting **Google Firestore** to the "Single Source of Truth" (SSOT). This enables real-time global inventory updates and allows "Agentic Microservices" to manage operations at a fraction of the cost of human teams.

---

### Step 1: Establish the Event-Driven Data Layer (Day 1-2)
**Goal:** Create the "Single Source of Truth" that enables immediate global connectivity, bypassing Opera's API limitations.

*   **Action:** Deploy **Google Firestore** as the central database.
    *   **Structure:** Create collections for `reservations`, `rooms` (inventory), and `audit_logs`.
    *   **The Shift:** Unlike the legacy "Fine-Grained SOA" where systems depend on each other synchronously, use **Event-Driven State Management**. When a room status changes in Firestore, it triggers downstream events (Agents), ensuring the system remains responsive even if Opera is slow or offline.
*   **Action:** Implement **Sub-Collection Auditing**.
    *   Use Firestore subcollections to record every interaction (e.g., `reservations/{id}/audit_logs`). This replaces the opaque nature of legacy systems with a cryptographic-style ledger of who changed what and when, essential for preventing the "duplicate room bookings" often caused by human error.

### Step 2: The "Gatekeeper" & Input Normalization (Day 2-3)
**Goal:** Ingest bookings from modern channels (Airbnb) and legacy channels (via Opera) into the new SSOT.

*   **The "Gatekeeper" Agent (Vertex AI):**
    *   **Role:** This agent receives incoming booking signals. It must query Firestore to validate availability before accepting a booking.
    *   **The "Mock" Workaround:** Since Airbnb API approval is pending, deploy the **Mock Webhook Emitter** immediately. This script simulates Airbnb payloads, allowing you to build and test the "Gatekeeper" logic (Phase 1) without waiting for external permission.
*   **Handling "Unallocated" Legacy Inventory:**
    *   **The Problem:** Booking.com reservations entering via Opera are often for generic "Room Types" (e.g., "Standard Double") rather than specific physical rooms (e.g., "Room 101").
    *   **The Fix:** Program the Gatekeeper with **deduction logic**. It must calculate *Effective Availability*:
        $$ \text{Total Rooms} - (\text{Specific Allocations} + \text{Unallocated Room Type Bookings}) $$
        This ensures that a generic booking in Opera effectively blocks specific inventory in Firestore/Airbnb, preventing the "Double Booking Risk".

### Step 3: The "Integrator" – Bridging Legacy Infrastructure (Day 4)
**Goal:** Keep Opera updated and relevant without letting it slow down the new system.

*   **Role Change:** The "Integrator" changes from a simple data entry bot to a **bidirectional sync engine**.
*   **Direction A (Pull):** Run a Cloud Run Job (Headless Browser) to scrape Opera.
    *   *Trigger:* Scheduled (e.g., every 5 mins).
    *   *Action:* Detect new Booking.com reservations in Opera and write them to Firestore. If the reservation is "unallocated," tag it clearly in Firestore to trigger the deduction logic mentioned in Step 2.
*   **Direction B (Push):** Update Opera from Firestore.
    *   *Trigger:* Firestore `onUpdate` event (e.g., a new Airbnb booking).
    *   *Action:* The Integrator logs into Opera and blocks the specific room to ensure the front desk staff (who may still look at Opera) see the room as occupied.
*   **Risk Mitigation:** By isolating Opera behind this "Integrator" agent, you effectively place an **Anti-Corruption Layer** between your modern microservices and the fragile legacy VPN/screens.

### Step 4: Revenue & Policy Management (The New Value)
**Goal:** Leverage Firestore’s speed to implement capabilities Opera couldn't handle.

*   **Deploy the "Revenue Manager" Agent:**
    *   **Function:** Because Firestore allows "immediate sharing of real-world data," this agent monitors vacancy rates or competitor signals.
    *   **Action:** It autonomously updates `pricing` and `min_stay` rules in Firestore. These updates propagate immediately to the Airbnb API (once live), enabling dynamic pricing strategies that were impossible with the legacy stack.

### Step 5: Visual Management & "Trace" Observability
**Goal:** Operations and Exception Handling (Human-in-the-Loop).

*   **Dashboard (Next.js):** Deploy the "Flight Control" board.
    *   **Logic:** Humans only look at rows marked **RED** (Flagged) or **BLINKING** (New). This is "Management by Exception".
*   **Trust Architecture (Vertex AI Tracing):**
    *   **The "First Port of Call":** When a human clicks a "Red" reservation, they should see the **Trace View** (integrated via Google Cloud Logging).
    *   **Benefit:** This reveals the agent's "chain of thought"—e.g., *"I see a request for Room 102, but I found an unallocated booking from Opera for a 'Standard Room' that consumes the last slot. Rejecting booking."*. This transparency allows staff to trust the agent's decision-making.

### Summary of Benefits
1.  **Cost:** Running on serverless infrastructure (Vertex AI, Cloud Run) keeps costs <$50/mo for low volumes.
2.  **Agility:** You bypass legacy API limitations, enabling instant global updates.
3.  **Stability:** The **Event-Driven** pattern ensures that if Opera crashes, your Airbnb sales and Firestore operational dashboard remain live and functional.
