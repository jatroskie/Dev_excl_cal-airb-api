import ollama

# Initialize the Ollama client
client = ollama.Client()

# Define the model and the input prompt
model = "deepseek-coder:6.7b"  # Replace with your model name
prompt = "What is the pre-market information and important market news for this week that can influence a movement in SOFI's stock price?"

# Send the query to the model
response = client.generate(model=model, prompt=prompt)

# Print the response from the model
print("Response from Ollama:")
print(response.response)