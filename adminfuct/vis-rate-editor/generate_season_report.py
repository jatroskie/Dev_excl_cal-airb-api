import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
from datetime import datetime

# --- CONFIGURATION ---
SERVICE_ACCOUNT_KEY_PATH = "service-account-key.json"
COLLECTION_NAME = "apartmentSeasonRates"
OUTPUT_FILENAME = "full_season_rate_report.txt"

# --- SCRIPT LOGIC ---

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    try:
        # Check if the app is already initialized to prevent errors on re-runs
        if not firebase_admin._apps:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully.")
        return firestore.client()
    except Exception as e:
        print(f"❌ ERROR: Could not initialize Firebase. Details: {e}")
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
            seasons_by_unit_type[data['unitType']].append(data)
            count += 1
    print(f"  > Found {count} total season documents.")
    print(f"  > Grouped into {len(seasons_by_unit_type)} unique unit types.")
    return seasons_by_unit_type

def generate_report(seasons_by_unit_type):
    """Sorts seasons and writes the formatted report to a file."""
    print(f"\nGenerating report. This will be saved to '{OUTPUT_FILENAME}'...")
    
    try:
        with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as report_file:
            # Write the header row
            header = "UnitType\tSeasonName\tStartDate\tEndDate\n"
            report_file.write(header)

            # Process each unit type, sorted alphabetically
            for unit_type, seasons in sorted(seasons_by_unit_type.items()):
                # Sort the seasons within this unit type by their start date
                sorted_seasons = sorted(seasons, key=lambda s: s['startDate'])
                
                # Write a blank line for readability between unit types
                report_file.write("\n")

                for season in sorted_seasons:
                    # Get the data, with defaults for any missing fields
                    season_name = season.get('seasonName', 'N/A')
                    start_date_ts = season.get('startDate')
                    end_date_ts = season.get('endDate')

                    # Format the timestamps into a readable string
                    # If a date is missing, report it clearly
                    start_date_str = start_date_ts.strftime('%Y-%m-%d %H:%M:%S') if start_date_ts else "MISSING"
                    end_date_str = end_date_ts.strftime('%Y-%m-%d %H:%M:%S') if end_date_ts else "MISSING"

                    # Write the formatted row to the file
                    row = f"{unit_type}\t{season_name}\t{start_date_str}\t{end_date_str}\n"
                    report_file.write(row)
        
        print(f"✅ Report successfully generated!")

    except Exception as e:
        print(f"❌ ERROR: An error occurred while writing the report file.")
        print(f"   Details: {e}")


def main():
    """Main execution function."""
    db = initialize_firebase()
    if not db: return

    seasons_by_unit_type = fetch_and_group_seasons(db)
    if not seasons_by_unit_type: 
        print("No seasons found to process. Exiting.")
        return

    generate_report(seasons_by_unit_type)

if __name__ == "__main__":
    main()