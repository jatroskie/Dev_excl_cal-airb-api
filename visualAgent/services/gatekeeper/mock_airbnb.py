import requests
import json
import random
from datetime import datetime, timedelta

def generate_mock_booking():
    room_types = ["WFV-1-BR"] # Example IDs
    start_date = (datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=random.randint(31, 35))).strftime("%Y-%m-%d")
    
    payload = {
        "event_type": "reservation_created",
        "listing_id": random.choice(room_types),
        "start_date": start_date,
        "end_date": end_date,
        "guest_name": f"Guest_{random.randint(1000, 9999)}",
        "confirmation_code": f"HM{random.randint(10000,99999)}"
    }
    return payload

def send_webhook(payload):
    url = "http://localhost:8000/webhook/airbnb"
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    print("Simulating Airbnb Webhook...")
    data = generate_mock_booking()
    print(f"Sending Payload: {json.dumps(data, indent=2)}")
    send_webhook(data)
