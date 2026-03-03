import imaplib
import email
from email.header import decode_header
import re
import csv
from datetime import datetime

# Email credentials (replace with your own)
EMAIL = "jatroskie@gmail.com"  # Replace with your email
PASSWORD = "srun cpkh zehw tven"  # Replace with your password or App Password
IMAP_SERVER = "imap.gmail.com"  # e.g., Gmail: imap.gmail.com

# CSV file name
CSV_FILE = "reservations.csv"

# Property lookup table
PROPERTY_LOOKUP = {
    "Fabulous views with all the space & comfort.": "27 Bellair",
    "Fabulous studio with balcony & views!": "B302",
    "Spectacular studio with balcony & views!": "B303",
    "Sublime studio with everything!": "B307",
    "Spacious studio with fab views!": "B309",
    "Spacious studio with living room": "B312",
    "Fab 1 bed with balcony and views": "B315",
    "Great 1 bed with balcony & views": "B317",
    "Sunny 1 bed great views & decor": "B319",
    "Sunny studio with views!": "B321",
    "Spacious sunny studio with views": "B323",
    "Fabulous views in trendy Breë": "B400",
    "Fabulous spacious apartment!": "B401",
    "Absolutely fabulous personified!": "B402",
    "Spacious studio, great views!": "B404",
    "Spacious studio with views!": "B407",
    "Splendid spacious studio with views!": "B408",
    "Super studio with sep living room": "B411",
    "Fabulous 1 bed with balcony & views!": "B413",
    "Absolutely fabulous with balcony & views!": "B413",
    "Sunny studio with fabulous views": "B420",
    "Spacious studio with fab views!": "B501",
    "Spacious studio with fab views!": "B504",
    "City Views with all the comfort": "B506",
    "Stunning studio with views!": "B507",
    "Fun studio with balcony in Bree": "B514",
    "Fun studio with balcony & views!": "B514A",
    "Fabulous finishes, views & space!": "B515",
    "Sunny studio & fabulous views!": "B520",
    "Exceptional Waterfront Living!": "G102",
    "Fabulous waterfront lifestyle!": "G205",
    "Fabulous waterfront living!": "H003",
    "Sunny spacious 1 bed with views!": "S415"
}

def connect_to_email():
    """Connect to the IMAP server and select the inbox."""
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL, PASSWORD)
    mail.select("INBOX")
    return mail

def extract_fields_from_subject(subject):
    """Extract property name from the subject, excluding ' for ' and month/day."""
    print(f"DEBUG: Raw subject before decoding: {subject}")
    # Decode all parts of the subject header
    decoded_parts = decode_header(subject)
    subject_decoded = ""
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            decoded_part = part.decode(encoding or "utf-8", errors="replace")
        else:
            decoded_part = part
        # Add a space only if needed (avoid double spaces)
        if subject_decoded and not subject_decoded.endswith(" ") and not decoded_part.startswith(" "):
            subject_decoded += " "
        subject_decoded += decoded_part
    print(f"DEBUG: Fully decoded subject: {subject_decoded}")

    # Try pattern with 'for' first, anchoring to word boundary
    pattern_with_for = r"Pending: Reservation.*at\s+(.+?)\s+for\b.*$"
    match = re.search(pattern_with_for, subject_decoded)
    if match:
        property_name = match.group(1).strip()
        print(f"DEBUG: Extracted property_name with 'for': {property_name}")
        return property_name
    
    # Fallback if 'for' isn't present
    pattern_no_for = r"Pending: Reservation.*at\s+(.+)$"
    match = re.search(pattern_no_for, subject_decoded)
    if match:
        property_name = match.group(1).strip()
        print(f"DEBUG: Extracted property_name without 'for': {property_name}")
        return property_name
    
    print(f"DEBUG: Could not extract property_name from subject: {subject_decoded}")
    return None

def parse_date(date_str):
    """Parse a date string like 'Fri, Feb 21, 2025' into a datetime object."""
    try:
        return datetime.strptime(date_str, "%a, %b %d, %Y")
    except ValueError as e:
        print(f"DEBUG: Failed to parse date '{date_str}': {e}")
        return None

