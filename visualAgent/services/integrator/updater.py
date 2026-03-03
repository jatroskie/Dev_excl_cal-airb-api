import os
from google.cloud import firestore
import time

# Initialize Firestore
if os.path.exists("../../service-account-key.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "../../service-account-key.json"

db = firestore.Client(project="cal-airb-api")

def update_opera():
    print("Starting Opera Updater (Mock)... Listening for unsynced Airbnb bookings...")
    
    # Query for Airbnb bookings that are confirmed but NOT synced
    # Note: Using complex query might require index. For prototype, we scan.
    
    reservations = db.collection("reservations").where("channel", "==", "Airbnb").get()
    
    count = 0
    for res in reservations:
        data = res.to_dict()
        if not data.get("synced_to_opera"):
            print(f"Found unsynced booking: {res.id} for {data.get('guest_name')}")
            
            # Simulate Opera Login and Write
            print(f" > Logging into Opera...")
            time.sleep(1)
            print(f" > Navigating to Room Grid...")
            time.sleep(0.5)
            print(f" > Blocked Room {data.get('room_type_id')} for {data.get('start_date')}")
            
            # Update Firestore
            res.reference.update({
                "synced_to_opera": True,
                "opera_id": f"OP_{int(time.time())}"
            })
            print(f" > Marked as synced in Firestore.")
            count += 1
            
    if count == 0:
        print("No unsynced bookings found.")

if __name__ == "__main__":
    update_opera()
