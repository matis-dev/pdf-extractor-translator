"""
Local AI utilities for PDF chat using Ollama.
100% offline - no internet required after initial model download.
"""
import os
import requests
from pathlib import Path
from typing import List, Optional, Dict, Any

# LangChain Imports
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_community.vectorstores import Chroma
    from langchain_ollama import OllamaEmbeddings, OllamaLLM
    from langchain_core.prompts import PromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.runnables import RunnablePassthrough
    LANGCHAIN_AVAILABLE = True
except ImportError as e:
    print(f"DEBUG: ai_utils import failed: {e}")
    LANGCHAIN_AVAILABLE = False

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
CHROMA_PERSIST_DIR = "chroma_db"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2:3b"

# Chunk configuration
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

class LocalPDFChat:
    """
    100% offline PDF Q&A using Ollama.
    """
    
    def __init__(
        self,
        embedding_model: str = EMBEDDING_MODEL,
        llm_model: str = LLM_MODEL,
        persist_directory: str = CHROMA_PERSIST_DIR
    ):
        if not LANGCHAIN_AVAILABLE:
            raise ImportError("LangChain not installed. Please install required packages.")

        self.embedding_model = embedding_model
        self.llm_model = llm_model
        self.persist_directory = os.path.abspath(persist_directory)
        
        # Initialize embeddings
        self.embeddings = OllamaEmbeddings(
            model=embedding_model,
            base_url=OLLAMA_BASE_URL
        )
        
        # Initialize LLM
        self.llm = OllamaLLM(
            model=llm_model,
            base_url=OLLAMA_BASE_URL,
            temperature=0.3,
        )
        
        # Text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        
        self.vectorstore = None
        self.retriever = None
        self.chain = None
    
    def check_ollama_available(self) -> bool:
        """Check if Ollama is running locally."""
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def check_models_installed(self) -> Dict[str, Any]:
        """Check which required models are installed."""
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m["name"] for m in models]
                
                has_embedding = any(self.embedding_model in m for m in model_names)
                has_llm = any(self.llm_model.split(':')[0] in m for m in model_names)
                
                return {
                    "embedding": has_embedding,
                    "llm": has_llm,
                    "available_models": model_names,
                    "required_embedding": self.embedding_model,
                    "required_llm": self.llm_model
                }
        except:
            pass
        return {"embedding": False, "llm": False, "available_models": []}
    
    def index_pdf(self, pdf_path: str, collection_name: str = None) -> int:
        """
        Index a PDF for Q&A. Returns number of chunks created.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        # Use filename as collection name if not provided
        if collection_name is None:
            import re
            clean_name = Path(pdf_path).stem
            collection_name = re.sub(r'[^a-zA-Z0-9_-]', '_', clean_name).lower()
            if len(collection_name) < 3: collection_name += "_doc"
        
        # Load PDF
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        
        if not documents:
            return 0
            
        # Split into chunks
        chunks = self.text_splitter.split_documents(documents)
        
        # Create/update vector store
        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=self.persist_directory,
            collection_name=collection_name
        )
        
        # Setup retrieval
        self._setup_rag_chain()
        
        return len(chunks)
    
    def _setup_rag_chain(self):
        """Create the RAG chain using LCEL."""
        if self.vectorstore is None:
            raise ValueError("No documents indexed. Call index_pdf first.")
        
        self.retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        prompt_template = """You are a helpful assistant answering questions about a PDF document.
Use ONLY the following context to answer the question. If you cannot find the answer in the context, say "I cannot find this information in the document."

Context from the document:
{context}

Question: {question}

Answer: """

        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
        
        # Define chain
        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        self.chain = (
            {"context": self.retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | self.llm
            | StrOutputParser()
        )
    
    def update_llm(self, model_name: str):
        """Update the LLM model used for generation."""
        # Simple validation
        if not ':' in model_name:
             # Basic heuristic, though some might not have tags. 
             # Ollama usually needs tag or assumes 'latest'
             pass
             
        self.llm_model = model_name
        self.llm = OllamaLLM(
            model=model_name,
            base_url=OLLAMA_BASE_URL,
            temperature=0.3,
        )
        # Recreate chain with new LLM if retrieving
        if self.retriever:
            self._setup_rag_chain()
            
    def ask(self, question: str) -> Dict[str, Any]:
        """
        Ask a question about the indexed PDF.
        """
        if self.chain is None:
            raise ValueError("No chain available. Index a PDF first.")
        
        # Get source documents first
        docs = self.retriever.invoke(question)
        
        # Generate answer
        answer = self.chain.invoke(question)
        
        # Format sources
        sources = []
        for doc in docs:
            sources.append({
                "page": doc.metadata.get("page", "Unknown"),
                "content": doc.page_content[:200] + "..."
            })
        
        return {
            "answer": answer,
            "sources": sources,
            "model_used": self.llm_model
        }

# Singleton instance
_chat_instance = None

def get_pdf_chat_instance():
    """Get or create a singleton PDF chat instance."""
    global _chat_instance
    if _chat_instance is None:
        _chat_instance = LocalPDFChat()
    return _chat_instance
