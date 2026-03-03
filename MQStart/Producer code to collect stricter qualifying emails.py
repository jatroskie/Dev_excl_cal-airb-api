import pika
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import os.path
import logging
import json
import base64
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_gmail_service():
    """
    Initialize and return an authorized Gmail API service.
    """
    try:
        creds = None
        token_file = 'token.json'
        client_secret_file = r"C:\Users\jatro\Dev\MQStart\client_secret_409483739632-17g097gpl3681a73sfpin5eq1fp24lsv.apps.googleusercontent.com.json"
        scopes = ['https://www.googleapis.com/auth/gmail.readonly']

        logging.info(f"Using scopes: {scopes}")

        if os.path.exists(token_file):
            logging.info(f"Loading credentials from {token_file}")
            creds = Credentials.from_authorized_user_file(token_file, scopes)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logging.info("Refreshing expired credentials")
                creds.refresh(Request())
            else:
                if not os.path.exists(client_secret_file):
                    raise FileNotFoundError(f"{client_secret_file} not found.")
                logging.info("Running OAuth flow for new credentials")
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
        logging.error(f"Error creating Gmail service: {str(e)}")
        return None

# RabbitMQ connection
try:
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.queue_declare(queue='email_queue', durable=True)
    logging.info("Connected to RabbitMQ successfully")
except pika.exceptions.AMQPConnectionError as e:
    logging.error(f"Failed to connect to RabbitMQ: {e}")
    exit(1)

def fetch_and_queue_emails():
    """
    Perpetually monitor Gmail inbox for unread 'Pending: Reservation' emails (originals only) and queue them in RabbitMQ.
    """
    service = get_gmail_service()
    if service is None:
        logging.error("Failed to initialize Gmail service. Exiting.")
        exit(1)

    try:
        logging.info("Starting perpetual monitoring of Gmail inbox...")
        while True:
            try:
                # Fetch unread emails with exact "Pending: Reservation" in subject, post-2024
                results = service.users().messages().list(
                    userId='me',
                    q='"Pending: Reservation" after:2024/01/01',
                    labelIds=['UNREAD']
                ).execute()
                messages = results.get('messages', [])

                if not messages:
                    logging.info("No new unread qualifying emails found.")
                else:
                    logging.info(f"Found {len(messages)} new unread emails to process.")
                    for message in messages:
                        msg_id = message['id']
                        # Get metadata to check subject
                        msg_data = service.users().messages().get(userId='me', id=msg_id).execute()
                        headers = msg_data.get('payload', {}).get('headers', [])
                        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
                        logging.info(f"Evaluating email with subject: {subject}")

                        # Skip replies and forwards
                        if 're:' in subject.lower() or 'fwd:' in subject.lower():
                            logging.info(f"Skipping reply/forward: {subject}")
                            continue

                        # Only queue if it passes the filter
                        raw_data = service.users().messages().get(userId='me', id=msg_id, format='raw').execute()
                        email_content = base64.urlsafe_b64decode(raw_data['raw']).decode('utf-8', errors='ignore')
                        queue_message = {
                            'message_id': msg_id,
                            'email_content': email_content
                        }

                        # Publish to RabbitMQ
                        channel.basic_publish(
                            exchange='',
                            routing_key='email_queue',
                            body=json.dumps(queue_message),
                            properties=pika.BasicProperties(delivery_mode=2)  # Persistent
                        )
                        logging.info(f"Queued message ID: {msg_id}")

                        # Optional: Mark as read here if consumer isn't reliable
                        # service.users().messages().modify(
                        #     userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
                        # ).execute()
                        # logging.info(f"Marked message {msg_id} as read")

                # Wait before next check
                logging.info("Sleeping for 60 seconds before next check...")
                time.sleep(60)

            except Exception as inner_e:
                logging.error(f"Error during email fetch or queuing: {inner_e}")
                logging.info("Retrying in 60 seconds...")
                time.sleep(60)

    except KeyboardInterrupt:
        logging.info("Producer interrupted by user.")
    finally:
        connection.close()
        logging.info("RabbitMQ connection closed.")

if __name__ == "__main__":
    logging.info("Starting producer...")
    fetch_and_queue_emails()