import requests
import json
import time

def query_lm_studio(prompt, server_url="165.0.97.37:2510"):
    """
    Sends a prompt to an LM Studio inference server and returns the response.

    Args:
        prompt (str): The text prompt to send to the server.
        server_url (str): The URL of the LM Studio inference server.

    Returns:
        str: The generated response from the server, or None if an error occurs.
    """
    try:
        payload = {
            "prompt": prompt,
            "stream": True, # Ensure streaming is enabled
        }

        response = requests.post(server_url + "/v1/completions", json=payload, stream=True)
        response.raise_for_status()

        generated_text = "" # Accumulate the generated text

        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data:'):
                    try:
                        json_data = json.loads(decoded_line[5:])
                        if 'choices' in json_data and len(json_data['choices']) > 0:
                            if 'text' in json_data['choices'][0]:
                                text_chunk = json_data['choices'][0]['text']
                                generated_text += text_chunk # Append to the accumulated text
                                print(text_chunk, end='', flush=True) # Print in real time
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON: {e}")

        print("") # Print a newline at the end
        return generated_text

    except requests.exceptions.RequestException as e:
        print(f"Error connecting to LM Studio: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

if __name__ == "__main__":
    user_prompt = input("Enter your prompt: ")
    result = query_lm_studio(user_prompt)
    if result:
        #Optional, process the full result here if needed.
        pass