import pandas as pd
import json

# Step 1: Load the JSON data from the file
try:
    with open(r"C:\Users\jatro\Dev\allProp.json", "r") as file:
        data = json.load(file)
except FileNotFoundError:
    print("Error: 'allProp.json' file not found at 'C:\\Users\\jatro\\Dev\\allProp.json'.")
    exit(1)
except json.JSONDecodeError:
    print("Error: Invalid JSON format in 'allProp.json'.")
    exit(1)

# Step 2: Check the structure of the loaded data and extract the rooms list
if not isinstance(data, dict):
    print(f"Error: Expected a dictionary with a 'rooms' key, but got {type(data)}. Contents: {data}")
    exit(1)

if "rooms" not in data or "hotels" not in data:
    print("Error: 'rooms' or 'hotels' key not found in the JSON data.")
    exit(1)

rooms = data["rooms"]
hotels = data["hotels"]

if not isinstance(rooms, list) or not isinstance(hotels, list):
    print(f"Error: Expected lists under 'rooms' and 'hotels' keys. Got rooms: {type(rooms)}, hotels: {type(hotels)}")
    exit(1)

# Create a mapping of property codes to hotel names
hotel_mapping = {hotel["code"]: hotel["name"] for hotel in hotels}

# Step 3: Flatten the nested list of rooms
flattened_rooms = []
for room_sublist in rooms:
    if isinstance(room_sublist, list):
        # If room_sublist is a list, extend flattened_rooms with its elements
        flattened_rooms.extend(room_sublist)
    elif isinstance(room_sublist, dict):
        # If room_sublist is a dictionary, append it directly
        flattened_rooms.append(room_sublist)
    else:
        print(f"Warning: Unexpected type for room: {type(room_sublist)}. Room: {room_sublist}")
        continue

# Step 4: Flatten the JSON data and add hotel name
flattened_data = []
for room in flattened_rooms:
    if not isinstance(room, dict):
        print(f"Error: Expected a dictionary for room, but got {type(room)}. Room: {room}")
        continue
    try:
        property_code = room.get("extendedProps", {}).get("property", "")
        hotel_name = hotel_mapping.get(property_code, "Unknown Hotel")
        row = {
            "id": room.get("id", ""),
            "title": room.get("title", ""),
            "roomNumber": room.get("extendedProps", {}).get("roomNumber", ""),
            "roomType": room.get("extendedProps", {}).get("roomType", ""),
            "property": property_code,
            "hotelName": hotel_name,  # New column
            "url": room.get("extendedProps", {}).get("url", ""),
            "iCal": room.get("extendedProps", {}).get("iCal", "")
        }
        flattened_data.append(row)
    except Exception as e:
        print(f"Warning: Error processing room {room.get('id', 'unknown')}: {e}")

# Step 5: Check if any data was processed
if not flattened_data:
    print("Error: No valid room data was processed. Please check the structure of 'allProp.json'.")
    exit(1)

# Step 6: Convert to a pandas DataFrame and sort by roomNumber
df = pd.DataFrame(flattened_data)
df.sort_values(by="roomNumber", inplace=True)

# Step 7: Export to Excel
output_file = r"C:\Users\jatro\Dev\rooms_output.xlsx"
try:
    df.to_excel(output_file, index=False, engine="openpyxl")
    print(f"Excel file '{output_file}' has been created successfully!")
except Exception as e:
    print(f"Error writing to Excel file: {e}")
    exit(1)