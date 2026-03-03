import os
import uuid
from google.cloud import storage, vision
from firebase_admin import credentials, firestore, initialize_app

# --- Configuration ---
SERVICE_ACCOUNT_KEY_PATH = '../service-account-key.json' # <<<--- CHANGE THIS PATH
BASE_IMAGE_FOLDER = r'C:\Users\jatro\Documents\Vacprop\Upload'          # <<<--- CHANGE THIS PATH (Folder containing subfolders like TBA-0302)
# The base folder should contain subfolders named after room IDs (e.g., TBA-0302, TBA-0303).
# Each subfolder should contain images related to the respective room.
GCS_BUCKET_NAME = 'cal-airb-api.firebasestorage.app' # <<<--- CHANGE THIS PATH (e.g., your-project-id.appspot.com)
FIRESTORE_ROOMS_COLLECTION = 'rooms'
ALLOWED_IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif') # Add more if needed

# Categories and keywords for mapping Vision API labels
# Adjust these keywords based on Vision API results you observe
CATEGORY_KEYWORDS = {
    'kitchen': {'kitchen', 'sink', 'refrigerator', 'oven', 'countertop', 'microwave', 'kitchen appliance', 'cabinetry'},
    'bathroom': {'bathroom', 'toilet', 'sink', 'shower', 'bathtub', 'washbasin'},
    'bedroom': {'bedroom', 'bed', 'nightstand', 'dresser', 'wardrobe'},
    'living_room': {'living room', 'sofa', 'couch', 'coffee table', 'television', 'armchair', 'lounge'},
    'dining_area': {'dining room', 'dining table', 'chair'},
    'balcony_patio': {'balcony', 'patio', 'terrace', 'deck'},
    'exterior_view': {'building exterior', 'facade', 'window', 'landscape', 'cityscape', 'ocean', 'mountain', 'view', 'sky', 'pool', 'canal', 'water', 'garden', 'yard', 'outdoor', 'exterior'},
    'other': set() # Default category
}

# Keywords suggesting a good cover photo (prioritize views/exteriors)
COVER_PHOTO_KEYWORDS = {'landscape', 'cityscape', 'ocean', 'mountain', 'view', 'pool', 'balcony', 'patio', 'facade', 'building exterior'}
# --- End Configuration ---

def initialize_firebase():
    """Initializes Firebase Admin SDK."""
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        initialize_app(cred)
        print("Firebase Admin SDK Initialized Successfully.")
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        exit(1)

def get_existing_room_ids(db_client, collection_name):
    """Fetches all document IDs from the specified Firestore collection."""
    print(f"Fetching existing document IDs from '{collection_name}'...")
    try:
        docs = db_client.collection(collection_name).stream()
        room_ids = {doc.id for doc in docs}
        print(f"Found {len(room_ids)} existing room IDs.")
        return room_ids
    except Exception as e:
        print(f"Error fetching room IDs from Firestore: {e}")
        return set()

def analyze_image_labels(vision_client, gcs_uri):
    """Uses Cloud Vision API to get labels for an image stored in GCS."""
    try:
        image = vision.Image()
        image.source.image_uri = gcs_uri
        response = vision_client.label_detection(image=image)
        if response.error.message:
            print(f"Vision API error for {gcs_uri}: {response.error.message}")
            return []
        return [label.description.lower() for label in response.label_annotations]
    except Exception as e:
        print(f"Error analyzing image {gcs_uri} with Vision API: {e}")
        return []

def categorize_image(labels):
    """Categorizes image based on detected labels and predefined keywords."""
    detected_categories = set()
    is_potential_cover = False

    if not labels:
        return 'other', False # Default if no labels

    label_set = set(labels)

    # Check for cover photo keywords first
    if not COVER_PHOTO_KEYWORDS.isdisjoint(label_set):
         is_potential_cover = True
         # Try to assign a more specific category if possible
         if not CATEGORY_KEYWORDS['exterior_view'].isdisjoint(label_set):
             detected_categories.add('exterior_view')
         if not CATEGORY_KEYWORDS['balcony_patio'].isdisjoint(label_set):
             detected_categories.add('balcony_patio')


    # Check other categories
    for category, keywords in CATEGORY_KEYWORDS.items():
        if category in ['exterior_view', 'balcony_patio']: # Already checked if potential cover
            continue
        if not keywords.isdisjoint(label_set):
            detected_categories.add(category)

    # Determine final category (simple logic: pick one if found, else 'other')
    if 'kitchen' in detected_categories:
        final_category = 'kitchen'
    elif 'bathroom' in detected_categories:
        final_category = 'bathroom'
    elif 'bedroom' in detected_categories:
        final_category = 'bedroom'
    elif 'living_room' in detected_categories:
        final_category = 'living_room'
    elif 'dining_area' in detected_categories:
        final_category = 'dining_area'
    elif 'balcony_patio' in detected_categories:
         final_category = 'balcony_patio'
    elif 'exterior_view' in detected_categories:
         final_category = 'exterior_view'
    elif detected_categories:
         final_category = list(detected_categories)[0] # Pick first detected if specific logic fails
    else:
        final_category = 'other'


    # If it wasn't flagged as cover by keywords, but is a primary room type, consider it weakly
    if not is_potential_cover and final_category in ['living_room', 'bedroom', 'exterior_view', 'balcony_patio']:
         # You could add logic here to make these weaker candidates than keyword matches
         pass # For now, only explicit keywords make it a strong candidate

    # If it has view keywords, ensure category reflects it somewhat
    if is_potential_cover and final_category not in ['exterior_view', 'balcony_patio']:
        final_category = 'exterior_view' # Prioritize view category if view keywords present

    return final_category, is_potential_cover


