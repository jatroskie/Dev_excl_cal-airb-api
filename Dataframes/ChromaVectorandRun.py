import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
import json

# 1. Load data (from your JSON file)
with open('embedded_conversations.json', 'r', encoding='utf-8') as f:
    embedded_conversations = json.load(f)

# 2. Initialize embedding model and Chroma client
model = SentenceTransformer('all-mpnet-base-v2')
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-mpnet-base-v2")
client = chromadb.Client()
collection = client.create_collection("conversations", embedding_function=sentence_transformer_ef)

# Check if collection is empty, if so populate it.
if collection.count() == 0:
    # 3. Add data to Chroma collection
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

# 4. Query the collection (your provided snippet)
query = "Wifi is not working?"
query_embedding = model.encode(query).tolist()

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3  # Number of results to retrieve
)

print(results)