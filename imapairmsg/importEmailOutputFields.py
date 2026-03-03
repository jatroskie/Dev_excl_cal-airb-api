import imaplib
import email
from email.header import decode_header
import csv
import re

username = "jatroskie@gmail.com"
password = "srun cpkh zehw tven"  # Replace with your app password

def extract_email_details(msg):
    """Extracts relevant details from the email message."""

    details = {
        "reply_to": "",
        "check_in_date": "",
        "check_out_date": "",
        "apartment_name": "",
        "guests": "",
        "message": "",
    }

    # Extract reply-to email
    if msg.get("Reply-To"):
        details["reply_to"] = msg.get("Reply-To")

    # Extract subject
    subject, encoding = decode_header(msg["Subject"])[0]
    if isinstance(subject, bytes):
        subject = subject.decode(encoding if encoding else "utf-8")

    # Extract details from the body
    body = ""
    for part in msg.walk():
        if part.get_content_type() == "text/plain":
            body_part = part.get_payload(decode=True)
            body = body_part.decode(part.get_content_charset() or "utf-8")
            break  # Assuming the first text/plain part is the main body

    # Use regular expressions to find details
    check_in_match = re.search(r"CHECK-IN.*?(\w+ \d+, \d{4})", body, re.DOTALL)
    check_out_match = re.search(r"CHECK-OUT.*?(\w+ \d+, \d{4})", body, re.DOTALL)
    apartment_match = re.search(r"RESERVATION DETAILS\n\n(.+?)\n", body, re.DOTALL)
    guests_match = re.search(r"GUESTS\n\n(\d+) guest", body, re.DOTALL)
    message_match = re.search(r"Message:\n(.+?)\nReply", body, re.DOTALL)

    if check_in_match:
        details["check_in_date"] = check_in_match.group(1)
    if check_out_match:
        details["check_out_date"] = check_out_match.group(1)
    if apartment_match:
        details["apartment_name"] = apartment_match.group(1)
    if guests_match:
        details["guests"] = guests_match.group(1)
    if message_match:
        details["message"] = message_match.group(1).strip()

    return details

# Connect to the Gmail IMAP server
mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(username, password)

# Select the mailbox you want to check
mail.select("inbox")

# Search for emails with the specified subject (using a broader search)
status, messages = mail.search(None, 'SUBJECT "Pending: Reservation Request"')

# Convert messages to a list of email IDs
email_ids = messages[0].split()

if email_ids:
    # Fetch the latest email
    latest_email_id = email_ids[-1]
    status, msg_data = mail.fetch(latest_email_id, "(RFC822)")

    # Parse the email content
    msg = email.message_from_bytes(msg_data[0][1])

    # Extract email details
    email_details = extract_email_details(msg)

    # Write details to CSV file
    with open("email_data.csv", "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "reply_to",
            "check_in_date",
            "check_out_date",
            "apartment_name",
            "guests",
            "message",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(email_details)

    print("Email details extracted and saved to email_data.csv")
else:
    print("No emails found with the subject 'Pending: Reservation Request'")

# Close the connection and logout
mail.close()
mail.logout()