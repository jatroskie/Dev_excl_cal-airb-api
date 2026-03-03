import requests
import json

def query_lm_studio(prompt, server_url="http://127.0.0.1:1234"):
    """
    Sends a prompt to an LM Studio inference server and returns the response.

    Args:
        prompt (str): The text prompt to send to the server.
        server_url (str): The URL of the LM Studio inference server.

    Returns:
        str: The generated response from the server, or None if an error occurs.
    """
    try:
        # Construct the payload to send to the server. LM Studio expects a JSON payload.
        payload = {
            "prompt": prompt,
            # You can add more parameters here if needed, for example:
            # "temperature": 0.7,
            # "max_tokens": 100,
            # "top_p": 0.9,
            # ... (refer to LM Studio documentation for available parameters)
        }

        # Send a POST request to the server with the payload.
        response = requests.post(server_url + "/v1/completions", json=payload, stream=True)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # Process the streaming response.
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data:'):
                    try:
                        json_data = json.loads(decoded_line[5:]) # Remove 'data:' prefix and parse JSON
                        if 'choices' in json_data and len(json_data['choices']) > 0:
                            if 'text' in json_data['choices'][0]:
                                text_chunk = json_data['choices'][0]['text']
                                print(text_chunk, end='', flush=True) # Print the chunk without newline and flush
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON: {e}")

        print("") # Print a newline at the end

    except requests.exceptions.RequestException as e:
        print(f"Error connecting to LM Studio: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

# Example usage:
if __name__ == "__main__":
    user_prompt = input("Enter your prompt: ")
    query_lm_studio(user_prompt)