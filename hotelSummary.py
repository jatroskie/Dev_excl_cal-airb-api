# hotelSummary.py
# FINAL WORKING VERSION – handles all nested lists in your file

import json
from collections import Counter

# -------------------------------------------------
# 1. Load the JSON
# -------------------------------------------------
with open("allProp.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# -------------------------------------------------
# 2. Property code → name map
# -------------------------------------------------
property_map = {h["code"]: h["name"] for h in data["hotels"]}

# -------------------------------------------------
# 3. Flatten ALL rooms (handles any level of nested lists)
# -------------------------------------------------
def flatten_rooms(item):
    """Recursively extract room objects from nested lists"""
    rooms = []
    if isinstance(item, dict) and "id" in item and "extendedProps" in item:
        rooms.append(item)
    elif isinstance(item, list):
        for sub in item:
            rooms.extend(flatten_rooms(sub))
    return rooms

all_rooms = []
for entry in data["rooms"]:
    all_rooms.extend(flatten_rooms(entry))

print(f"Found {len(all_rooms)} rooms total")

# -------------------------------------------------
# 4. Group by property
# -------------------------------------------------
rooms_by_property = {}
for room in all_rooms:
    props = room.get("extendedProps", {})
    prop_code = props.get("property", "UNKNOWN")
    rooms_by_property.setdefault(prop_code, []).append(room)

# -------------------------------------------------
# 5. Generate Markdown report
# -------------------------------------------------
lines = ["# Property Room Inventory Report\n"]
lines.append(f"_Generated on {__import__('datetime').datetime.now():%B %d, %Y}_\n")

for prop_code in sorted(rooms_by_property,
                        key=lambda c: property_map.get(c, c).lower()):
    rooms = rooms_by_property[prop_code]
    prop_name = property_map.get(prop_code, prop_code)

    lines.append(f"## {prop_name} ({prop_code})")
    lines.append(f"**Total rooms:** {len(rooms)}\n")

    # Room type summary
    type_counter = Counter(
        room.get("extendedProps", {}).get("roomType", "Unknown")
        for room in rooms
    )
    if type_counter:
        lines.append("### Room Types")
        for rtype, count in type_counter.most_common():
            lines.append(f"- **{rtype}** × {count}")
        lines.append("")

    # List all rooms
    lines.append("### All Rooms")
    for room in sorted(rooms, key=lambda r: r.get("id", "")):
        rid = room.get("id", "no-id")
        num = room.get("extendedProps", {}).get("roomNumber", "")
        typ = room.get("extendedProps", {}).get("roomType", "N/A")
        lines.append(f"- `{rid}` – {num} – {typ}")

    lines.append("\n---\n")

# -------------------------------------------------
# 6. Save report
# -------------------------------------------------
output_file = "Property_Room_Report.md"
with open(output_file, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"\nReport created: {output_file}")
print(f"   Properties : {len(rooms_by_property)}")
print(f"   Total rooms: {len(all_rooms)}")