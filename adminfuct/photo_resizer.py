import os
import shutil
from PIL import Image
import logging

# --- Configuration ---
SOURCE_DIR = r'C:\Users\jatro\Documents\Vacprop\Upload' # <<< CHANGE THIS to your original folder
OUTPUT_DIR = r'C:\Users\jatro\Documents\Vacprop\webSize' # <<< CHANGE THIS where ALL processed images will go
MAX_TARGET_WIDTH = 1600      # Resize images wider than this DOWN to this width
# Optional: Keep originals of smaller images?
COPY_SMALLER_AS_IS = True    # If True, copy images already <= MAX_TARGET_WIDTH
                             # If False, potentially upscale smaller images to MAX_TARGET_WIDTH (like before)

# Image formats to process (case-insensitive)
ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
# --- End Configuration ---

# --- Helper Function (Slightly adjusted for clarity) ---
def resize_image_if_needed(input_path, output_path, max_width):
    """Resizes an image proportionally only if its width exceeds max_width."""
    try:
        with Image.open(input_path) as img:
            img_format = img.format
            img_info = img.info
            width, height = img.size

            if width == 0 or height == 0:
                 logging.warning(f"Skipping invalid image (zero dimension): {input_path}")
                 return False, "skipped_invalid"

            target_width = width
            target_height = height
            resized = False

            # --- Logic Change: Only resize if wider than max_width ---
            if width > max_width:
                aspect_ratio = height / width
                target_width = max_width
                target_height = int(target_width * aspect_ratio)
                resized = True
                logging.info(f"Resizing {os.path.basename(input_path)} from {width}x{height} to {target_width}x{target_height}")
                # Use LANCZOS for high-quality downsampling
                resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            # --- Optional: Handle smaller images ---
            elif not COPY_SMALLER_AS_IS and width < max_width:
                 # This block enables upscaling if COPY_SMALLER_AS_IS is False
                 aspect_ratio = height / width
                 target_width = max_width
                 target_height = int(target_width * aspect_ratio)
                 resized = True
                 logging.info(f"Upscaling {os.path.basename(input_path)} from {width}x{height} to {target_width}x{target_height}")
                 resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            else:
                # Image is already <= max_width and COPY_SMALLER_AS_IS is True
                # Or image is exactly max_width
                logging.info(f"Image {os.path.basename(input_path)} ({width}x{height}) does not need resizing. Copying.")
                shutil.copy2(input_path, output_path) # Copy original file with metadata
                return True, "copied"
            # --- End Logic Change ---


            # --- Save logic (only if resized/upscaled) ---
            if resized:
                # Handle transparency for PNGs/GIFs
                save_options = {'quality': 90, 'optimize': True}
                if 'transparency' in img_info:
                     save_options['transparency'] = img_info['transparency']
                if 'duration' in img_info: # Preserve animation info for GIF/WebP if possible
                    save_options['duration'] = img_info['duration']
                    save_options['loop'] = img_info.get('loop', 0)
                    save_options['save_all'] = True # Important for animated formats
                    save_options['append_images'] = getattr(img, 'is_animated', False) and hasattr(img, '__iter__') and list(img)[1:] or []


                output_format = img_format if img_format in ['PNG', 'GIF', 'WEBP'] else 'JPEG'
                if output_format == 'JPEG' and resized_img.mode in ('RGBA', 'P'):
                    resized_img = resized_img.convert('RGB')

                # Combine metadata and save options
                combined_options = {**img_info, **save_options}
                # Pillow save doesn't like unknown kwargs from info dict sometimes, filter common ones
                known_save_args = ['quality', 'optimize', 'transparency', 'duration', 'loop', 'save_all', 'append_images', 'icc_profile', 'exif']
                filtered_options = {k: v for k, v in combined_options.items() if k in known_save_args}


                resized_img.save(output_path, format=output_format, **filtered_options)

                # Verification (Optional but good)
                if os.path.exists(output_path):
                     with Image.open(output_path) as saved_img:
                        saved_width, saved_height = saved_img.size
                        # Allow for tiny rounding differences in height calc
                        if saved_width == target_width and abs(saved_height - target_height) <= 1:
                            logging.info(f"Successfully saved and verified resized image: {output_path}")
                            return True, "resized"
                        else:
                            logging.error(f"Verification failed for {output_path}. Expected ~{target_width}x{target_height}, got {saved_width}x{saved_height}")
                            return False, "error_verification"
                else:
                    logging.error(f"Failed to save image, file not found after save attempt: {output_path}")
                    return False, "error_save"
            else:
                 # Should have been caught by the copy branch above, but as failsafe
                 return False, "error_logic"


    except Exception as e:
        logging.error(f"Error processing {input_path}: {e}")
        return False, "error_exception"

