import os
from langchain_community.embeddings import LlamaCppEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.text_splitter import CharacterTextSplitter
from langchain_community.document_loaders import TextLoader

# Configuration (ADJUST THESE)
persist_directory = "db"  # Directory to save the Chroma DB
model_path = "C:/Users/jatro/Dev/Dataframes/llama-2-7b.Q4_K_M.gguf"  # Path to your GGUF model
data_file = "your_data.txt"  # Path to your text data file

# Check if model exists
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model not found at {model_path}. Please download a GGUF model.")

# Check if data file exists
if not os.path.exists(data_file):
    with open(data_file, "w") as f:
        f.write("This is some example data.\nIt has a few lines.\nFor testing purposes.")
    print(f"Created dummy data file at {data_file}")

# Create embeddings and vectorstore
try:
    embedding = LlamaCppEmbeddings(model_path=model_path)
except Exception as e:
    print(f"Error initializing embeddings: {e}")
    exit()

try:
    vectordb = Chroma(persist_directory=persist_directory, embedding_function=embedding)
except Exception as e:
    print(f"Error initializing Chroma: {e}")
    exit()

# Load and process data
try:
    loader = TextLoader(data_file)
    documents = loader.load()
    text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)  # Adjust chunk size as needed
    docs = text_splitter.split_documents(documents)
    vectordb.add_documents(docs)
    print("Documents added to the vector database.")
except Exception as e:
    print(f"Error processing data: {e}")
    exit()