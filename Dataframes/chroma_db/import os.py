import os
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer

# Define embedding model
model = SentenceTransformer('all-mpnet-base-v2')
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-mpnet-base-v2")

collection_name = "my_collection" #Choose a name for your collection

try:
    collection = client.get_collection(name=collection_name, embedding_function=sentence_transformer_ef)
    print(f"Collection '{collection_name}' loaded.")
except ValueError:  # Collection doesn't exist
    collection = client.create_collection(name=collection_name, embedding_function=sentence_transformer_ef)
    print(f"Collection '{collection_name}' created.")
    # Add data to the collection here (if it was just created)
    # ... (code to add documents, embeddings, and metadata)