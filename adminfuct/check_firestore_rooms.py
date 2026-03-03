
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

# Configuration
SERVICE_ACCOUNT_KEY_PATH = 'service-account-key.json' 
FIRESTORE_ROOMS_COLLECTION = 'rooms'

def check_structure():
    try:
        if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            print(f"Error: {SERVICE_ACCOUNT_KEY_PATH} not found.")
            return

        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        print("Checking rooms collection...")
        docs = db.collection(FIRESTORE_ROOMS_COLLECTION).stream()
        
        tba_rooms = []
        other_rooms = []
        
        for doc in docs:
            if 'TBA' in doc.id or doc.id.startswith('04') or doc.id.startswith('05') or doc.id.startswith('03'): # Guessing numbers based on user input
                tba_rooms.append(doc.id)
            else:
                other_rooms.append(doc.id)
                
        print(f"Total Rooms: {len(tba_rooms) + len(other_rooms)}")
        print("\nPossible TBA Rooms found:")
        for r in sorted(tba_rooms)[:20]:
            print(f" - {r}")
            
        print("\nSample Other Rooms:")
        for r in other_rooms[:5]:
            print(f" - {r}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    check_structure()
