import chromadb
from sentence_transformers import SentenceTransformer

# --- Configuration ---
CHROMA_PATH = r"C:\Users\jatro\Dev\Dataframes\chroma_db"  # Path to your ChromaDB file
COLLECTION_NAME = "conversations" # Choose a name for your collection (if you haven't named it already, check ChromaDB documentation)
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2" #  This is a common and good general-purpose embedding model.
                                             #  Replace with the actual model you used if different.

# --- Load Embedding Model ---
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# --- Load ChromaDB ---
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_collection(name=COLLECTION_NAME) # Or create it if it doesn't exist yet: client.get_or_create_collection(name=COLLECTION_NAME)

print(f"ChromaDB collection '{COLLECTION_NAME}' loaded.")

# --- Define Function to Retrieve Relevant Responses ---

def get_relevant_responses(user_input, collection, embedding_model, top_n=3):
    """
    Retrieves relevant Airbnb responses from ChromaDB based on user input.

    Args:
        user_input (str): The user's message.
        collection (chromadb.Collection): Your ChromaDB collection.
        embedding_model (SentenceTransformer): The embedding model.
        top_n (int): Number of top responses to retrieve.

    Returns:
        list: A list of the top_n most relevant response texts (or an empty list if none found).
    """
    input_embedding = embedding_model.encode(user_input).tolist()

    results = collection.query(
        query_embeddings=[input_embedding],
        n_results=top_n,
        include=["documents"] # Include the actual response texts (assuming you stored them as 'documents')
    )

    relevant_responses = results['documents'][0] # Access the documents from the first (and only) query
    return relevant_responses

# Example usage:
user_query = "What's your cancellation policy?"
relevant_responses = get_relevant_responses(user_query, collection, embedding_model)

if relevant_responses:
    print("Relevant Airbnb responses:")
    for response in relevant_responses:
        print(f"- {response}")
else:
    print("No relevant responses found.")