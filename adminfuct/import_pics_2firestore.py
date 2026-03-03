import os
import uuid
import argparse
import io
import mimetypes
import shutil
from PIL import Image
from google.cloud import storage, vision
from firebase_admin import credentials, firestore, initialize_app

# --- Configuration ---
SERVICE_ACCOUNT_KEY_PATH = 'service-account-key.json' # <<<--- CHANGE THIS PATH
GCS_BUCKET_NAME = 'cal-airb-api.firebasestorage.app' # <<<--- CHANGE THIS PATH
FIRESTORE_ROOMS_COLLECTION = 'rooms'
ALLOWED_IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif')

# Resizing Constants
MAX_WEB_WIDTH = 1600
THUMBNAIL_SIZE = (300, 300)
WEB_SUBFOLDER_NAME = 'web_1600'
BIG_IMAGE_GCS_SUBFOLDER = 'bigimage'

# Categories and keywords
CATEGORY_KEYWORDS = {
    'kitchen': {'kitchen', 'sink', 'refrigerator', 'oven', 'countertop', 'microwave', 'kitchen appliance', 'cabinetry'},
    'bathroom': {'bathroom', 'toilet', 'sink', 'shower', 'bathtub', 'washbasin'},
    'bedroom': {'bedroom', 'bed', 'nightstand', 'dresser', 'wardrobe'},
    'living_room': {'living room', 'sofa', 'couch', 'coffee table', 'television', 'armchair', 'lounge'},
    'dining_area': {'dining room', 'dining table', 'chair'},
    'balcony_patio': {'balcony', 'patio', 'terrace', 'deck'},
    'exterior_view': {'building exterior', 'facade', 'window', 'landscape', 'cityscape', 'ocean', 'mountain', 'view', 'sky', 'pool', 'canal', 'water', 'garden', 'yard', 'outdoor', 'exterior'},
    'other': set()
}

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
        return 'other', False

    label_set = set(labels)

    if not COVER_PHOTO_KEYWORDS.isdisjoint(label_set):
         is_potential_cover = True
         if not CATEGORY_KEYWORDS['exterior_view'].isdisjoint(label_set):
             detected_categories.add('exterior_view')
         if not CATEGORY_KEYWORDS['balcony_patio'].isdisjoint(label_set):
             detected_categories.add('balcony_patio')

    for category, keywords in CATEGORY_KEYWORDS.items():
        if category in ['exterior_view', 'balcony_patio']:
            continue
        if not keywords.isdisjoint(label_set):
            detected_categories.add(category)

    if 'kitchen' in detected_categories: final_category = 'kitchen'
    elif 'bathroom' in detected_categories: final_category = 'bathroom'
    elif 'bedroom' in detected_categories: final_category = 'bedroom'
    elif 'living_room' in detected_categories: final_category = 'living_room'
    elif 'dining_area' in detected_categories: final_category = 'dining_area'
    elif 'balcony_patio' in detected_categories: final_category = 'balcony_patio'
    elif 'exterior_view' in detected_categories: final_category = 'exterior_view'
    elif detected_categories: final_category = list(detected_categories)[0]
    else: final_category = 'other'

    if not is_potential_cover and final_category in ['living_room', 'bedroom', 'exterior_view', 'balcony_patio']:
         pass

    if is_potential_cover and final_category not in ['exterior_view', 'balcony_patio']:
        final_category = 'exterior_view'

    return final_category, is_potential_cover

def upload_file_to_gcs(bucket, local_path, blob_name, make_public=True):
    """Uploads a single file to GCS."""
    blob = bucket.blob(blob_name)
    if not blob.exists():
        print(f"    Uploading {blob_name}...")
        blob.upload_from_filename(local_path)
    else:
        print(f"    Skipping {blob_name} (already exists).")
    
    if make_public:
        blob.reload()
        if 'allUsers' not in blob.acl or blob.acl['allUsers']['role'] != 'READER':
            blob.make_public()
    
    return blob.public_url

