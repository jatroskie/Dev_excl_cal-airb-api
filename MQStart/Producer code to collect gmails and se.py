import pika
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import os.path
import logging
import json
import base64

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
        scopes = ['https://www.googleapis.com/auth/gmail.readonly']  # Ensure this is a list with the correct scope

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
    Fetch unread emails matching 'Pending: Reservation' and queue them in RabbitMQ.
    """
    service = get_gmail_service()
    if service is None:
        logging.error("Failed to initialize Gmail service. Exiting.")
        exit(1)

    try:
        # Fetch unread emails with "Pending: Reservation" in subject
        results = service.users().messages().list(
            userId='me',
            q='Pending: Reservation',
            labelIds=['UNREAD']
        ).execute()
        messages = results.get('messages', [])

        if not messages:
            logging.info("No matching unread emails found.")
            return

        logging.info(f"Found {len(messages)} unread emails to queue.")

        for message in messages:
            msg_id = message['id']
            msg_data = service.users().messages().get(
                userId='me',
                id=msg_id,
                format='raw'
            ).execute()

            # Prepare message for queue
            email_content = base64.urlsafe_b64decode(msg_data['raw']).decode('utf-8', errors='ignore')
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

    except Exception as e:
        logging.error(f"Error fetching or queuing emails: {e}")

    finally:
        connection.close()
        logging.info("RabbitMQ connection closed.")

if __name__ == "__main__":
    logging.info("Starting producer...")
    fetch_and_queue_emails()