import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
from datetime import datetime, time

# --- CONFIGURATION ---
SERVICE_ACCOUNT_KEY_PATH = "service-account-key.json"
COLLECTION_NAME = "apartmentSeasonRates"
OUTPUT_FILENAME = "standardization_plan.txt"
# Set to False to apply changes to the database
DRY_RUN = False

# --- SCRIPT LOGIC ---

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin SDK initialized successfully.")
    return firestore.client()

def fetch_and_group_seasons(db):
    """Fetches all seasons and groups them by unitType."""
    print(f"Fetching documents from '{COLLECTION_NAME}'...")
    seasons_ref = db.collection(COLLECTION_NAME)
    docs = seasons_ref.stream()
    seasons_by_unit_type = defaultdict(list)
    for doc in docs:
        data = doc.to_dict()
        if 'unitType' in data and 'startDate' in data and 'endDate' in data:
            seasons_by_unit_type[data['unitType']].append({'id': doc.id, **data})
    print(f"  > Found {len(seasons_by_unit_type)} unique unit types.")
    return seasons_by_unit_type

def standardize_timeline(db, seasons_by_unit_type):
    """Standardizes all dates to midnight UTC and ensures continuity."""
    print("Analyzing and planning standardization...")
    
    batch = db.batch()
    plan_details = []
    
    for unit_type, seasons in sorted(seasons_by_unit_type.items()):
        if not seasons: continue
        
        sorted_seasons = sorted(seasons, key=lambda s: s['startDate'])
        
        plan_details.append(f"\n--- Processing Unit Type: {unit_type} ---")

        # Standardize all start dates first
        for season in sorted_seasons:
            original_start = season['startDate']
            # Combine the date part with midnight time
            standardized_start = datetime.combine(original_start.date(), time.min, tzinfo=original_start.tzinfo)
            season['standardized_startDate'] = standardized_start # Store for later use
            
            if original_start != standardized_start:
                plan_details.append(f"  - Season '{season.get('seasonName', 'N/A')}' (ID: {season['id']})")
                plan_details.append(f"    - CHANGE startDate: FROM {original_start} TO {standardized_start}")
                doc_ref = db.collection(COLLECTION_NAME).document(season['id'])
                batch.update(doc_ref, {'startDate': standardized_start})
        
        # Now enforce continuity using the new standardized start dates
        for i in range(len(sorted_seasons) - 1):
            current_season = sorted_seasons[i]
            next_season = sorted_seasons[i+1]
            
            original_end = current_season['endDate']
            # The new end date should be the standardized start of the next season
            new_end_date = next_season['standardized_startDate']
            
            if original_end != new_end_date:
                plan_details.append(f"  - Season '{current_season.get('seasonName', 'N/A')}' (ID: {current_season['id']})")
                plan_details.append(f"    - CHANGE endDate:   FROM {original_end} TO {new_end_date} (to match next season's start)")
                doc_ref = db.collection(COLLECTION_NAME).document(current_season['id'])
                batch.update(doc_ref, {'endDate': new_end_date})

        # Handle the very last season's end date - standardize it to midnight
        last_season = sorted_seasons[-1]
        original_last_end = last_season['endDate']
        standardized_last_end = datetime.combine(original_last_end.date(), time.min, tzinfo=original_last_end.tzinfo)
        # If it ends on 23:59, we should probably round it up to the next day at midnight
        if original_last_end.time() > time.min:
            standardized_last_end = datetime.combine(original_last_end.date() + timedelta(days=1), time.min, tzinfo=original_last_end.tzinfo)

        if original_last_end != standardized_last_end:
            plan_details.append(f"  - Final Season '{last_season.get('seasonName', 'N/A')}' (ID: {last_season['id']})")
            plan_details.append(f"    - CHANGE endDate:   FROM {original_last_end} TO {standardized_last_end}")
            doc_ref = db.collection(COLLECTION_NAME).document(last_season['id'])
            batch.update(doc_ref, {'endDate': standardized_last_end})

    return batch, plan_details


def main():
    """Main execution function."""
    db = initialize_firebase()
    if not db: return

    seasons_by_unit_type = fetch_and_group_seasons(db)
    if not seasons_by_unit_type: return

    update_batch, plan = standardize_timeline(db, seasons_by_unit_type)
    
    # Write the plan to a file
    with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as f:
        f.write("Date Standardization Plan\n")
        f.write("=========================\n")
        for line in plan:
            f.write(f"{line}\n")

    print(f"\n✅ Standardization plan has been generated and saved to '{OUTPUT_FILENAME}'.")
    
    if not plan:
        print("🎉 All dates are already standardized and continuous!")
        return
        
    if DRY_RUN:
        print("\nDRY RUN is active. No changes have been made to the database.")
        print("Review the plan file. To apply changes, set DRY_RUN = False and run again.")
    else:
        try:
            print("\nCommitting changes to Firestore...")
            update_batch.commit()
            print("✅ Successfully committed all date standardizations.")
        except Exception as e:
            print(f"❌ ERROR: Failed to commit changes. Details: {e}")

if __name__ == "__main__":
    from datetime import timedelta # Add timedelta import here
    main()