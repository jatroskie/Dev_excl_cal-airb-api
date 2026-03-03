# Program to query vector database responses. Works!

import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
import json
import os

# Configuration
COLLECTION_NAME = "conversations"
CHROMA_DIR = "chroma_db"
EMBEDDINGS_FILE = "embedded_conversations.json"

# Set up persistence directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PERSIST_DIRECTORY = os.path.join(PROJECT_DIR, CHROMA_DIR)
print(f"Chroma data directory: {CHROMA_PERSIST_DIRECTORY}")

# Chroma client
client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)

# Embedding model
model = SentenceTransformer('all-mpnet-base-v2')
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-mpnet-base-v2")

# Get or create the collection
try:
    collection = client.get_collection(name=COLLECTION_NAME, embedding_function=sentence_transformer_ef)
    print(f"Collection '{COLLECTION_NAME}' loaded.")
except chromadb.errors.InvalidCollectionException:
    collection = client.create_collection(name=COLLECTION_NAME, embedding_function=sentence_transformer_ef)
    print(f"Collection '{COLLECTION_NAME}' created.")

    # Populate the collection ONLY if it's new AND the embeddings file exists
    embeddings_file_path = os.path.join(PROJECT_DIR, EMBEDDINGS_FILE)
    if os.path.exists(embeddings_file_path):
        with open(embeddings_file_path, 'r', encoding='utf-8') as f:
            embedded_conversations = json.load(f)

        if collection.count() == 0:  # Double check if collection is empty before adding
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
            print("Collection populated from embedded_conversations.json.")
        else:
            print("Collection was just created but already has data. This is unexpected.")
    else:
        print(f"Embeddings file '{EMBEDDINGS_FILE}' not found. Cannot populate collection.")

# Query loop
while True:
    query = input("Enter your query (or 'exit' to quit): ")
    if query.lower() == 'exit':
        break

    query_embedding = model.encode(query).tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3
    )

    print("Results:")
    for i, result in enumerate(results['documents'][0]):
        print(f"Result {i + 1}:")
        print(f"Document: {result}")
        print(f"Metadata: {results['metadatas'][0][i]}")
        print(f"Distance: {results['distances'][0][i]}")
        print()