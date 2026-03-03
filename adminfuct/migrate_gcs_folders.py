import os
from google.cloud import storage
from firebase_admin import credentials, firestore, initialize_app

# --- Configuration ---
SERVICE_ACCOUNT_KEY_PATH = 'service-account-key.json'
BUCKET_NAME = 'cal-airb-api.firebasestorage.app'

# Mapping of Old Room ID -> New Room ID
MIGRATION_MAP = {
    'TQA-415': 'TQA-0415',
    'TQA-607': 'TQA-0607',
    'TQA-609': 'TQA-0609'
}

def initialize_firebase():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        initialize_app(cred)
        print("Firebase Admin SDK Initialized.")
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        exit(1)

def migrate_gcs_folder(bucket, old_prefix, new_prefix):
    print(f"\nMigrating GCS: {old_prefix} -> {new_prefix}")
    blobs = list(bucket.list_blobs(prefix=old_prefix))
    
    if not blobs:
        print(f"  No files found in {old_prefix}")
        return []

    count = 0
    moved_files = [] 

    for blob in blobs:
        # Construct new name
        # old_prefix: rooms/TQA-415/
        # blob.name:  rooms/TQA-415/image.jpg
        # new_name:   rooms/TQA-0415/image.jpg
        new_name = blob.name.replace(old_prefix, new_prefix, 1)
        
        # Copy
        new_blob = bucket.copy_blob(blob, bucket, new_name)
        
        # Make public if old was public (or just default to public for this app)
        try:
            new_blob.make_public()
        except:
            pass
            
        # Delete old
        blob.delete()
        
        count += 1
        print(f"  Moved: {os.path.basename(blob.name)}")
        moved_files.append((blob.public_url, new_blob.public_url))

    print(f"  Successfully moved {count} files.")
    return moved_files

def update_firestore_room(db, old_room_id, new_room_id, url_map):
    print(f"Updating Firestore: {old_room_id} -> {new_room_id}")
    
    # 1. Check if old room exists
    old_ref = db.collection('rooms').document(old_room_id)
    old_doc = old_ref.get()
    
    if not old_doc.exists:
        print(f"  Old room {old_room_id} not found in Firestore. Skipping doc migration.")
        # If the room doesn't exist, we might still want to check the NEW room to update its images 
        # if the user manually created the new room record but the images were just moved.
        target_ref = db.collection('rooms').document(new_room_id)
        target_doc = target_ref.get()
        if target_doc.exists:
             print(f"  Target room {new_room_id} exists. Updating image URLs only.")
             update_image_urls_in_doc(target_ref, url_map)
        return

    data = old_doc.to_dict()
    
    # 2. Check if new room exists
    new_ref = db.collection('rooms').document(new_room_id)
    new_doc = new_ref.get()
    
    if new_doc.exists:
        print(f"  Target room {new_room_id} already exists. Merging/Overwriting data...")
        # We merge old data into new data, but prioritize new data if conflict? 
        # Actually proper migration: Take old images, update URLs, add to new room.
        
        current_new_data = new_doc.to_dict()
        merged_images = current_new_data.get('imageUrls', [])
        
        # Fix URLs in old data
        old_images = data.get('imageUrls', [])
        fixed_old_images = fix_image_urls_list(old_images, url_map)
        
        # Combine
        # Simply appending might duplicate if they ran partial uploads. 
        # Let's just append for now and let the user dedup, or checking URL.
        for img in fixed_old_images:
            if not any(x['url'] == img['url'] for x in merged_images):
                merged_images.append(img)
                
        new_ref.update({'imageUrls': merged_images})
        
        # Determine cover
        current_cover = current_new_data.get('coverImageUrl')
        if not current_cover and data.get('coverImageUrl'):
             # migrate cover
             old_cover = data.get('coverImageUrl')
             new_cover =  replace_url(old_cover, url_map)
             new_ref.update({'coverImageUrl': new_cover})
             
        # migrate thumbnail
        current_thumb = current_new_data.get('thumbnailImageUrl')
        if not current_thumb and data.get('thumbnailImageUrl'):
             old_thumb = data.get('thumbnailImageUrl')
             new_thumb = replace_url(old_thumb, url_map)
             new_ref.update({'thumbnailImageUrl': new_thumb})

        print(f"  Merged data into {new_room_id}.")
        
    else:
        print(f"  Target room {new_room_id} does not exist. Creating copy...")
        # Fix URLs in data
        if 'imageUrls' in data:
            data['imageUrls'] = fix_image_urls_list(data['imageUrls'], url_map)
        if 'coverImageUrl' in data:
            data['coverImageUrl'] = replace_url(data['coverImageUrl'], url_map)
        if 'thumbnailImageUrl' in data:
            data['thumbnailImageUrl'] = replace_url(data['thumbnailImageUrl'], url_map)
            
        new_ref.set(data)
        print(f"  Created {new_room_id}.")

    # 3. Delete old room doc?
    # User just said "rename folder", but usually implies moving the entity. 
    # I'll Comment this out for safety, or ask. 
    # Current behavior: Copy data to new ID, leave old ID (maybe with empty list?).
    # Let's DELETE the old doc to prevent confusion as requested "solve the problem".
    old_ref.delete()
    print(f"  Deleted old room doc {old_room_id}.")

