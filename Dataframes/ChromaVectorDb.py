{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "ename": "ModuleNotFoundError",
     "evalue": "No module named 'chromadb'",
     "output_type": "error",
     "traceback": [
      "\u001b[1;31m---------------------------------------------------------------------------\u001b[0m",
      "\u001b[1;31mModuleNotFoundError\u001b[0m                       Traceback (most recent call last)",
      "Cell \u001b[1;32mIn[2], line 1\u001b[0m\n\u001b[1;32m----> 1\u001b[0m \u001b[38;5;28;01mimport\u001b[39;00m \u001b[38;5;21;01mchromadb\u001b[39;00m\n\u001b[0;32m      2\u001b[0m \u001b[38;5;28;01mfrom\u001b[39;00m \u001b[38;5;21;01mchromadb\u001b[39;00m\u001b[38;5;21;01m.\u001b[39;00m\u001b[38;5;21;01mutils\u001b[39;00m \u001b[38;5;28;01mimport\u001b[39;00m embedding_functions\n\u001b[0;32m      3\u001b[0m \u001b[38;5;28;01mimport\u001b[39;00m \u001b[38;5;21;01mjson\u001b[39;00m\n",
      "\u001b[1;31mModuleNotFoundError\u001b[0m: No module named 'chromadb'"
     ]
    }
   ],
   "source": [
    "import chromadb\n",
    "from chromadb.utils import embedding_functions\n",
    "import json\n",
    "\n",
    "# Initialize Chroma client\n",
    "client = chromadb.Client() # In memory client\n",
    "# or:\n",
    "# client = chromadb.PersistentClient(path=\"path/to/chroma_db\")\n",
    "\n",
    "# Use Sentence Transformers embedding function\n",
    "sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=\"all-mpnet-base-v2\")\n",
    "\n",
    "# Create a collection\n",
    "collection = client.create_collection(\"conversations\", embedding_function=sentence_transformer_ef)\n",
    "\n",
    "with open('embedded_conversations.json', 'r', encoding='utf-8') as f:\n",
    "    embedded_conversations = json.load(f)\n",
    "\n",
    "for thread_id, messages in embedded_conversations.items():\n",
    "    ids = [f\"{thread_id}-{i}\" for i in range(len(messages))] # Unique IDs\n",
    "    embeddings = [message['embedding'] for message in messages]\n",
    "    metadatas = [{\"thread_id\": thread_id, \"sender\": message['sender'], \"timestamp\": message['timestamp']} for message in messages]\n",
    "    documents = [message['message'] for message in messages]\n",
    "    collection.add(\n",
    "        ids=ids,\n",
    "        embeddings=embeddings,\n",
    "        metadatas=metadatas,\n",
    "        documents=documents\n",
    "    )"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": []
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.13.1"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 2
}
