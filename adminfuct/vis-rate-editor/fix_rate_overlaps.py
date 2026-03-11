import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
from datetime import timedelta

# --- CONFIGURATION ---
SERVICE_ACCOUNT_KEY_PATH = "service-account-key.json"
DRY_RUN = True
 # ALWAYS run with True first!
COLLECTION_NAME = "apartmentSeasonRates"

# --- SCRIPT LOGIC ---

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully.")
        return firestore.client()
    except Exception as e:
        print(f"❌ ERROR: Could not initialize Firebase. Check your key path.")
        print(f"   Details: {e}")
        return None

def fetch_and_group_seasons(db):
    """Fetches all seasons and groups them by unitType."""
    print(f"\nFetching all documents from '{COLLECTION_NAME}'...")
    seasons_ref = db.collection(COLLECTION_NAME)
    docs = seasons_ref.stream()
    seasons_by_unit_type = defaultdict(list)
    count = 0
    for doc in docs:
        data = doc.to_dict()
        if 'unitType' in data and 'startDate' in data and 'endDate' in data:
            seasons_by_unit_type[data['unitType']].append({'id': doc.id, **data})
            count += 1
    print(f"  > Found {count} documents and grouped them into {len(seasons_by_unit_type)} unique unit types.")
    return seasons_by_unit_type

def fix_season_issues(db, seasons_by_unit_type):
    """Identifies and fixes both overlaps AND gaps within each unitType's timeline."""
    print("\nAnalyzing seasons for gaps and overlaps...")
    
    batch = db.batch()
    updates_to_commit = 0

    for unit_type, seasons in seasons_by_unit_type.items():
        if len(seasons) < 2:
            continue

        sorted_seasons = sorted(seasons, key=lambda s: s['startDate'])
        print(f"\n--- Processing Unit Type: {unit_type} ({len(sorted_seasons)} seasons) ---")

        for i in range(len(sorted_seasons) - 1):
            current_season = sorted_seasons[i]
            next_season = sorted_seasons[i+1]
            
            current_end = current_season['endDate']
            next_start = next_season['startDate']
            
            current_name = current_season.get('seasonName', f"DocID:{current_season['id'][:5]}")

            # This is the new, stricter check for perfect continuity
            if current_end != next_start:
                # Determine if it's a gap or an overlap
                if current_end < next_start:
                    issue_type = "GAP"
                    gap_duration = next_start - current_end
                    print(f"  ❗️ {issue_type} FOUND for '{current_name}':")
                    print(f"     > Gap duration: {gap_duration}")
                else: # current_end > next_start
                    issue_type = "OVERLAP"
                    print(f"  ❗️ {issue_type} FOUND for '{current_name}':")

                print(f"     > Current End:   {current_end.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                print(f"     > Next Start:    {next_start.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                
                # The fix is always the same: make the current season's end date
                # equal to the next season's start date. This closes gaps and trims overlaps.
                new_end_date = next_start
                print(f"     ✅ FIX: Setting endDate for document '{current_season['id']}' to {new_end_date.strftime('%Y-%m-%d %H:%M:%S %Z')}")

                doc_ref = db.collection(COLLECTION_NAME).document(current_season['id'])
                batch.update(doc_ref, {'endDate': new_end_date})
                updates_to_commit += 1
            else:
                print(f"  ✓ OK: '{current_name}' transitions correctly.")

    return batch, updates_to_commit

def main():
    """Main execution function."""
    db = initialize_firebase()
    if not db: return

    seasons_by_unit_type = fetch_and_group_seasons(db)
    if not seasons_by_unit_type: return

    update_batch, num_updates = fix_season_issues(db, seasons_by_unit_type)

    print("\n--- Summary ---")
    if num_updates == 0:
        print("🎉 No gaps or overlaps found. Your data is perfectly continuous!")
        return

    print(f"Found {num_updates} issues (gaps or overlaps) that need fixing.")
    
    if DRY_RUN:
        print("\nDRY RUN is active. No changes have been made to the database.")
        print("To apply these changes, edit the script to set DRY_RUN = False and run it again.")
    else:
        try:
            print("\nCommitting changes to Firestore...")
            update_batch.commit()
            print("✅ Successfully committed all updates.")
        except Exception as e:
            print(f"❌ ERROR: Failed to commit changes. Details: {e}")

if __name__ == "__main__":
    main()