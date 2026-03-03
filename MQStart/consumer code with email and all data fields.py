
import pika
import json
from email.parser import BytesParser
from email.policy import default
import csv
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import os.path
import logging
import base64
import email.mime.text
import re
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Metrics
total_messages = 0
matched_messages = 0
csv_writes = 0
emails_marked_read = 0
emails_replied = 0

# Configuration
TEST_MODE = True
TEST_EMAIL = 'jatroskie@gmail.com'
CSV_FILE = "reservations.csv"

def get_gmail_service():
    try:
        token_file = 'token.json'
        client_secret_file = r"C:\Users\jatro\Dev\MQStart\client_secret_409483739632-17g097gpl3681a73sfpin5eq1fp24lsv.apps.googleusercontent.com.json"
        required_scopes = ['https://www.googleapis.com/auth/gmail.modify']

        creds = None
        if os.path.exists(token_file):
            try:
                creds = Credentials.from_authorized_user_file(token_file, required_scopes)
                logging.info(f"Loaded token with scopes: {creds.scopes}")
                if not all(scope in creds.scopes for scope in required_scopes):
                    logging.warning(f"Token scopes {creds.scopes} lack required scopes {required_scopes}. Deleting token and re-authenticating.")
                    os.remove(token_file)
                    creds = None
            except Exception as e:
                logging.warning(f"Failed to load token due to {e}. Deleting token and re-authenticating.")
                os.remove(token_file)
                creds = None

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logging.info("Attempting to refresh expired credentials")
                try:
                    creds.refresh(Request())
                    logging.info(f"Refreshed token with scopes: {creds.scopes}")
                except Exception as e:
                    logging.warning(f"Refresh failed: {e}. Forcing new authentication.")
                    creds = None
            if not creds:
                if not os.path.exists(client_secret_file):
                    raise FileNotFoundError(f"{client_secret_file} not found.")
                logging.info(f"Running OAuth flow for new credentials with scopes: {required_scopes}")
                flow = InstalledAppFlow.from_client_secrets_file(client_secret_file, required_scopes)
                creds = flow.run_local_server(port=0)
                with open(token_file, 'w') as token:
                    token.write(creds.to_json())
                logging.info(f"{token_file} created successfully with scopes: {creds.scopes}")

        service = build('gmail', 'v1', credentials=creds)
        logging.info("Gmail service created successfully")
        profile = service.users().getProfile(userId='me').execute()
        logging.info(f"Authenticated as {profile['emailAddress']}")
        return service
    except Exception as e:
        logging.error(f"Error creating Gmail service: {e}")
        return None

def send_reply_email(service, original_message, name, to_email):
    try:
        message_id = original_message.get('Message-ID', '')
        thread_id = original_message['threadId'] if 'threadId' in original_message else None

        response_body = f"""Dear {name},

Thank you so much for your reservation request! We're genuinely excited to help you plan your upcoming vacation.

Here's what you can expect:

* We'll carefully review your request and check the availability of your chosen property.
* Within 24 hours, you'll receive a detailed follow-up email. This will either confirm your booking with all the necessary details or, if your first choice is unavailable, present you with a similar property at the same quoted price.

We're committed to making your vacation planning smooth and enjoyable. If you have any questions at all, please don’t hesitate to reply to this email or call us at +27 82 8820100.

Warm regards,

Johan Troskie
Vacation Properties
"""

        mime_message = email.mime.text.MIMEText(response_body)
        mime_message['to'] = to_email
        mime_message['from'] = 'me'
        mime_message['subject'] = f"Re: {original_message['subject']}"
        if message_id:
            mime_message['In-Reply-To'] = message_id
            mime_message['References'] = message_id

        raw_message = base64.urlsafe_b64encode(mime_message.as_bytes()).decode('utf-8')
        message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message, 'threadId': thread_id}
        ).execute()
        logging.info(f"Successfully sent reply email to {to_email} for message ID: {message['id']}")
        return True
    except Exception as e:
        logging.error(f"Failed to send reply email to {to_email}: {e}")
        return False

def extract_fields_from_subject(subject):
    pattern = r"Pending: Reservation.*at\s+(.+?)\s+for\s+(.+)$"
    match = re.search(pattern, subject, re.IGNORECASE)
    if match:
        property_name = match.group(1).strip()
        date_period = match.group(2).strip()
        return property_name, date_period
    return None, None

