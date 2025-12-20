
try:
    import langchain
    print(f"LangChain found: {langchain.__version__}")
except ImportError as e:
    print(f"LangChain Import Error: {e}")

try:
    import chromadb
    print(f"ChromaDB found: {chromadb.__version__}")
except ImportError as e:
    print(f"ChromaDB Import Error: {e}")
    
try:
    from langchain_community.vectorstores import Chroma
    print("LangChain Community Chroma found")
except ImportError as e:
    print(f"LangChain Community Chroma Import Error: {e}")

try:
    from langchain_ollama import OllamaLLM
    print("LangChain Ollama found")
except ImportError as e:
    print(f"LangChain Ollama Import Error: {e}")
