import chromadb
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

# --- Configuration ---
CHROMA_PATH = r"C:\Users\jatro\Dev\Dataframes\chroma_db"
COLLECTION_NAME = "conversations"
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
MODEL_NAME = "llama2"  # Or your chosen Llama 2 model

# --- Load Embedding Model ---
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# --- Load ChromaDB ---
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_collection(name=COLLECTION_NAME)

# --- Load Llama 2 Model and Pipeline ---
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, device_map="auto")
generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    device_map="auto"
)


def get_relevant_responses(user_input, collection, embedding_model, top_n=3):
    input_embedding = embedding_model.encode(user_input).tolist()
    results = collection.query(
        query_embeddings=[input_embedding],
        n_results=top_n,
        include=["documents"]
    )
    relevant_responses = results['documents'][0]
    return relevant_responses


def generate_chatbot_response(user_input, relevant_responses, generator): # Re-added 'generator' argument
    context = "\n".join(f"- {response}" for response in relevant_responses)

    prompt = f"""
[INST] <<SYS>>
You are a helpful and friendly Airbnb host chatbot.
Use the following Airbnb host responses as context to answer user questions about hosting.
If the context is not relevant, answer based on your general knowledge of hosting on Airbnb in a friendly and helpful tone.
<</SYS>>

Context:
{context}

User question: {user_input} [/INST]
"""

    response = generator( # Using the 'generator' pipeline again
        prompt,
        max_length=200,
        num_return_sequences=1,
        temperature=0.7,
        top_p=0.9
    )[0]['generated_text']
    cleaned_response = response.replace(prompt, "").strip()
    return cleaned_response


if __name__ == "__main__":
    print("Airbnb Host Chatbot is ready! Type 'exit' to quit.")
    while True:
        user_message = input("You: ")
        if user_message.lower() == "exit":
            break

        relevant_responses = get_relevant_responses(user_message, collection, embedding_model)
        chatbot_response = generate_chatbot_response(user_message, relevant_responses, generator) # Re-added 'generator' argument

        print(f"Chatbot: {chatbot_response}")