def extract_body_fields(body):
    fields = {
        "client_name": None,
        "check_in": None,
        "check_out": None,
        "duration": None,
        "potential_earnings_zar": None
    }
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    logging.info(f"Full email body:\n{body}")

    for i, line in enumerate(lines):
        if re.search(r"hey", line, re.IGNORECASE) and i > 0:
            potential_name = lines[i - 1]
            if potential_name and not re.search(r"check|guest|payout", potential_name, re.IGNORECASE):
                fields["client_name"] = potential_name
                break
        elif "Respond to" in line:
            try:
                fields["client_name"] = line.split("Respond to")[1].split("’s")[0].strip()
                break
            except IndexError:
                continue

    for i, line in enumerate(lines):
        if re.search(r"check[\s-]?in", line, re.IGNORECASE):
            if i + 1 < len(lines):
                fields["check_in"] = lines[i + 1] if not re.search(r"check|guest|payout", lines[i + 1], re.IGNORECASE) else None
        elif re.search(r"check[\s-]?out", line, re.IGNORECASE):
            if i + 1 < len(lines):
                fields["check_out"] = lines[i + 1] if not re.search(r"check|guest|payout", lines[i + 1], re.IGNORECASE) else None

    for i, line in enumerate(lines):
        if re.search(r"guests?", line, re.IGNORECASE):
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                if re.search(r"\d+\s*adult", next_line, re.IGNORECASE):
                    fields["duration"] = next_line
                    break

    earnings_pattern = r"potential payout.*?R([\d,]+)\s*ZAR"
    for line in lines:
        match = re.search(earnings_pattern, line, re.IGNORECASE)
        if match:
            fields["potential_earnings_zar"] = match.group(1).replace(",", "")
            break

    return fields

# RabbitMQ connection
try:
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.queue_declare(queue='email_queue', durable=True)
    logging.info("Connected to RabbitMQ successfully")
except pika.exceptions.AMQPConnectionError as e:
    logging.error(f"Failed to connect to RabbitMQ: {e}")
    exit(1)

# Initialize Gmail service
service = get_gmail_service()
if service is None:
    logging.error("Failed to initialize Gmail service. Exiting.")
    exit(1)

def callback(ch, method, properties, body):
    global total_messages, matched_messages, csv_writes, emails_marked_read, emails_replied
    total_messages += 1
    logging.info("Received a message from RabbitMQ")

    try:
        data = json.loads(body)
        message_id = data['message_id']
        email_content = data['email_content']
    except (json.JSONDecodeError, KeyError) as e:
        logging.error(f"Invalid message format: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    try:
        msg = BytesParser(policy=default).parsebytes(email_content.encode('utf-8'))
        subject = msg['subject'] or ""
        sender_email = msg['from']
        to_email = TEST_EMAIL if TEST_MODE else sender_email
        logging.info(f"Processing message ID: {message_id}, Subject: {subject}")
    except Exception as e:
        logging.error(f"Failed to parse email: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if any(keyword in subject.lower() for keyword in ['pending: reservation', 'booking', 'reservation']):
        matched_messages += 1
        logging.info(f"Subject matches: {subject}")

        try:
            received_date = msg.get('Date', 'Unknown')
            if received_date:
                try:
                    parsed_date = datetime.strptime(received_date.split(" (")[0], "%a, %d %b %Y %H:%M:%S %z")
                    received_date = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    logging.warning(f"Could not parse date: {received_date}")

            name = None
            if sender_email:
                name = sender_email.split('<')[0].strip() if '<' in sender_email else sender_email.split('@')[0]
                logging.info(f"Fallback name from sender: {name}")
            if not name:
                name = "Guest"
                logging.info("Using default name: Guest")

            if send_reply_email(service, msg, name, to_email):
                emails_replied += 1
            else:
                logging.warning(f"Failed to send reply to {to_email} with name {name}")

            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            logging.info(f"Marked email as read: {message_id}")
            emails_marked_read += 1

            property_name, date_period = extract_fields_from_subject(subject)
            if not property_name or not date_period:
                logging.info(f"Subject fields not parsed (optional): {subject}")

            body_part = msg.get_body(preferencelist=('plain',))
            body = body_part.get_content() if body_part else ""
            if not body_part:
                logging.warning("No plain text body found in email")

            body_fields = extract_body_fields(body)
            if body_fields["client_name"]:
                name = body_fields["client_name"]

            email_data = {
                "received_date": received_date,
                "subject": subject,
                "property_name": property_name or "Unknown",
                "date_period": date_period or "Unknown",
                "client_name": body_fields["client_name"],
                "check_in": body_fields["check_in"],
                "check_out": body_fields["check_out"],
                "duration": body_fields["duration"],
                "potential_earnings_zar": body_fields["potential_earnings_zar"]
            }
            logging.info(f"Extracted email data: {email_data}")

            headers = [
                "received_date",
                "subject",
                "property_name",
                "date_period",
                "client_name",
                "check_in",
                "check_out",
                "duration",
                "potential_earnings_zar"
            ]
            with open(CSV_FILE, 'a', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=headers)
                if csvfile.tell() == 0:
                    writer.writeheader()
                writer.writerow(email_data)
            logging.info(f"Wrote data to {CSV_FILE}")
            csv_writes += 1

        except Exception as e:
            logging.error(f"Error processing email (non-critical): {e}")
    else:
        logging.info(f"Subject does not match any criteria: {subject}")

    ch.basic_ack(delivery_tag=method.delivery_tag)
    logging.info(f"Acknowledged message: {message_id}")

    if total_messages % 10 == 0:
        logging.info(f"Metrics: Total={total_messages}, Matches={matched_messages}, CSV Writes={csv_writes}, Marked Read={emails_marked_read}, Replied={emails_replied}")

channel.basic_consume(queue='email_queue', on_message_callback=callback, auto_ack=False)
logging.info("Starting consumer. Waiting for messages. Press CTRL+C to exit.")
try:
    channel.start_consuming()
except KeyboardInterrupt:
    logging.info("Consumer interrupted. Closing connection.")
    connection.close()
