
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

# Configuration
SERVICE_ACCOUNT_KEY_PATH = 'service-account-key.json' 
FIRESTORE_ROOMS_COLLECTION = 'rooms'

def check_room(room_id):
    try:
        if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            print(f"Error: {SERVICE_ACCOUNT_KEY_PATH} not found.")
            return

        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        print(f"Checking room {room_id} in {FIRESTORE_ROOMS_COLLECTION} collection...")
        doc = db.collection(FIRESTORE_ROOMS_COLLECTION).document(room_id).get()
        
        if doc.exists:
            data = doc.to_dict()
            print(f"Data for {room_id}:")
            for k, v in data.items():
                if k in ['name', 'title', 'roomName', 'type', 'roomType', 'description']:
                    print(f" - {k}: {v}")
        else:
            print(f"Room {room_id} not found.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    check_room('PAA-ADM01')