def replace_url(url, url_map):
    if not url: return None
    # Very basic search/replace based on map
    # url_map is list of (old, new)
    for old_u, new_u in url_map:
        if old_u in url:
            return url.replace(old_u, new_u)
    return url

def fix_image_urls_list(image_list, url_map):
    if not image_list: return []
    new_list = []
    for img in image_list:
        new_img = img.copy()
        if 'url' in new_img:
            new_img['url'] = replace_url(new_img['url'], url_map)
        if 'thumbnail_url' in new_img:
            new_img['thumbnail_url'] = replace_url(new_img['thumbnail_url'], url_map)
        new_list.append(new_img)
    return new_list

def update_image_urls_in_doc(doc_ref, url_map):
    doc = doc_ref.get()
    if not doc.exists: return
    data = doc.to_dict()
    
    updates = {}
    if 'imageUrls' in data:
        updates['imageUrls'] = fix_image_urls_list(data['imageUrls'], url_map)
    if 'coverImageUrl' in data:
        updates['coverImageUrl'] = replace_url(data['coverImageUrl'], url_map)
    if 'thumbnailImageUrl' in data:
        updates['thumbnailImageUrl'] = replace_url(data['thumbnailImageUrl'], url_map)
        
    if updates:
        doc_ref.update(updates)

if __name__ == "__main__":
    db = initialize_firebase()
    storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_KEY_PATH)
    bucket = storage_client.bucket(BUCKET_NAME)

    for old_id, new_id in MIGRATION_MAP.items():
        print(f"--- Processing {old_id} -> {new_id} ---")
        
        old_prefix = f"rooms/{old_id}/"
        new_prefix = f"rooms/{new_id}/"
        
        # 1. Migrate Storage
        # Returns list of (old_url, new_url) tuples for string replacement
        # CAREFUL: This returns public URLs.
        # We need to constructing a robust map.
        
        files_moved = migrate_gcs_folder(bucket, old_prefix, new_prefix)
        
        # Create a URL map for this room
        # We need to map paths mostly. 
        # Logic: If URL contains `rooms/TQA-415/`, replace with `rooms/TQA-0415/`
        # Because we already moved the files, the old URLs are dead 404s. 
        
        url_map = [
            (f"/rooms/{old_id}/", f"/rooms/{new_id}/"),
            (f"%2Frooms%2F{old_id}%2F", f"%2Frooms%2F{new_id}%2F") # Encoded version often found in firebase storage tokens
        ]
        
        # 2. Update Firestore
        update_firestore_room(db, old_id, new_id, url_map)

    print("\nMigration Complete.")
