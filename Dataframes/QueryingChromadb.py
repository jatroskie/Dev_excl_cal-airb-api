import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
import json
import os

# Define persistent Chroma client (data stored on disk)
CHROMA_PERSIST_DIRECTORY = "chroma_db"  # Directory to store Chroma data
client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)

# Define embedding model
model = SentenceTransformer('all-mpnet-base-v2')
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-mpnet-base-v2")

# Create or get the collection
collection_name = "conversations"
try:
    collection = client.get_collection(name=collection_name, embedding_function=sentence_transformer_ef)
    print(f"Collection '{collection_name}' loaded.")
except ValueError:  # Collection doesn't exist
    collection = client.create_collection(name=collection_name, embedding_function=sentence_transformer_ef)
    print(f"Collection '{collection_name}' created.")

    # Load and populate only if the collection was just created
    if collection.count() == 0:
        with open('embedded_conversations.json', 'r', encoding='utf-8') as f:
            embedded_conversations = json.load(f)

        for thread_id, messages in embedded_conversations.items():
            ids = [f"{thread_id}-{i}" for i in range(len(messages))]
            embeddings = [message['embedding'] for message in messages]
            metadatas = [{"thread_id": thread_id, "sender": message['sender'], "timestamp": message['timestamp']} for message in messages]
            documents = [message['message'] for message in messages]
            collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
        print("Collection populated.")
    else:
        print("Collection already populated. Skipping data loading.")


# Query loop
while True:
    query = input("Enter your query (or press Enter to exit): ")
    if not query.strip():  # Check for empty or whitespace-only input
        break

    query_embedding = model.encode(query).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3
    )

    print("\nResults:")
    for i in range(len(results['documents'][0])):
        print(f"\nResult {i+1}:")
        print("Document:", results['documents'][0][i])
        print("Metadata:", results['metadatas'][0][i])
        print("Distance:", results['distances'][0][i])
    print("-" * 20)  # Separator between queries

print("Exiting query tool.")

#To delete the collection:
#client.delete_collection(name=collection_name)
#print(f"Collection '{collection_name}' deleted.")