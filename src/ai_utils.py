"""
Local AI utilities for PDF chat using Ollama.
100% offline - no internet required after initial model download.
Now supports Agentic Workflow with tool calling.
"""
import os
import requests
from pathlib import Path
from typing import List, Optional, Dict, Any
from logging_config import get_logger

logger = get_logger("ai_utils")

# LangChain Imports
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_community.vectorstores import Chroma
    from langchain_ollama import OllamaEmbeddings, ChatOllama
    from langchain_core.prompts import PromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.runnables import RunnablePassthrough
    from langchain_core.tools import tool
    from langchain_classic.agents import create_react_agent, AgentExecutor
    from langchain_core.prompts import PromptTemplate
    
    # Import our custom tools
    from ai_tools import extract_pdf_tables, translate
    
    LANGCHAIN_AVAILABLE = True
except ImportError as e:
    logger.debug(f"ai_utils import failed: {e}")
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
    100% offline PDF Q&A using Ollama with ReAct Agent capabilities.
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
        
        # Initialize LLM - Switched to ChatOllama for tool support
        self.llm = ChatOllama(
            model=llm_model,
            base_url=OLLAMA_BASE_URL,
            temperature=0, # Lower temperature for better tool use
        )
        
        # Text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        
        self.vectorstore = None
        self.retriever = None
        self.tools = []
        self.agent_executor = None
        
        # Define ReAct prompt locally to avoid hub dependency
        self.react_prompt = PromptTemplate.from_template("""Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}""")
    
    def check_ollama_available(self) -> bool:
        """Check if Ollama is running locally."""
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return response.status_code == 200
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            return False
        except Exception:
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
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            pass
        except Exception:
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
        
        # Setup Agent
        self._setup_agent_chain()
        
        return len(chunks)
    
    def _create_search_tool(self):
        """Create a tool for searching the specific document."""
        @tool
        def search_document(query: str) -> str:
            """Search the current PDF document to answer questions about its content.
            Use this tool when you need to find information contained within the PDF file.
            Args:
                query: The search query or question about the document.
            """
            if self.retriever is None:
                return "Error: No document indexed."
            docs = self.retriever.invoke(query)
            return "\n\n".join([d.page_content for d in docs])
        return search_document

    def _setup_agent_chain(self):
        """Create the ReAct agent chain."""
        if self.vectorstore is None:
            raise ValueError("No documents indexed. Call index_pdf first.")
        
        self.retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        # define tools
        self.tools = [
            extract_pdf_tables,
            translate,
            self._create_search_tool()
        ]
        
        # Create ReAct agent
        agent = create_react_agent(self.llm, self.tools, self.react_prompt)
        
        # Create executor
        self.agent_executor = AgentExecutor(
            agent=agent, 
            tools=self.tools, 
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5
        )
    
    def update_llm(self, model_name: str):
        """Update the LLM model used for generation."""
        self.llm_model = model_name
        self.llm = ChatOllama(
            model=model_name,
            base_url=OLLAMA_BASE_URL,
            temperature=0,
        )
        # Recreate agent if we have tools ready
        if self.retriever:
            self._setup_agent_chain()
            
    def ask(self, question: str) -> Dict[str, Any]:
        """
        Ask a question using the agentic workflow.
        """
        if self.agent_executor is None:
            raise ValueError("No agent available. Index a PDF first.")
        
        try:
            # Run agent
            result = self.agent_executor.invoke({"input": question})
            answer = result["output"]
            
            # For backward compatibility, try to fetch source docs if it was a search
            # (Note: This is an approximation since ReAct obfuscates source retrieval)
            sources = []
            if "search_document" in str(result.get("intermediate_steps", "")):
                 # We could re-run retrieval, but expensive. 
                 # For now, we return empty sources or last retrieved docs if we stored them.
                 pass
            
            return {
                "answer": answer,
                "sources": sources,
                "model_used": self.llm_model,
                "agent_log": str(result.get("intermediate_steps", []))
            }
        except Exception as e:
            # Fallback for small models that fail ReAct
            logger.warning(f"Agent failed: {e}. Falling back to simple RAG.")
            return self._ask_fallback_rag(question)

    def _ask_fallback_rag(self, question: str):
        """Fallback to simple RAG if agent fails."""
        docs = self.retriever.invoke(question)
        context = "\n\n".join([d.page_content for d in docs])
        prompt = f"Context: {context}\n\nQuestion: {question}\nAnswer:"
        answer = self.llm.invoke(prompt).content
        
        sources = [{"page": d.metadata.get("page", "?"), "content": d.page_content[:200]} for d in docs]
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
