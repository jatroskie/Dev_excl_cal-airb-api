import imaplib
import email
from email.header import decode_header

username = "jatroskie@gmail.com"
password = "srun cpkh zehw tven"  # Replace with your app password

# Connect to the Gmail IMAP server
mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(username, password)

# Select the mailbox you want to check
mail.select("inbox")

# Search for emails with "Pending: Reservation" in the subject
status, messages = mail.search(None, 'SUBJECT "Pending: Reservation"')

# Convert messages to a list of email IDs
email_ids = messages[0].split()

if email_ids:
    # Fetch the latest matching email
    latest_email_id = email_ids[-1]
    status, msg_data = mail.fetch(latest_email_id, "(RFC822)")

    # Parse the email content
    msg = email.message_from_bytes(msg_data[0][1])

    # Decode the email subject
    subject, encoding = decode_header(msg["Subject"])[0]
    if isinstance(subject, bytes):
        subject = subject.decode(encoding if encoding else "utf-8")

    # Open a file to write the output
    with open("email_output.txt", "w", encoding="utf-8") as f:
        # Write the subject to the file
        f.write(f"Subject: {subject}\n\n")

        # Get the email body
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                # Decode the message body
                body_part = part.get_payload(decode=True)
                body = body_part.decode(part.get_content_charset() or "utf-8")
                # Write the body to the file
                f.write(f"Message:\n{body}\n")
else:
    print("No emails found with the subject 'Pending: Reservation'")

# Close the connection and logout
mail.close()
mail.logout()