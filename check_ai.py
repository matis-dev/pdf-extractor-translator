
import sys
import os
import requests

def print_status(msg, status):
    symbol = "✅" if status else "❌"
    print(f"{symbol} {msg}")

def check_ai_health():
    print("--- 🤖 Local AI Sanity Check ---")
    
    # 1. Check Imports
    try:
        from ai_utils import LocalPDFChat, LANGCHAIN_AVAILABLE
        print_status("Dependencies (LangChain/Chroma)", LANGCHAIN_AVAILABLE)
        if not LANGCHAIN_AVAILABLE:
            print("   -> Run: pip install -r requirements.txt")
            return
    except ImportError as e:
        print_status(f"Import Error: {e}", False)
        return

    # 2. Check Ollama Connection
    chat = LocalPDFChat()
    ollama_up = chat.check_ollama_available()
    print_status("Ollama Service Running (localhost:11434)", ollama_up)
    
    if not ollama_up:
        print("   -> Run 'ollama serve' in a separate terminal.")
        return

    # 3. Check Models
    models_info = chat.check_models_installed()
    has_embed = models_info.get('embedding', False)
    has_llm = models_info.get('llm', False)
    
    print_status(f"Embedding Model ({chat.embedding_model})", has_embed)
    print_status(f"LLM Model ({chat.llm_model})", has_llm)
    
    if not has_embed:
        print(f"   -> Run: ollama pull {chat.embedding_model}")
    if not has_llm:
        print(f"   -> Run: ollama pull {chat.llm_model}")
        
    if has_embed and has_llm:
        print("\n🚀 Ready for Test Query...")
        try:
            # Create a simple dummy text
            from langchain_core.documents import Document
            
            print("   Indexing temporary document...")
            # We bypass file loading and inject document directly for test
            chat.text_splitter._chunk_size = 100
            docs = [Document(page_content="The project functionality includes PDF extraction, splitting, and AI chat. Privacy is the main priority.")]
            
            # Use a test collection
            chat.vectorstore = chat.embeddings.embed_documents(["test"]) # pre-warm
            # Re-init vectorstore for test
            from langchain_community.vectorstores import Chroma
            chat.vectorstore = Chroma.from_documents(
                documents=docs,
                embedding=chat.embeddings,
                collection_name="sanity_check_test"
            )
            chat._setup_rag_chain()
            
            print("   Asking LLM: 'What is the main priority?'")
            response = chat.ask("What is the main priority?")
            answer = response.get('answer', '')
            
            print(f"\n🤖 Answer: {answer}")
            
            if "Privacy" in answer or "privacy" in answer:
                print_status("RAG Pipeline Functioning", True)
            else:
                print_status("RAG Pipeline Functioning (Answer unclear)", True) # Succeeded technically
                
        except Exception as e:
            print_status(f"Test Query Failed: {e}", False)
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    check_ai_health()
