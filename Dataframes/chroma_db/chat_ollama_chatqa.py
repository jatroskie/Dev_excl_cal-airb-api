import chromadb
from sentence_transformers import SentenceTransformer
import ollama  # Ensure ollama library is imported

# --- Configuration ---
CHROMA_PATH = r"C:\Users\jatro\Dev\Dataframes\chroma_db"
COLLECTION_NAME = "conversations"
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
MODEL_NAME = "llama3-chatqa:8b"  # Changed to llama3-chatqa:8b model
TEMPERATURE = 0.2  # Lower temperature for more reliable results

# --- Load Embedding Model ---
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# --- Load ChromaDB ---
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_collection(name=COLLECTION_NAME)

print(f"Airbnb Host Chatbot is ready! Using Ollama model '{MODEL_NAME}' with temperature {TEMPERATURE}. Type 'exit' to quit.")


def get_relevant_responses(user_input, collection, embedding_model, top_n=3):
    input_embedding = embedding_model.encode(user_input).tolist()
    results = collection.query(
        query_embeddings=[input_embedding],
        n_results=top_n,
        include=["documents"]
    )
    relevant_responses = results['documents'][0]
    return relevant_responses


def generate_chatbot_response(user_input, relevant_responses, conversation_history): # Added conversation_history
    context = "\n".join(f"- {response}" for response in relevant_responses)

    # Format conversation history for the prompt
    history_text = ""
    if conversation_history:
        history_text = "\nConversation History:\n"
        for turn in conversation_history:
            history_text += f"{turn['role']}: {turn['content']}\n"

    prompt = f"""
[INST] <<SYS>>
You are a helpful and friendly Airbnb host chatbot. You should provide accurate and reliable responses.
Use the following Airbnb host responses as context to answer user questions about hosting.
If the context is not directly relevant, answer based on your general knowledge of hosting on Airbnb in a friendly and helpful tone, while still being accurate.
Refer to the conversation history to maintain context and provide coherent answers.

{history_text}
<</SYS>>

Context:
{context}

User question: {user_input} [/INST]
"""

    ollama_response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {'role': 'system', 'content': 'You are a helpful and friendly Airbnb host chatbot. You should provide accurate and reliable responses. Use Airbnb host responses as context and conversation history.'}, # More explicit system message
            *conversation_history, # Include conversation history in messages
            {'role': 'user', 'content': prompt} # User question with context and history in the prompt
        ],
        options={"temperature": TEMPERATURE}  # Use 'options' to set temperature
    )

    chatbot_response = ollama_response['message']['content']
    return chatbot_response


if __name__ == "__main__":
    print(f"Airbnb Host Chatbot is ready! Using Ollama model '{MODEL_NAME}' with temperature {TEMPERATURE}. Type 'exit' to quit.")
    conversation_history = [] # Initialize conversation history

    while True:
        user_message = input("You: ")
        if user_message.lower() == "exit":
            break

        relevant_responses = get_relevant_responses(user_message, collection, embedding_model)

        # Add user message to conversation history
        conversation_history.append({'role': 'user', 'content': user_message})

        chatbot_response = generate_chatbot_response(user_message, relevant_responses, conversation_history)

        # Add chatbot response to conversation history
        conversation_history.append({'role': 'assistant', 'content': chatbot_response})


        print(f"Chatbot: {chatbot_response}")