
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from py.trash.rag_search import rag_search

def test_rag():
    # Example query (adjust as needed for your data)
    args = {
        "query": "What is the best time to irrigate wheat?",
        "top_k": 3
    }
    result = rag_search(args)
    print("RAG Search Result:")
    print(result)

if __name__ == "__main__":
    test_rag()
