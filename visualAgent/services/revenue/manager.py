import os
import time
from google.cloud import firestore
from datetime import datetime, timedelta

# Initialize Firestore
if os.path.exists("../../service-account-key.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "../../service-account-key.json"

db = firestore.Client(project="cal-airb-api")

def revenue_manager_loop():
    print("Starting Revenue Manager Agent...")
    
    # Configuration
    TARGET_OCCUPANCY = 0.80 # 80%
    PRICE_HIKE = 1.10 # +10%
    PRICE_DROP = 0.95 # -5%
    
    room_types = ["WFV-1-BR"] # Focus on our test type
    
    # In a real agent, this loop runs continuously or is triggered by events/schedule
    # For prototype, we run one pass
    
    today = datetime.now().strftime("%Y-%m-%d")
    lookahead_days = 30
    
    print(f"Analyzing next {lookahead_days} days starting {today}...")
    
    for i in range(lookahead_days):
        check_date = (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d")
        
        for r_type in room_types:
            ledger_key = f"{check_date}_{r_type}"
            ledger_ref = db.collection("inventory_ledger").document(ledger_key)
            ledger_snap = ledger_ref.get()
            
            if ledger_snap.exists:
                data = ledger_snap.to_dict()
                total = data.get("total_physical_units", 1) # Default to 1 to avoid div/0
                avail = data.get("calculated_availability", 0)
                
                booked = total - avail
                occupancy = booked / total if total > 0 else 0
                
                # Decision Logic
                action = "HOLD"
                new_price_multiplier = 1.0
                
                if occupancy >= TARGET_OCCUPANCY:
                    action = "INCREASE"
                    new_price_multiplier = PRICE_HIKE
                elif occupancy < 0.20 and i < 7: # Low occupancy incoming week
                    action = "DECREASE"
                    new_price_multiplier = PRICE_DROP
                
                if action != "HOLD":
                    print(f"[{check_date}][{r_type}] Occupancy: {occupancy*100:.0f}% -> Action: {action}")
                    apply_pricing_update(check_date, r_type, new_price_multiplier)
            else:
                 # No ledger means 0% occupancy (assuming we created ledgers on demand, 
                 # or if not created it implies empty).
                 pass

def apply_pricing_update(date, room_type, multiplier):
    # Store pricing rule in a 'rates' collection
    rate_key = f"{date}_{room_type}"
    rate_ref = db.collection("rates").document(rate_key)
    
    # We use set(merge=True) to update or create
    # In a real app we'd fetch base rate first. 
    # For now we assume a 'dynamic_multiplier' field.
    
    rate_ref.set({
        "date": date,
        "room_type_id": room_type,
        "dynamic_multiplier": multiplier,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "updated_by": "Revenue Manager Agent"
    }, merge=True)
    
    # Also log to Audit
    audit_ref = db.collection("audit_logs").document()
    audit_ref.set({
        "action": "price_update",
        "actor": "Revenue Manager Agent",
        "details": f"Set multiplier {multiplier} for {date} {room_type}",
        "timestamp": firestore.SERVER_TIMESTAMP
    })

if __name__ == "__main__":
    revenue_manager_loop()