def resize_image(input_path, output_path, max_width):
    """Resizes image to max_width maintaining aspect ratio."""
    try:
        with Image.open(input_path) as img:
            width, height = img.size
            if width > max_width:
                ratio = max_width / width
                new_height = int(height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                
            # Copy if smaller or equal, but always save to ensure connection
            # If smaller, just save as is (or converted if needed)
            
            # Convert to RGB if necessary (e.g. for JPEG)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            img.save(output_path, quality=90, optimize=True)
            return True
    except Exception as e:
        print(f"    Error resizing {input_path}: {e}")
        return False

def create_thumbnail(input_path, output_path, size):
    """Creates a thumbnail."""
    try:
        with Image.open(input_path) as img:
            img.thumbnail(size)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(output_path, format='JPEG', quality=85)
            return True
    except Exception as e:
        print(f"    Error creating thumbnail {input_path}: {e}")
        return False

def process_single_room_workflow(db_client, storage_client, vision_client, room_id, source_dir, output_root=None):
    """
    Full workflow for a single room:
    1. Upload Originals -> GCS bigimage/
    2. Resize Local -> web_1600/
    3. Upload Resized -> GCS root/
    4. Vision API Analysis
    5. Generate Thumbnail for Cover
    6. Update Firestore
    """
    print(f"\nProcessing Room: {room_id} from {source_dir}")
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    
    # Paths
    if output_root:
        local_web_dir = os.path.join(output_root, room_id, WEB_SUBFOLDER_NAME)
    else:
        local_web_dir = os.path.join(source_dir, WEB_SUBFOLDER_NAME)
        
    os.makedirs(local_web_dir, exist_ok=True)
    
    image_data_list = []
    potential_covers = []
    
    # Iterate through source files (Originals)
    files = [f for f in os.listdir(source_dir) if f.lower().endswith(ALLOWED_IMAGE_EXTENSIONS)]
    
    for filename in files:
        local_file_path = os.path.join(source_dir, filename)
        
        # 1. Upload Original to bigimage/
        bigimage_blob_name = f"rooms/{room_id}/{BIG_IMAGE_GCS_SUBFOLDER}/{filename}"
        upload_file_to_gcs(bucket, local_file_path, bigimage_blob_name)
        
        # 2. Resize Local
        resized_filename = filename # Keep same name
        local_resized_path = os.path.join(local_web_dir, resized_filename)
        
        if not os.path.exists(local_resized_path):
            print(f"    Resizing {filename} to {MAX_WEB_WIDTH}px...")
            if not resize_image(local_file_path, local_resized_path, MAX_WEB_WIDTH):
                continue
        
        # 3. Upload Resized to GCS Root
        web_blob_name = f"rooms/{room_id}/{filename}"
        public_url = upload_file_to_gcs(bucket, local_resized_path, web_blob_name)
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{web_blob_name}"
        
        # 4. Analyze
        print(f"    Analyzing {filename}...")
        labels = analyze_image_labels(vision_client, gcs_uri)
        category, is_potential_cover = categorize_image(labels)
        
        img_info = {
            'url': public_url,
            'category': category,
            'labels': labels,
            '_local_path': local_resized_path, # Store for all, remove later
            '_filename': filename
        }
        image_data_list.append(img_info)
        
        if is_potential_cover:
            potential_covers.append(img_info)

    # 5. Select Cover & Generate Thumbnail
    cover_image_url = None
    selected_cover_data = None

    if potential_covers:
        selected_cover_data = potential_covers[0]
        cover_image_url = selected_cover_data['url']
        print(f"  Selected cover: {selected_cover_data['_filename']} ({selected_cover_data['category']})")
    elif image_data_list:
        # Fallback to first image
        selected_cover_data = image_data_list[0]
        cover_image_url = selected_cover_data['url']
        print(f"  No specific cover found. Using first image as cover: {selected_cover_data['_filename']}")

    # Mark isCover in list
    if cover_image_url:
        for img in image_data_list:
            img['isCover'] = (img['url'] == cover_image_url)

        # Generate Thumbnail
        if selected_cover_data and '_local_path' in selected_cover_data:
            local_thumb_path = os.path.join(local_web_dir, f"thumb_{selected_cover_data['_filename']}")
            print(f"    Generating thumbnail for cover...")
            if create_thumbnail(selected_cover_data['_local_path'], local_thumb_path, THUMBNAIL_SIZE):
                thumb_blob_name = f"rooms/{room_id}/{os.path.basename(local_thumb_path)}"
                thumb_url = upload_file_to_gcs(bucket, local_thumb_path, thumb_blob_name)
                
                # Assign thumb url
                selected_cover_data['thumbnail_url'] = thumb_url
                print(f"    Thumbnail uploaded: {thumb_url}")

    # Clean up internal keys
    for img in image_data_list:
        img.pop('_local_path', None)
        img.pop('_filename', None)

    # 6. Update Firestore
    if image_data_list:
        print(f"  Updating Firestore for {room_id}...")
        doc_ref = db_client.collection(FIRESTORE_ROOMS_COLLECTION).document(room_id)
        
        # Create doc if not exists
        if not doc_ref.get().exists:
             doc_ref.set({})

        update_data = {
            'imageUrls': image_data_list,
            'coverImageUrl': cover_image_url
        }
        doc_ref.update(update_data)
        print("  Firestore update complete.")
    else:
        print(f"  No images processed for {room_id}.")

if __name__ == "__main__":
    def normalize_room_id(rid):
        """Ensures TQA rooms have 4 digits (e.g. TQA-415 -> TQA-0415)"""
        if rid.upper().startswith('TQA-'):
            parts = rid.split('-')
            if len(parts) == 2 and parts[1].isdigit() and len(parts[1]) == 3:
                return f"{parts[0].upper()}-0{parts[1]}"
        return rid.upper() # Default normalization

    parser = argparse.ArgumentParser()
    parser.add_argument('--base_dir', help='Base Directory containing room folders (e.g., C:\\Users\\Johan\\Documents\\Vacprop)')
    parser.add_argument('--output_dir', help='Optional: Directory to save resized images if source is not writable')
    parser.add_argument('--room_ids', nargs='+', help='List of Room IDs to process (folder names must match)', required=True)
    
    args = parser.parse_args()
    
    db = initialize_firebase()
    storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)
    vision_client = vision.ImageAnnotatorClient.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)

    if args.base_dir:
        base_path = args.base_dir
    else:
        # Default fallback or current dir
        base_path = os.getcwd()

    for raw_room_id in args.room_ids:
        # Normalize ID (e.g. TQA-415 -> TQA-0415)
        room_id = normalize_room_id(raw_room_id)
        if room_id != raw_room_id:
             print(f"  Normalized Room ID: {raw_room_id} -> {room_id}")

        # Directory name might still be the old one (TQA-415). Check both.
        room_dir = os.path.join(base_path, raw_room_id)
        if not os.path.exists(room_dir):
             # Try normalized name folder
             room_dir_norm = os.path.join(base_path, room_id)
             if os.path.exists(room_dir_norm):
                 room_dir = room_dir_norm
             else:
                print(f"Error: Room directory not found: {raw_room_id} (or {room_id})")
                continue
            
        process_single_room_workflow(db, storage_client, vision_client, room_id, room_dir, args.output_dir)

    print("\n--- Batch Processing Complete ---")