def extract_body_fields(body, received_year):
    """Extract fields from the email body, using received_year for dates."""
    fields = {
        "client_name": None,
        "check_in": None,
        "check_out": None,
        "duration": None,
        "num_guests": None,
        "rate_per_night_zar": None,
        "potential_payout_zar": None
    }

    # Split body into lines for easier parsing
    lines = body.splitlines()

    # Extract client name from "Respond to <name>’s Request" or "RESPOND TO <name>'S REQUEST"
    for line in lines:
        match = re.search(r"Respond to\s+(.+?)['’]s Request", line, re.IGNORECASE)
        if match:
            fields["client_name"] = match.group(1).strip()
            print(f"DEBUG: Found client_name: {fields['client_name']}")
            break

    # Extract check-in and check-out dates
    for i, line in enumerate(lines):
        if "Check-in" in line and "Checkout" in line:
            for j in range(i + 1, min(i + 4, len(lines))):
                date_line = lines[j].strip()
                if re.search(r"[A-Za-z]{3},\s*[A-Za-z]{3}\s*\d{1,2}", date_line):
                    date_parts = re.split(r"\s{2,}", date_line)
                    if len(date_parts) >= 2:
                        fields["check_in"] = f"{date_parts[0].strip()}, {received_year}"
                        fields["check_out"] = f"{date_parts[1].strip()}, {received_year}"
                        print(f"DEBUG: Found check_in: {fields['check_in']}, check_out: {fields['check_out']}")
                    break
            break

    # Calculate duration if both dates are found
    if fields["check_in"] and fields["check_out"]:
        check_in_date = parse_date(fields["check_in"])
        check_out_date = parse_date(fields["check_out"])
        if check_in_date and check_out_date:
            duration_days = (check_out_date - check_in_date).days
            fields["duration"] = duration_days
            print(f"DEBUG: Calculated duration: {fields['duration']} days")

    # Extract number of guests (based on "Guests" section)
    for i, line in enumerate(lines):
        if "Guests" in line:
            guests_line = lines[i + 1].strip()
            match = re.search(r"(\d+)\s*adult", guests_line, re.IGNORECASE)
            if match:
                fields["num_guests"] = int(match.group(1))
                print(f"DEBUG: Found num_guests: {fields['num_guests']}")
            break

    # Extract rate and payout from "POTENTIAL EARNINGS" section
    earnings_section = False
    earnings_lines = []
    for i, line in enumerate(lines):
        if "POTENTIAL EARNINGS" in line:
            earnings_section = True
            print("DEBUG: Entered POTENTIAL EARNINGS section")
            continue
        if earnings_section:
            print(f"DEBUG: Processing line: {line}")
            earnings_lines.append(line)
            if "YOU HAVE 24 HOURS" in line:
                print("DEBUG: Exiting POTENTIAL EARNINGS section")
                break

    # Join earnings lines and extract both rate and payout
    if earnings_lines:
        earnings_text = " ".join(earnings_lines)
        print(f"DEBUG: Joined earnings text: {earnings_text}")
        rate_match = re.search(r"R([\d,]+)\s*ZAR per night", earnings_text, re.IGNORECASE)
        if rate_match:
            fields["rate_per_night_zar"] = rate_match.group(1).replace(",", "")
            print(f"DEBUG: Found rate_per_night_zar: {fields['rate_per_night_zar']}")
        payout_match = re.search(r"potential payout for this reservation is R([\d,]+)\s*ZAR", earnings_text, re.IGNORECASE)
        if payout_match:
            fields["potential_payout_zar"] = payout_match.group(1).replace(",", "")
            print(f"DEBUG: Found potential_payout_zar: {fields['potential_payout_zar']}")

    return fields

def get_email_body(msg):
    """Extract the plain text body from the email."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                return part.get_payload(decode=True).decode(errors="ignore")
    else:
        return msg.get_payload(decode=True).decode(errors="ignore")
    return ""

def get_unit_no(property_name):
    """Lookup the unit number for a given property description."""
    unit_no = PROPERTY_LOOKUP.get(property_name.strip(), "Unknown")
    print(f"DEBUG: Property '{property_name}' mapped to unit_no: {unit_no}")
    return unit_no

def write_to_csv(data_list):
    """Write the extracted data to a CSV file."""
    headers = [
        "received_date", "subject", "property_name", "unit_no",
        "client_name", "check_in", "check_out", "duration", "num_guests",
        "rate_per_night_zar", "potential_payout_zar"
    ]
    
    with open(CSV_FILE, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(data_list)
    print(f"Data saved to {CSV_FILE}")

def process_emails():
    """Fetch and process qualifying emails, then save to CSV with latest email last."""
    mail = connect_to_email()

    status, messages = mail.search(None, "SUBJECT", '"Pending: Reservation"')
    if status != "OK" or not messages[0]:
        print("No qualifying emails found!")
        mail.logout()
        return

    email_ids = messages[0].split()
    print(f"Found {len(email_ids)} qualifying emails.")

    all_email_data = []

    for email_id in email_ids:
        status, msg_data = mail.fetch(email_id, "(RFC822)")
        if status != "OK":
            print(f"Failed to fetch email ID {email_id}")
            continue

        raw_email = msg_data[0][1]
        email_message = email.message_from_bytes(raw_email)

        # Get received date and extract year
        received_date = email_message["Date"]
        parsed_date = None
        received_year = "Unknown"
        if received_date:
            try:
                parsed_date = datetime.strptime(received_date.split(" (")[0], "%a, %d %b %Y %H:%M:%S %z")
                received_date = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
                received_year = parsed_date.year
            except Exception:
                received_date = received_date
        else:
            received_date = "Unknown"

        # Extract subject
        subject = email_message["Subject"]
        property_name = extract_fields_from_subject(subject)
        if not property_name:
            print(f"Could not parse subject: {subject}")
            continue

        # Lookup unit number with cleaned property_name
        unit_no = get_unit_no(property_name)

        body = get_email_body(email_message)
        body_fields = extract_body_fields(body, received_year)

        email_data = {
            "received_date": received_date,
            "subject": subject,
            "property_name": property_name,
            "unit_no": unit_no,
            "client_name": body_fields["client_name"],
            "check_in": body_fields["check_in"],
            "check_out": body_fields["check_out"],
            "duration": body_fields["duration"],
            "num_guests": body_fields["num_guests"],
            "rate_per_night_zar": body_fields["rate_per_night_zar"],
            "potential_payout_zar": body_fields["potential_payout_zar"],
            "_parsed_date": parsed_date
        }

        all_email_data.append(email_data)

        print("\nExtracted Email Data:")
        for key, value in email_data.items():
            if key != "_parsed_date":
                print(f"{key}: {value}")

    if all_email_data:
        all_email_data.sort(key=lambda x: x["_parsed_date"] if x["_parsed_date"] else x["received_date"])
        for email_data in all_email_data:
            email_data.pop("_parsed_date", None)
        write_to_csv(all_email_data)

    mail.close()
    mail.logout()

if __name__ == "__main__":
    process_emails()