def upload_image_to_gcs(storage_client, bucket_name, source_file_path, room_id):
    """Uploads an image file to GCS and returns the public URL and GCS URI."""
    try:
        bucket = storage_client.bucket(bucket_name)
        # Create a unique blob name
        file_extension = os.path.splitext(source_file_path)[1]
        blob_name = f"rooms/{room_id}/{uuid.uuid4()}{file_extension}"
        blob = bucket.blob(blob_name)

        print(f"  Uploading {os.path.basename(source_file_path)} to gs://{bucket_name}/{blob_name}")
        blob.upload_from_filename(source_file_path)

        # Make blob publicly readable (Adjust ACL/IAM policies as needed for your security)
        blob.make_public()

        public_url = blob.public_url
        gcs_uri = f"gs://{bucket_name}/{blob_name}"
        return public_url, gcs_uri
    except Exception as e:
        print(f"Error uploading {source_file_path} to GCS: {e}")
        return None, None

def process_room_images(db_client, storage_client, vision_client, room_id, room_folder_path, bucket_name):
    """Processes all images in a specific room's folder."""
    print(f"\nProcessing folder for Room ID: {room_id}")
    image_data_for_firestore = []
    potential_cover_photos = [] # Store tuples of (url, category)

    if not os.path.isdir(room_folder_path):
        print(f"  Warning: Folder not found: {room_folder_path}")
        return

    for filename in os.listdir(room_folder_path):
        if filename.lower().endswith(ALLOWED_IMAGE_EXTENSIONS):
            file_path = os.path.join(room_folder_path, filename)

            # 1. Upload to GCS
            public_url, gcs_uri = upload_image_to_gcs(storage_client, bucket_name, file_path, room_id)
            if not public_url or not gcs_uri:
                continue # Skip if upload failed

            # 2. Analyze with Vision API
            print(f"  Analyzing {filename}...")
            labels = analyze_image_labels(vision_client, gcs_uri)

            # 3. Categorize
            category, is_potential_cover = categorize_image(labels)
            print(f"  Categorized '{filename}' as: {category} (Potential Cover: {is_potential_cover})")

            image_info = {'url': public_url, 'category': category, 'labels': labels} # Store labels for debugging/refinement
            image_data_for_firestore.append(image_info)

            if is_potential_cover:
                potential_cover_photos.append(image_info) # Add the whole dict

    # 4. Select Cover Photo
    cover_image_url = None
    if potential_cover_photos:
        # Simple logic: pick the first potential cover photo found
        # More complex: score based on category ('exterior_view' > 'balcony' > 'living_room') or label confidence
        cover_image_url = potential_cover_photos[0]['url']
        print(f"  Selected cover photo: {cover_image_url} (Category: {potential_cover_photos[0]['category']})")
         # Mark the selected cover photo in the main list
        for img_data in image_data_for_firestore:
            if img_data['url'] == cover_image_url:
                img_data['isCover'] = True # Add a flag
            else:
                img_data['isCover'] = False

    elif image_data_for_firestore: # If no "potential" covers, pick the first image overall
         cover_image_url = image_data_for_firestore[0]['url']
         image_data_for_firestore[0]['isCover'] = True
         for i in range(1, len(image_data_for_firestore)):
              image_data_for_firestore[i]['isCover'] = False
         print(f"  No ideal cover photo found. Selected first image as default: {cover_image_url}")


    # 5. Update Firestore
    if image_data_for_firestore:
        try:
            room_ref = db_client.collection(FIRESTORE_ROOMS_COLLECTION).document(room_id)
            print(f"  Updating Firestore for {room_id} with {len(image_data_for_firestore)} images...")
            # Using update merges data, set would overwrite the whole document
            room_ref.update({
                'imageUrls': image_data_for_firestore, # Overwrites/adds this field
                'coverImageUrl': cover_image_url # Store the selected cover URL separately for easy access
            })
            print(f"  Firestore updated successfully for {room_id}.")
        except Exception as e:
            print(f"  Error updating Firestore for {room_id}: {e}")
    else:
        print(f"  No images processed or uploaded for {room_id}.")


# --- Main Execution ---
if __name__ == "__main__":
    # Initialize clients
    db = initialize_firebase()
    storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)
    vision_client = vision.ImageAnnotatorClient.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)

    # Get existing room IDs from Firestore
    existing_rooms = get_existing_room_ids(db, FIRESTORE_ROOMS_COLLECTION)

    if not existing_rooms:
        print("No existing rooms found in Firestore. Exiting.")
        exit()

    if not os.path.isdir(BASE_IMAGE_FOLDER):
        print(f"Error: Base image folder not found at '{BASE_IMAGE_FOLDER}'")
        exit(1)

    print(f"\nStarting image processing in '{BASE_IMAGE_FOLDER}'...")

    # Iterate through folders in the base directory
    processed_count = 0
    skipped_count = 0
    for item_name in os.listdir(BASE_IMAGE_FOLDER):
        item_path = os.path.join(BASE_IMAGE_FOLDER, item_name)
        # Check if it's a directory AND its name matches an existing room ID
        if os.path.isdir(item_path):
            room_id = item_name
            if room_id in existing_rooms:
                process_room_images(db, storage_client, vision_client, room_id, item_path, GCS_BUCKET_NAME)
                processed_count += 1
            else:
                print(f"\nSkipping folder '{item_name}': No matching Room ID found in Firestore.")
                skipped_count += 1
        else:
             # Optional: print warning for non-directory items
             # print(f"Skipping non-directory item: {item_name}")
             pass


    print(f"\n--- Processing Complete ---")
    print(f"Processed folders for {processed_count} existing rooms.")
    print(f"Skipped {skipped_count} folders (no matching room ID).")