# Technical Design Specification: Autonomous Agent Monitoring Service
**Project:** Apartment Booking Lifecycle Monitoring Dashboard  
**Version:** 1.0  
**Status:** Draft  

---

## 1. Executive Summary
This document outlines the architecture for a centralized monitoring service designed to observe distributed microservices (specifically autonomous agentic LLMs) throughout the lifecycle of an apartment booking. The system prioritizes **semantic observability**—analyzing not just if a service is running, but if it is *thinking* and *acting* correctly.

## 2. High-Level Architecture
The system utilizes an **Event-Driven Architecture** where agents emit rich telemetry data to an observability pipeline.

### 2.1 Core Components
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

## 3. Monitoring States & Metrics

### 3.1 Lifecycle Statuses (Explicit)
These states are explicitly emitted by agents during their workflow.

* **`INITIATED`**: Trigger received (e.g., webhook from OTA, email ingress). Agent reasoning loop started.
* **`RECEIVED`**: External data ingestion point (e.g., receiving SQL query results or external API payloads).
* **`UNABLE_TO_PROCEED` (Blocker)**: Agent lacks information or tool capability to continue.
* **`REFERRED` (Human-in-the-Loop)**: 
    * Safety guardrail triggered.
    * Confidence score < Threshold (e.g., 0.7).
    * Sensitive topic detected.
* **`EXECUTED/COMPLETED`**: Final business action committed (e.g., "Reservation Created" in PMS).

### 3.2 Derived Metrics (Implicit)
These metrics are calculated by the Observer Service by analyzing the trace data.

| Metric | Derivation Logic | Alert Severity |
| :--- | :--- | :--- |
| **Cognitive Looping** | Agent executes the same tool or generates identical reasoning >3 times sequentially. | **CRITICAL** |
| **Sentiment Decay** | Delta between User Sentiment $(t_0)$ and $(t_{current})$. Negative drift implies frustration. | **WARNING** |
| **Hallucination Risk** | "Observer" LLM cross-references agent claims against the Property Knowledge Base. | **HIGH** |
| **Tool Rot** | High error rate (`4xx`/`5xx`) specifically from tool outputs (e.g., Calendar API) despite valid agent requests. | **MEDIUM** |
| **Token Burn Rate** | Ratio: $\frac{\text{Total Tokens Consumed}}{\text{Successful Outcome}}$. | **INFO** |

---

## 4. Data Schema: The Agent Trace
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

## 5. Dashboard UI Specifications

### View A: The Control Tower (Global State)
*   **Visualization:** Sankey Diagram showing booking flow from Initiated $\to$ Negotiation $\to$ Confirmed/Referred.
*   **KPIs:**
    *   Active Conversations.
    *   Human Referral Rate (Target: < 15%).
    *   Avg. Time to Resolution.

### View B: Agent Health Matrix
A grid view monitoring specific microservice performance.
*   **Columns:** Status, Error Rate, Latency (p95), Cost/Turn.
*   **Indicators:**
    *   🔴 Red: API Severed / Infinite Loop.
    *   🟡 Yellow: High Latency / Negative Sentiment Drift.
    *   🟢 Green: Healthy.

### View C: Trace Inspector (Deep Dive)
*   **Chat Replay:** Chronological view of User vs. Agent messages.
*   **Thought Bubbles:** Toggleable view of the agent's internal "Chain of Thought" for every message.
*   **Tool I/O:** Raw view of inputs sent to tools (e.g., SQL queries) and the raw JSON returned.

## 6. Recommended Technology Stack
*   **Instrumentation:** OpenTelemetry (Python SDK).
*   **LLM Observability:** Arize Phoenix, HoneyHive, or LangSmith.
*   **Analytics DB:** ClickHouse (for high-volume log aggregation).
*   **Visualization:** Grafana (Metrics) + Streamlit/React (Trace Inspector).

### Next Step
Would you like me to create a **schema definition file (SQL or Avro)** based on the JSON
