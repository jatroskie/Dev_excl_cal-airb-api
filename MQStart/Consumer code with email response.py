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

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Metrics
total_messages = 0
matched_messages = 0
csv_writes = 0
emails_marked_read = 0
emails_replied = 0

# Configuration for reply-to email
TEST_MODE = True  # Set to True for testing with your email, False for live (sender’s email)
TEST_EMAIL = 'jatroskie@gmail.com'  # Your email for testing

def get_gmail_service():
    """
    Initialize and return an authorized Gmail API service.
    """
    try:
        creds = None
        token_file = 'token.json'
        client_secret_file = r"C:\Users\jatro\Dev\MQStart\client_secret_409483739632-17g097gpl3681a73sfpin5eq1fp24lsv.apps.googleusercontent.com.json"
        scopes = ['https://www.googleapis.com/auth/gmail.modify']

        if os.path.exists(token_file):
            creds = Credentials.from_authorized_user_file(token_file, scopes)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(client_secret_file):
                    raise FileNotFoundError(f"{client_secret_file} not found.")
                flow = InstalledAppFlow.from_client_secrets_file(client_secret_file, scopes)
                creds = flow.run_local_server(port=0)
                with open(token_file, 'w') as token:
                    token.write(creds.to_json())
                logging.info(f"{token_file} created successfully!")
        service = build('gmail', 'v1', credentials=creds)
        logging.info("Gmail service created successfully")
        profile = service.users().getProfile(userId='me').execute()
        logging.info(f"Authenticated as {profile['emailAddress']}")
        return service
    except Exception as e:
        logging.error(f"Error creating Gmail service: {e}")
        return None

def send_reply_email(service, original_message, name, to_email):
    """
    Send a reply email to the sender using the Gmail API.
    """
    try:
        # Extract thread ID and message ID from the original message
        message_id = original_message.get('Message-ID', '')
        thread_id = original_message['threadId'] if 'threadId' in original_message else None

        # Your response message here (customize as needed)
        response_body = f"""Dear {name},

Thank you so much for your reservation request! We're genuinely excited to help you plan your upcoming vacation.

Here's what you can expect:

* We'll carefully review your request and check the availability of your chosen property.
* Within 24 hours, you'll receive a detailed follow-up email. This will either confirm your booking with all the necessary details or, if your first choice is unavailable, present you with a similar property at the same quoted price.

We're committed to making your vacation planning smooth and enjoyable. If you have any questions at all, please don't hesitate to reply to this email or call us at +27 82 8820100.

Warm regards,

Johan Troskie
Vacation Properties
"""

        # Create the email message
        mime_message = email.mime.text.MIMEText(response_body)
        mime_message['to'] = to_email
        mime_message['from'] = 'me'  # Your Gmail address (resolved by API)
        mime_message['subject'] = f"Re: {original_message['subject']}"
        if message_id:
            mime_message['In-Reply-To'] = message_id
            mime_message['References'] = message_id

        # Encode the message
        raw_message = base64.urlsafe_b64encode(mime_message.as_bytes()).decode('utf-8')

        # Send the email
        message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message, 'threadId': thread_id}
        ).execute()
        logging.info(f"Sent reply email to {to_email} for message ID: {message['id']}")
        return True
    except Exception as e:
        logging.error(f"Failed to send reply email: {e}")
        return False

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
    """
    Process messages from RabbitMQ.
    """
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
        sender_email = msg['from']  # Original sender’s email
        # Use TEST_EMAIL for testing, sender_email for live
        to_email = TEST_EMAIL if TEST_MODE else sender_email
        logging.info(f"Processing message ID: {message_id}, Subject: {subject}")
    except Exception as e:
        logging.error(f"Failed to parse email: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if 'Pending: Reservation Request' in subject:
        matched_messages += 1
        logging.info(f"Subject matches: {subject}")

        try:
            body = msg.get_body(preferencelist=('plain',)).get_content()
            lines = body.split('\n')
            logging.info(f"Email body first line: '{lines[0] if lines else 'empty'}'")  # Debug log

            # Robust name extraction
            name = None
            if lines and "Respond to" in lines[0]:
                try:
                    name_part = lines[0].split("Respond to")[1].split("’s Request")[0].strip()
                    name = name_part
                    logging.info(f"Extracted name from first line: {name}")
                except IndexError:
                    logging.warning("Could not extract name from first line")
            
            # Fallback 1: Extract name from sender_email
            if not name and sender_email:
                name = sender_email.split('<')[0].strip() if '<' in sender_email else sender_email.split('@')[0]
                logging.info(f"Fallback name from sender: {name}")
            
            # Fallback 2: Default to "Guest" if no name found
            if not name:
                name = "Guest"
                logging.info("Using default name: Guest")

            fields = {}
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    fields[key.strip()] = value.strip()

            if not fields:
                logging.warning("No fields extracted from email body")
            else:
                logging.info(f"Extracted fields: {fields}")
                with open('reservation_requests.csv', 'a', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fields.keys())
                    if csvfile.tell() == 0:
                        writer.writeheader()
                    writer.writerow(fields)
                logging.info("Wrote fields to reservation_requests.csv")
                csv_writes += 1
        except Exception as e:
            logging.error(f"Error processing email or writing to CSV: {e}")

        # Send reply email (to_email is always set, name now has a fallback)
        if send_reply_email(service, msg, name, to_email):
            emails_replied += 1
        else:
            logging.warning(f"Failed to send reply to {to_email} with name {name}")

        try:
            service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            logging.info(f"Marked email as read: {message_id}")
            emails_marked_read += 1
        except Exception as e:
            logging.warning(f"Failed to mark email as read (ID: {message_id}): {e} - Skipping this step")
    else:
        logging.info(f"Subject does not match: {subject}")

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