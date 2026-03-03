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

def connect_to_email():
    """Connect to the IMAP server and select the inbox."""
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL, PASSWORD)
    mail.select("INBOX")
    return mail

def extract_fields_from_subject(subject):
    """Extract property name and date period from the subject."""
    pattern = r"Pending: Reservation.*at\s+(.+?)\s+for\s+(.+)$"
    match = re.search(pattern, subject)
    if match:
        property_name = match.group(1).strip()
        date_period = match.group(2).strip()
        return property_name, date_period
    return None, None

def extract_body_fields(body):
    """Extract fields from the email body."""
    fields = {
        "client_name": None,
        "check_in": None,
        "check_out": None,
        "duration": None,
        "potential_earnings_zar": None
    }

    # Split body into lines for easier parsing
    lines = body.splitlines()

    # Extract client name (assuming it's before a greeting like "Hey")
    for i, line in enumerate(lines):
        if "Hey" in line:
            fields["client_name"] = lines[i - 1].strip()
            break

    # Extract check-in and check-out
    for i, line in enumerate(lines):
        if "Check-in" in line and "Checkout" in line:
            check_in_line = lines[i + 1].strip()
            check_out_line = lines[i + 2].strip()
            fields["check_in"] = check_in_line if check_in_line else None
            fields["check_out"] = check_out_line if check_out_line else None
            break

    # Extract duration (based on "GUESTS" section)
    for i, line in enumerate(lines):
        if "GUESTS" in line:
            guests_line = lines[i + 1].strip()
            if "adult" in guests_line:
                fields["duration"] = guests_line  # e.g., "1 adult"
            break

    # Extract potential earnings in ZAR
    earnings_pattern = r"potential payout for this reservation is R([\d,]+)\s*ZAR"
    for line in lines:
        match = re.search(earnings_pattern, line)
        if match:
            fields["potential_earnings_zar"] = match.group(1).replace(",", "")
            break

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

def write_to_csv(data_list):
    """Write the extracted data to a CSV file."""
    headers = [
        "received_date", "subject", "property_name", "date_period",
        "client_name", "check_in", "check_out", "duration", "potential_earnings_zar"
    ]
    
    # Write to CSV
    with open(CSV_FILE, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(data_list)
    print(f"Data saved to {CSV_FILE}")

def process_emails():
    """Fetch and process qualifying emails, then save to CSV with latest email last."""
    mail = connect_to_email()

    # Search for emails with "Pending: Reservation" in the subject
    status, messages = mail.search(None, "SUBJECT", '"Pending: Reservation"')
    if status != "OK" or not messages[0]:
        print("No qualifying emails found!")
        mail.logout()
        return

    email_ids = messages[0].split()
    print(f"Found {len(email_ids)} qualifying emails.")

    # List to store all extracted data
    all_email_data = []

    # Process each email
    for email_id in email_ids:
        status, msg_data = mail.fetch(email_id, "(RFC822)")
        if status != "OK":
            print(f"Failed to fetch email ID {email_id}")
            continue

        raw_email = msg_data[0][1]
        email_message = email.message_from_bytes(raw_email)

        # Get received date
        received_date = email_message["Date"]
        parsed_date = None
        if received_date:
            try:
                # Parse the date and remove timezone info for sorting
                parsed_date = datetime.strptime(received_date.split(" (")[0], "%a, %d %b %Y %H:%M:%S %z")
                received_date = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                received_date = received_date  # Keep raw if parsing fails
        else:
            received_date = "Unknown"

        # Decode subject
        subject = email_message["Subject"]
        subject_decoded, encoding = decode_header(subject)[0]
        if isinstance(subject_decoded, bytes):
            subject_decoded = subject_decoded.decode(encoding or "utf-8")

        # Check if subject matches criteria (redundant but kept for safety)
        if "Pending: Reservation" not in subject_decoded:
            continue

        # Extract fields from subject
        property_name, date_period = extract_fields_from_subject(subject_decoded)
        if not property_name or not date_period:
            print(f"Could not parse subject: {subject_decoded}")
            continue

        # Get email body
        body = get_email_body(email_message)

        # Extract fields from body
        body_fields = extract_body_fields(body)

        # Compile all extracted data
        email_data = {
            "received_date": received_date,
            "subject": subject_decoded,
            "property_name": property_name,
            "date_period": date_period,
            "client_name": body_fields["client_name"],
            "check_in": body_fields["check_in"],
            "check_out": body_fields["check_out"],
            "duration": body_fields["duration"],
            "potential_earnings_zar": body_fields["potential_earnings_zar"],
            "_parsed_date": parsed_date  # Temporary field for sorting
        }

        # Add to list
        all_email_data.append(email_data)

        # Print the extracted data (optional)
        print("\nExtracted Email Data:")
        for key, value in email_data.items():
            if key != "_parsed_date":  # Skip printing the temporary field
                print(f"{key}: {value}")

    # Sort by received date (latest last)
    if all_email_data:
        # Sort by _parsed_date if available, otherwise use received_date string
        all_email_data.sort(key=lambda x: x["_parsed_date"] if x["_parsed_date"] else x["received_date"])
        # Remove the temporary _parsed_date field
        for email_data in all_email_data:
            email_data.pop("_parsed_date", None)
        write_to_csv(all_email_data)

    # Close connection
    mail.close()
    mail.logout()

if __name__ == "__main__":
    process_emails()