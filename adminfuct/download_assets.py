import os
from google.cloud import storage

# Configuration
SERVICE_ACCOUNT_KEY_PATH = 'service-account-key.json'
BUCKET_NAME = 'cal-airb-api.firebasestorage.app'

# List of files to download (full GCS paths provided in the prompt)
FILES_TO_DOWNLOAD = [
    "rooms/VACPROP/vacprop1024_bluelogo.png",
    "rooms/VACPROP/vacprop1024_bluelogo_only.png",
    "rooms/VACPROP/vacprop_1920.png",
    "rooms/VACPROP/vacprop_cover_1920.png",
    "rooms/VACPROP/vacprop_logo_transparent_250px.png",
    "rooms/VACPROP/vacprop_logo_transparent_75px.png"
]

def download_files():
    # Initialize client
    if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        print(f"Error: Credentials file '{SERVICE_ACCOUNT_KEY_PATH}' not found.")
        return

    try:
        storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)
        bucket = storage_client.bucket(BUCKET_NAME)
    except Exception as e:
        print(f"Error initializing GCS client: {e}")
        return

    print(f"Downloading files from gs://{BUCKET_NAME}...")

    for file_path in FILES_TO_DOWNLOAD:
        blob = bucket.blob(file_path)
        filename = os.path.basename(file_path) # Save to current directory with same filename
        
        print(f"  Downloading {filename}...")
        try:
            blob.download_to_filename(filename)
            print(f"    Success.")
        except Exception as e:
            print(f"    Failed: {e}")

    print("\nDownload complete.")

if __name__ == "__main__":
    download_files()
