import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for prototype (or ["http://localhost:3000"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firestore
if os.path.exists("../../service-account-key.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "../../service-account-key.json"

db = firestore.Client(project="cal-airb-api")

class InquiryRequest(BaseModel):
    hotel_id: str
    guest_query: str

@app.post("/inquiry/ask")
async def ask_agent(request: InquiryRequest):
    print(f"Received question for {request.hotel_id}: {request.guest_query}")
    
    # RAG STEP 1: Retrieval
    # In a real system, we'd use Vector Search here. 
    # For this prototype, we fetch ALL knowledge base docs (small dataset).
    kb_ref = db.collection("hotels").document(request.hotel_id).collection("knowledge_base")
    docs = kb_ref.stream()
    
    context_chunks = []
    for doc in docs:
        data = doc.to_dict()
        # Naive keyword matching to simulate vector retrieval
        # If any word in query matches category or content, include it
        content = data.get("content", "").lower()
        if any(word in content for word in request.guest_query.lower().split()):
             context_chunks.append(f"[{doc.id}]: {data.get('content')}")
        elif len(context_chunks) < 3: # Fallback: add random context if nothing matches specific
             # Ideally we wouldn't do this, but for demo continuity we might want some context
             pass 

    # If no keywords matched, include everything (safe for small retrieval)
    if not context_chunks:
         docs = kb_ref.stream() # reset stream
         for doc in docs:
             context_chunks.append(f"[{doc.id}]: {doc.to_dict().get('content')}")

    # RAG STEP 2: Synthesis (Simulated LLM)
    context_str = "\n".join(context_chunks)
    
    # We simulate an LLM response based on context
    response = simulate_llm_response(request.guest_query, context_str)
    
    return {
        "response": response,
        "context_used": context_chunks,
        "source": "knowledge_base"
    }

def simulate_llm_response(query, context):
    # This is a stub. Real implementation calls Vertex AI Gemini API.
    query_lower = query.lower()
    
    if "pool" in query_lower:
         if "glass" in context.lower():
             return "The pool is open 8am-8pm. Please note that no glass bottles are allowed near the pool area."
         return "The pool is available for your use."
         
    if "check-in" in query_lower or "check in" in query_lower:
         if "1234" in context:
             return "Check-in is at 3 PM. You can access the key using the lockbox code 1234."
         return "Standard check-in is at 3 PM."
         
    if "adult" in query_lower and "bed" in query_lower:
        # Hard constraint logic simulation
        return "I'm sorry, but our queen rooms strictly accommodate a maximum of 2 adults per safety regulations."

    # Fallback
    return f"Thank you for your interest. Based on our rules: {context[:100]}..."
