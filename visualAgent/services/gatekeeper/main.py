import os
from fastapi import FastAPI, HTTPException, Request
from google.cloud import firestore
from datetime import datetime
import json

app = FastAPI()

# Initialize Firestore
# Assuming GOOGLE_APPLICATION_CREDENTIALS is set or key is in default location
# For this dev setup, we point explicitly if needed, but better to use env var
if os.path.exists("../../service-account-key.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "../../service-account-key.json"

db = firestore.Client(project="cal-airb-api")

@app.post("/webhook/airbnb")
async def airbnb_webhook(request: Request):
    payload = await request.json()
    print(f"Received payload: {json.dumps(payload, indent=2)}")
    
    # Extract details
    room_type_id = payload.get("listing_id") # Assuming listing_id maps to room_type or specific room
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    guest_name = payload.get("guest_name", "Unknown Guest")
    
    # Simple validation (Phase 1 logic)
    # Check availability for the date range
    # In a real scenario we iterate through dates. Here we check single date for simplicity of the prototype.
    date_key = start_date # e.g., "2026-01-20"
    
    # 1. Check Inventory Ledger
    ledger_ref = db.collection("inventory_ledger").document(f"{date_key}_{room_type_id}")
    ledger_doc = ledger_ref.get()
    
    available = False
    
    if not ledger_doc.exists:
        # If no ledger exists, assume default availability (or 0 if safer)
        # For prototype, let's assume if it doesn't exist, we create it with defaults
        # OR we query the rooms collection to count actual physical units
        # Let's assume fetching from 'rooms' for now for the Total
        rooms_query = db.collection("rooms").where("unitType", "==", room_type_id).stream()
        total_physical = len(list(rooms_query))
        
        # If logic: create ledger
        ledger_data = {
            "total_physical_units": total_physical,
            "hard_allocated_ids": [],
            "soft_allocated_count": 0,
            "blocked_maintenance": 0,
            "calculated_availability": total_physical
        }
        ledger_ref.set(ledger_data)
        if total_physical > 0:
            available = True
    else:
        data = ledger_doc.to_dict()
        if data["calculated_availability"] > 0:
            available = True
            
    if not available:
        # In a real webhook, we might not be able to "reject" if it's already booked, 
        # but for the "Gatekeeper" availability check (before booking), return False.
        # If this is a notification of a booking that happened, we must handle the conflict (Double Book).
        return {"status": "rejected", "reason": "No availability"}

    # 2. Book it (Update Ledger)
    # We need a transaction to be safe
    transaction = db.transaction()
    try:
        book_room(transaction, ledger_ref, guest_name)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    # 3. Create Reservation Record
    res_data = {
        "guest_name": guest_name,
        "start_date": start_date,
        "end_date": end_date,
        "room_type_id": room_type_id,
        "channel": "Airbnb",
        "status": "confirmed",
        "created_at": firestore.SERVER_TIMESTAMP
    }
    res_ref = db.collection("reservations").document()
    res_ref.set(res_data)
    
    # 4. Audit Log
    audit_ref = res_ref.collection("audit_logs").document()
    audit_ref.set({
        "action": "create",
        "actor": "Gatekeeper Agent",
        "details": "Booking accepted via Airbnb Webhook",
        "timestamp": firestore.SERVER_TIMESTAMP
    })

    return {"status": "accepted", "reservation_id": res_ref.id}

@firestore.transactional
def book_room(transaction, ledger_ref, guest_name):
    snapshot = ledger_ref.get(transaction=transaction)
    data = snapshot.to_dict()
    
    new_availability = data["calculated_availability"] - 1
    
    if new_availability < 0:
        raise Exception("Availability changed during transaction!")
        
    transaction.update(ledger_ref, {
        "start_date": data.get("start_date", "2026-01-01"), # Ensure field
        "calculated_availability": new_availability,
        "hard_allocated_ids": firestore.ArrayUnion([f"res_{guest_name}"]) # Placeholder ID
    })