# --- Main Processing Logic (Simplified) ---
def process_all_images(source_root, output_root):
    """Walks through source directory, processes all images into output directory."""
    if not os.path.isdir(source_root):
        logging.error(f"Source directory not found: {source_root}")
        return

    logging.info(f"Starting image processing...")
    logging.info(f"Source: {source_root}")
    logging.info(f"Output Destination: {output_root}")
    logging.info(f"Target Max Width: {MAX_TARGET_WIDTH}px")
    logging.info(f"Copy smaller images without resizing: {COPY_SMALLER_AS_IS}")

    processed_count = 0
    resized_count = 0
    copied_count = 0
    error_count = 0
    skipped_count = 0

    os.makedirs(output_root, exist_ok=True)

    for root, _, files in os.walk(source_root):
        for filename in files:
            if filename.lower().endswith(ALLOWED_EXTENSIONS):
                input_path = os.path.join(root, filename)
                # Create relative path for output structure
                relative_dir = os.path.relpath(root, source_root)
                output_dir_for_file = os.path.join(output_root, relative_dir)
                output_path = os.path.join(output_dir_for_file, filename)

                os.makedirs(output_dir_for_file, exist_ok=True)

                processed_count += 1
                success, action = resize_image_if_needed(input_path, output_path, MAX_TARGET_WIDTH)

                if success:
                    if action == "resized":
                        resized_count += 1
                    elif action == "copied":
                        copied_count += 1
                else:
                    if action == "skipped_invalid":
                        skipped_count += 1
                    else: # Any other error
                        error_count += 1
            else:
                # Optional: Copy non-image files?
                # logging.debug(f"Skipping non-image file: {filename}")
                pass

    logging.info("-" * 30)
    logging.info("Processing Summary:")
    logging.info(f"Total files scanned (matching extensions): {processed_count}")
    logging.info(f"Images resized and saved to '{output_root}': {resized_count}")
    logging.info(f"Images copied (already at/below target size) to '{output_root}': {copied_count}")
    logging.info(f"Images skipped due to errors/invalid format: {error_count + skipped_count}")
    logging.info("-" * 30)

# --- Run the script ---
if __name__ == "__main__":
    # --- IMPORTANT: Verify paths before running! ---
    print(f"WARNING: This script will process files in: {SOURCE_DIR}")
    print(f"ALL processed images (resized or copied) will be saved to: {OUTPUT_DIR}")
    print(f"Images wider than {MAX_TARGET_WIDTH}px will be RESIZED DOWN.")
    if COPY_SMALLER_AS_IS:
        print(f"Images {MAX_TARGET_WIDTH}px wide or smaller will be COPIED AS-IS.")
    else:
         print(f"Images smaller than {MAX_TARGET_WIDTH}px wide will be RESIZED UP (upscaled).")
    print("Original files in the source directory will NOT be deleted.")
    print("-" * 20)

    confirm = input("Do you want to proceed? (yes/no): ").strip().lower()
    if confirm == 'yes':
        # Use different source/output dirs for this version
        process_all_images(SOURCE_DIR, OUTPUT_DIR)
    else:
        print("Operation cancelled.")