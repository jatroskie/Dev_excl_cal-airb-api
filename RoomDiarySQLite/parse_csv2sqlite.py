import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import re

# Verify sqlite3 is working
print("SQLite3 version:", sqlite3.version)

# Step 1: Create SQLite database and table
conn = sqlite3.connect("hotel_bookings.sqlite")
cursor = conn.cursor()

# Create table with recommended fields
cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        confirmation_number TEXT PRIMARY KEY,
        name TEXT,
        arrival TEXT,
        departure TEXT,
        nights INTEGER,
        room TEXT,
        room_type TEXT,
        adults INTEGER,
        children INTEGER,
        rate REAL,
        balance REAL,
        market_code TEXT,
        reservation_type TEXT
    )
""")

# Step 2: Parse and load CSV data into SQLite
# Read from a CSV file (using raw string for Windows path)
df = pd.read_csv(r"C:\Users\jatro\Dev\RoomDiarySQLite\Reservations_Opera1.csv")

# Clean and prepare data for insertion
df = df.rename(columns={
    "Confirmation Number": "confirmation_number",
    "Name": "name",
    "Arrival": "arrival",
    "Departure": "departure",
    "Nights": "nights",
    "Room": "room",
    "Room Type": "room_type",
    "Adults": "adults",
    "Children": "children",
    "Rate": "rate",
    "Balance": "balance",
    "Market Code": "market_code",
    "Reservation Type": "reservation_type"
})

# Convert dates to ISO format (YYYY-MM-DD)
df["arrival"] = pd.to_datetime(df["arrival"], format="%d.%m.%Y").dt.strftime("%Y-%m-%d")
df["departure"] = pd.to_datetime(df["departure"], format="%d.%m.%Y").dt.strftime("%Y-%m-%d")

# Clean and convert the 'rate' column to handle non-numeric values
def clean_rate(value):
    if pd.isna(value):  # Handle NaN values
        return 0.0
    # Convert to string and strip whitespace
    value = str(value).strip()
    # Use regex to extract any numeric value (including integers, decimals, and commas, ignoring text)
    match = re.search(r'-?\d+(?:[.,]\d+)?', value)  # Match numbers like "1540.00", "1,540.00", or "1540"
    if match:
        # Remove commas and dots (if used as thousand separators), then convert to float
        number_str = match.group(0).replace(",", "").replace(".", "")
        try:
            return float(number_str)
        except ValueError:
            print(f"Warning: Could not convert '{number_str}' to float for value: {value}")
            return 0.0
    # If no numeric value is found, return 0.0 (or another default) and print a warning
    print(f"Warning: No numeric value found in '{value}' - using 0.0")
    return 0.0

# Apply the clean_rate function to the 'rate' column
df["rate"] = df["rate"].apply(clean_rate)

# Clean and convert the 'balance' column (similar approach)
def clean_balance(value):
    if pd.isna(value):  # Handle NaN values
        return 0.0
    value = str(value).strip()
    # Use regex to extract any numeric value (including negative numbers, with optional commas)
    match = re.search(r'-?\d+(?:[.,]\d+)?', value)  # Match numbers like "-5,580.00", "0.00", etc.
    if match:
        # Remove commas and dots, then convert to float
        number_str = match.group(0).replace(",", "").replace(".", "")
        try:
            return float(number_str)
        except ValueError:
            print(f"Warning: Could not convert '{number_str}' to float for value: {value}")
            return 0.0
    print(f"Warning: No numeric value found in '{value}' - using 0.0")
    return 0.0

# Apply the clean_balance function to the 'balance' column
df["balance"] = df["balance"].apply(clean_balance)

# Ensure other numeric columns are integers (handle potential non-numeric values)
df["nights"] = pd.to_numeric(df["nights"], errors="coerce").fillna(0).astype(int)
df["adults"] = pd.to_numeric(df["adults"], errors="coerce").fillna(0).astype(int)
df["children"] = pd.to_numeric(df["children"], errors="coerce").fillna(0).astype(int)

# Insert data into SQLite
df[["confirmation_number", "name", "arrival", "departure", "nights", "room", "room_type", 
    "adults", "children", "rate", "balance", "market_code", "reservation_type"]].to_sql(
    "bookings", conn, if_exists="replace", index=False)

# Step 3: Create a view for calendar bookings sorted by room number
cursor.execute("""
    CREATE VIEW IF NOT EXISTS calendar_bookings AS
    SELECT room, arrival, departure, name
    FROM bookings
    ORDER BY room ASC
""")

# Step 4: Fetch data from the view for visualization
cursor.execute("SELECT room, arrival, departure, name FROM calendar_bookings")
bookings = cursor.fetchall()

# Step 5: Visualize bookings with color-coding
rooms = sorted(set(booking[0] for booking in bookings))  # Unique room numbers
fig, ax = plt.subplots(figsize=(12, len(rooms) * 0.5))

colors = plt.cm.Set3(range(len(bookings)))

for i, (room, arrival, departure, name) in enumerate(bookings):
    start_date = datetime.strptime(arrival, "%Y-%m-%d")
    end_date = datetime.strptime(departure, "%Y-%m-%d")
    days = (end_date - start_date).days
    y_pos = rooms.index(room)
    
    ax.barh(y_pos, days, left=mdates.date2num(start_date), height=0.8, color=colors[i], 
            label=f"{name} ({arrival} to {departure})")

ax.set_yticks(range(len(rooms)))
ax.set_yticklabels(rooms)
ax.set_xlabel("Date")
ax.set_ylabel("Room Number")
ax.set_title("Hotel Room Booking Calendar")

ax.xaxis_date()
ax.xaxis.set_major_locator(mdates.DayLocator(interval=30))  # Show every 30 days for wider range
ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
plt.xticks(rotation=45)

handles, labels = ax.get_legend_handles_labels()
ax.legend(handles[:10], labels[:10], title="Reservations", loc="upper right", bbox_to_anchor=(1.3, 1))

plt.tight_layout()
plt.show()

# Close the database connection
conn.commit()
conn.close()

print("SQLite database created, data loaded, view created, and calendar visualized!")