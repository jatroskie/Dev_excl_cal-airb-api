import requests
import json

# API Configuration
BASE_URL = "https://hconnect.hsolutions.co.za/v2"
API_TOKEN = "YOUR_API_TOKEN"  # Replace with your actual token
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def check_room_availability(resource_id, start_time, end_time, book=False):
    """
    Check if a specific room is available for a given time range.
    If book=True, keep the booking; otherwise, cancel it after checking.
    Returns: (is_available: bool, message: str)
    """
    # Prepare the booking request
    booking_url = f"{BASE_URL}/bookings"
    payload = {
        "resource_id": resource_id,
        "start_time": start_time,  # ISO 8601, e.g., "2025-02-27T07:00:00Z"
        "end_time": end_time      # ISO 8601, e.g., "2025-02-27T08:00:00Z"
    }

    # Attempt to create the booking
    try:
        response = requests.post(booking_url, headers=HEADERS, json=payload)
        
        if response.status_code == 201:
            # Booking succeeded - room is available
            booking_data = response.json()
            booking_id = booking_data.get("id")
            
            if book:
                return True, f"Room {resource_id} is available and booked (ID: {booking_id})."
            else:
                # Cancel the booking if we’re just checking
                cancel_url = f"{booking_url}/{booking_id}"
                cancel_response = requests.delete(cancel_url, headers=HEADERS)
                if cancel_response.status_code in (200, 204):
                    return True, f"Room {resource_id} is available (booking tested and canceled)."
                else:
                    return True, f"Room {resource_id} is available, but cancellation failed: {cancel_response.text}"
        
        elif response.status_code in (400, 409):
            # Likely a conflict or bad request - room unavailable
            error_msg = response.json().get("error", "Unknown error")
            return False, f"Room {resource_id} is unavailable: {error_msg}"
        
        else:
            # Unexpected status code
            return False, f"Unexpected response: {response.status_code} - {response.text}"
    
    except requests.RequestException as e:
        return False, f"Error connecting to API: {str(e)}"

# Example Usage
def main():
    # Test case: Check Room 123 for Feb 27, 2025, 9-10 AM SAST (UTC+2 -> UTC)
    resource_id = "123"
    start_time = "2025-02-27T07:00:00Z"  # 9:00 AM SAST
    end_time = "2025-02-27T08:00:00Z"    # 10:00 AM SAST

    # Check availability without keeping the booking
    is_available, message = check_room_availability(resource_id, start_time, end_time, book=False)
    print(f"Availability Check: {message}")

    # Optionally, book it for real
    # is_available, message = check_room_availability(resource_id, start_time, end_time, book=True)
    # print(f"Booking Result: {message}")

if __name__ == "__main__":
    main()