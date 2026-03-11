import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
from datetime import date, timedelta, datetime


# --- CONFIGURATION ---
SERVICE_ACCOUNT_KEY_PATH = "service-account-key.json"
COLLECTION_NAME = "apartmentSeasonRates"
OUTPUT_FILENAME = "rate_anomaly_report.txt"

# Set the precise date range to analyze as per your request
ANALYSIS_START_DATE = date(2025, 4, 1)
ANALYSIS_END_DATE = date(2026, 9, 1)

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
        print(f"❌ ERROR: Could not initialize Firebase. Details: {e}")
        return None

def fetch_and_group_seasons(db):
    """Fetches all seasons and groups them by unitType."""
    print(f"\nFetching all documents from '{COLLECTION_NAME}'...")
    seasons_ref = db.collection(COLLECTION_NAME)
    docs = seasons_ref.stream()
    seasons_by_unit_type = defaultdict(list)
    for doc in docs:
        data = doc.to_dict()
        if 'unitType' in data and 'startDate' in data and 'endDate' in data:
            seasons_by_unit_type[data['unitType']].append({'id': doc.id, **data})
    print(f"  > Found {len(seasons_by_unit_type)} unique unit types.")
    return seasons_by_unit_type

def analyze_timeline(unit_type, seasons, report_file):
    """Builds a daily coverage map and reports any anomalies to the file."""
    report_file.write(f"\n--- Analyzing Unit Type: {unit_type} ---\n")
    
    # Create a dictionary to hold coverage count for each day
    coverage_map = defaultdict(list)
    
    # Populate the map based on season ranges
    for season in seasons:
        # Firestore Timestamps need to be converted to date objects
        start_date = season['startDate'].date()
        end_date = season['endDate'].date()
        
        current_date = start_date
        while current_date < end_date:
            coverage_map[current_date].append(f"{season['id']} ({season.get('seasonName', 'Unnamed')})")
            current_date += timedelta(days=1)
            
    # Now, analyze the map for anomalies within the specified date range
    current_date = ANALYSIS_START_DATE
    anomalies_found = 0
    
    while current_date < ANALYSIS_END_DATE:
        day_str = current_date.strftime('%Y-%m-%d')
        coverage_count = len(coverage_map[current_date])
        
        if coverage_count == 0:
            report_file.write(f"  ❗️ GAP FOUND: Day {day_str} is not covered by any season.\n")
            anomalies_found += 1
        elif coverage_count > 1:
            doc_ids = ", ".join(coverage_map[current_date])
            report_file.write(f"  ❗️ OVERLAP FOUND: Day {day_str} is covered by {coverage_count} seasons (Docs: {doc_ids}).\n")
            anomalies_found += 1
            
        current_date += timedelta(days=1)
        
    if anomalies_found == 0:
        report_file.write("  ✓ OK: No gaps or overlaps found in the specified date range.\n")
    else:
        report_file.write(f"  > Summary: Found {anomalies_found} days with anomalies.\n")
    
    # Also print summary to console for immediate feedback
    print(f"  > Analysis complete for {unit_type}. Found {anomalies_found} anomaly days.")

def main():
    """Main execution function."""
    db = initialize_firebase()
    if not db: return

    seasons_by_unit_type = fetch_and_group_seasons(db)
    if not seasons_by_unit_type: return

    # Open the file for writing
    with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as report_file:
        report_file.write(f"Rate Anomaly Report - Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        report_file.write(f"Analysis Range: {ANALYSIS_START_DATE.strftime('%Y-%m-%d')} to {ANALYSIS_END_DATE.strftime('%Y-%m-%d')}\n")
        
        print("\nStarting analysis. Results will be written to a file.")
        # Sort by unit_type for a consistent report order
        for unit_type, seasons in sorted(seasons_by_unit_type.items()):
            analyze_timeline(unit_type, seasons, report_file)
            
    print(f"\n✅ Analysis complete. Full report saved to '{OUTPUT_FILENAME}'.")

if __name__ == "__main__":
    main()