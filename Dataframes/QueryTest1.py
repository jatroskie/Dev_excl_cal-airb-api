query = "Wifi is not working?"
query_embedding = model.encode(query).tolist()

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3  # Number of results to retrieve
)

print(results)