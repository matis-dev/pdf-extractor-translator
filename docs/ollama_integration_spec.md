# 🤖 Local AI Integration Specification
## Chat with PDF using Ollama (100% Offline)

**Document Version:** 1.0  
**Created:** 2025-12-18  
**Status:** Research & Planning

---

## 📋 Executive Summary

This document outlines how to implement a **100% offline "Chat with PDF" feature** using Ollama and local embedding models. The goal is to enable users to ask questions about their uploaded PDF documents without any internet connection – maintaining our core principle of **privacy-first, air-gapped operation**.

### Key Value Proposition
> "Ask questions about your confidential PDF documents. All AI processing happens on YOUR machine. Zero data leaves your device."

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         LOCAL MACHINE (No Internet)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   PDF   │───▶│   Docling   │───▶│   Chunker   │───▶│   Embedding     │  │
│  │  Upload │    │  (Extract)  │    │  (Split)    │    │   Model         │  │
│  └─────────┘    └─────────────┘    └─────────────┘    │  (Ollama)       │  │
│                                                        └────────┬────────┘  │
│                                                                 │            │
│                                                                 ▼            │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  User   │───▶│   Query     │───▶│  Retriever  │◀───│   Vector DB     │  │
│  │  Query  │    │  Embedding  │    │  (Top-K)    │    │  (ChromaDB)     │  │
│  └─────────┘    └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                           │                                  │
│                                           ▼                                  │
│                                    ┌─────────────┐    ┌─────────────────┐  │
│                                    │   Context   │───▶│   LLM (Ollama)  │  │
│                                    │   Builder   │    │  Mistral/Llama  │  │
│                                    └─────────────┘    └────────┬────────┘  │
│                                                                 │            │
│                                                                 ▼            │
│                                                        ┌─────────────────┐  │
│                                                        │   AI Response   │  │
│                                                        └─────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Stack (All Local)

| Layer               | Component                                  | Purpose                         | Offline? |
| ------------------- | ------------------------------------------ | ------------------------------- | -------- |
| **PDF Processing**  | Docling (existing)                         | Extract text, tables, structure | ✅ Yes    |
| **Text Chunking**   | LangChain `RecursiveCharacterTextSplitter` | Split into 500-1000 char chunks | ✅ Yes    |
| **Embedding Model** | Ollama `nomic-embed-text`                  | Convert text → 768-dim vectors  | ✅ Yes    |
| **Vector Store**    | ChromaDB (local)                           | Store & search embeddings       | ✅ Yes    |
| **LLM**             | Ollama (Mistral 7B / Llama 3.2 3B)         | Generate answers                | ✅ Yes    |
| **Orchestration**   | LangChain                                  | RAG pipeline                    | ✅ Yes    |
| **UI**              | Flask + existing editor                    | Chat interface                  | ✅ Yes    |

---

## 💻 Hardware Requirements

### Minimum Requirements (CPU-Only)

| Component      | Minimum       | Recommended                 |
| -------------- | ------------- | --------------------------- |
| **RAM**        | 8 GB          | 16 GB                       |
| **CPU**        | 4 cores       | 8+ cores (AVX2 support)     |
| **Disk Space** | 10 GB free    | 20 GB free                  |
| **GPU**        | None required | NVIDIA 8GB+ VRAM (optional) |

### Model Size vs RAM Trade-off

| Model         | Parameters | Disk Size | RAM Usage | Quality | Speed (CPU)        |
| ------------- | ---------- | --------- | --------- | ------- | ------------------ |
| `llama3.2:1b` | 1B         | 1.3 GB    | ~4 GB     | ⭐⭐      | Fast (5-10 tok/s)  |
| `llama3.2:3b` | 3B         | 2.0 GB    | ~6 GB     | ⭐⭐⭐     | Medium (3-5 tok/s) |
| `mistral:7b`  | 7B         | 4.1 GB    | ~8-10 GB  | ⭐⭐⭐⭐    | Slow (1-3 tok/s)   |
| `llama3.1:8b` | 8B         | 4.3 GB    | ~10-12 GB | ⭐⭐⭐⭐⭐   | Slow (1-2 tok/s)   |

### Embedding Model Requirements

| Model               | Disk Size | RAM     | Vector Size | Speed     |
| ------------------- | --------- | ------- | ----------- | --------- |
| `nomic-embed-text`  | ~275 MB   | ~2-4 GB | 768 dims    | Fast      |
| `mxbai-embed-large` | ~670 MB   | ~4-6 GB | 1024 dims   | Medium    |
| `all-minilm`        | ~45 MB    | ~1 GB   | 384 dims    | Very Fast |

### Recommended Configuration

**For Most Users (16GB RAM, no GPU):**
```bash
# LLM: Good balance of speed and quality
ollama pull llama3.2:3b

# Embedding: Best balance for document search
ollama pull nomic-embed-text
```

**For Power Users (32GB+ RAM or GPU):**
```bash
# LLM: Higher quality answers
ollama pull mistral:7b

# Embedding: Same as above
ollama pull nomic-embed-text
```

**For Low-Resource Machines (8GB RAM):**
```bash
# LLM: Smaller but still capable
ollama pull llama3.2:1b

# Embedding: Lightweight
ollama pull all-minilm
```

---

## 🔧 Implementation Approach

### Phase 1: Core RAG Pipeline (MVP)

#### Step 1: Install Dependencies

Add to `requirements.txt`:
```txt
# AI/LLM Dependencies (all local)
langchain>=0.1.0
langchain-community>=0.0.10
langchain-ollama>=0.0.1
chromadb>=0.4.0
sentence-transformers>=2.2.0  # Fallback embeddings
```

#### Step 2: Create RAG Module

**File: `static/js/modules/ai_chat.js`** (Frontend)
```javascript
// Chat UI component for PDF AI assistant
```

**File: `ai_utils.py`** (Backend Core)
```python
"""
Local AI utilities for PDF chat using Ollama.
100% offline - no internet required after initial model download.
"""
import os
from pathlib import Path
from typing import List, Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"  # Default Ollama port
CHROMA_PERSIST_DIR = "./chroma_db"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2:3b"  # Default, can be changed

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
        self.embedding_model = embedding_model
        self.llm_model = llm_model
        self.persist_directory = persist_directory
        
        # Initialize embeddings (local via Ollama)
        self.embeddings = OllamaEmbeddings(
            model=embedding_model,
            base_url=OLLAMA_BASE_URL
        )
        
        # Initialize LLM (local via Ollama)
        self.llm = OllamaLLM(
            model=llm_model,
            base_url=OLLAMA_BASE_URL,
            temperature=0.3,  # Lower = more focused
        )
        
        # Text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        
        self.vectorstore = None
        self.qa_chain = None
    
    def check_ollama_available(self) -> bool:
        """Check if Ollama is running locally."""
        import requests
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def check_models_installed(self) -> dict:
        """Check which required models are installed."""
        import requests
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m["name"] for m in models]
                return {
                    "embedding": self.embedding_model in model_names or 
                                any(self.embedding_model in m for m in model_names),
                    "llm": self.llm_model in model_names or 
                          any(self.llm_model in m for m in model_names),
                    "available_models": model_names
                }
        except:
            pass
        return {"embedding": False, "llm": False, "available_models": []}
    
    def index_pdf(self, pdf_path: str, collection_name: str = None) -> int:
        """
        Index a PDF for Q&A. Returns number of chunks created.
        
        Args:
            pdf_path: Path to the PDF file
            collection_name: Optional name for the vector collection
            
        Returns:
            Number of text chunks indexed
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        # Use filename as collection name if not provided
        if collection_name is None:
            collection_name = Path(pdf_path).stem.replace(" ", "_").lower()
        
        # Load PDF (using existing Docling or fallback to PyPDF)
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        
        # Split into chunks
        chunks = self.text_splitter.split_documents(documents)
        
        # Create/update vector store
        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=self.persist_directory,
            collection_name=collection_name
        )
        
        # Create QA chain
        self._create_qa_chain()
        
        return len(chunks)
    
    def _create_qa_chain(self):
        """Create the RAG QA chain."""
        if self.vectorstore is None:
            raise ValueError("No documents indexed. Call index_pdf first.")
        
        # Custom prompt for document Q&A
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
        
        # Create retriever
        retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}  # Return top 4 most relevant chunks
        )
        
        # Create chain
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            chain_type_kwargs={"prompt": prompt},
            return_source_documents=True
        )
    
    def ask(self, question: str) -> dict:
        """
        Ask a question about the indexed PDF.
        
        Args:
            question: The question to ask
            
        Returns:
            dict with 'answer' and 'sources' keys
        """
        if self.qa_chain is None:
            raise ValueError("No QA chain available. Index a PDF first.")
        
        result = self.qa_chain.invoke({"query": question})
        
        # Extract source information
        sources = []
        for doc in result.get("source_documents", []):
            sources.append({
                "page": doc.metadata.get("page", "Unknown"),
                "content": doc.page_content[:200] + "..."
            })
        
        return {
            "answer": result["result"],
            "sources": sources
        }
    
    def load_existing_index(self, collection_name: str) -> bool:
        """Load an existing vector index."""
        try:
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
                collection_name=collection_name
            )
            self._create_qa_chain()
            return True
        except Exception as e:
            print(f"Could not load index: {e}")
            return False


# Convenience function for Flask routes
def get_pdf_chat_instance():
    """Get or create a singleton PDF chat instance."""
    if not hasattr(get_pdf_chat_instance, "_instance"):
        get_pdf_chat_instance._instance = LocalPDFChat()
    return get_pdf_chat_instance._instance
```

#### Step 3: Add Flask Routes

**Add to `app.py`:**
```python
# AI Chat Routes
@app.route('/ai/status')
def ai_status():
    """Check if local AI is available."""
    try:
        from ai_utils import LocalPDFChat
        chat = LocalPDFChat()
        ollama_ok = chat.check_ollama_available()
        models = chat.check_models_installed()
        return jsonify({
            'available': ollama_ok,
            'ollama_running': ollama_ok,
            'models': models
        })
    except Exception as e:
        return jsonify({
            'available': False,
            'error': str(e)
        })

@app.route('/ai/index', methods=['POST'])
def ai_index_pdf():
    """Index a PDF for AI chat."""
    filename = request.json.get('filename')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        from ai_utils import get_pdf_chat_instance
        chat = get_pdf_chat_instance()
        
        if not chat.check_ollama_available():
            return jsonify({'error': 'Ollama is not running. Please start Ollama first.'}), 503
        
        num_chunks = chat.index_pdf(pdf_path)
        return jsonify({
            'success': True,
            'chunks_indexed': num_chunks,
            'message': f'PDF indexed successfully with {num_chunks} chunks'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ai/ask', methods=['POST'])
def ai_ask():
    """Ask a question about the indexed PDF."""
    question = request.json.get('question')
    if not question:
        return jsonify({'error': 'Question required'}), 400
    
    try:
        from ai_utils import get_pdf_chat_instance
        chat = get_pdf_chat_instance()
        result = chat.ask(question)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### Phase 2: UI Integration

Add chat panel to the editor interface:

```html
<!-- Add to editor.html -->
<div id="ai-chat-panel" class="ai-chat-panel hidden">
    <div class="ai-chat-header">
        <h3>🤖 Ask AI about this PDF</h3>
        <span class="ai-status" id="ai-status">Checking...</span>
    </div>
    <div class="ai-chat-messages" id="ai-messages">
        <!-- Messages will be inserted here -->
    </div>
    <div class="ai-chat-input">
        <input type="text" id="ai-question" placeholder="Ask a question about this document...">
        <button id="ai-send-btn" onclick="askAI()">Send</button>
    </div>
</div>
```

### Phase 3: Advanced Features (Future)

1. **Multi-PDF Indexing** - Index multiple PDFs into same collection
2. **Conversation Memory** - Remember previous questions/answers
3. **Smart Summarization** - Auto-generate document summaries
4. **Table-Aware Q&A** - Use Docling's table extraction for better table queries
5. **Translation + Q&A** - Answer questions in different languages

---

## 🚀 Installation Guide for Users

### Step 1: Install Ollama

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
# Download from https://ollama.com/download
# Or use brew:
brew install ollama
```

**Windows:**
```bash
# Download installer from https://ollama.com/download
```

### Step 2: Download Required Models (One-Time, Requires Internet)

```bash
# Start Ollama service
ollama serve

# In another terminal, download models:
# Embedding model (~275 MB)
ollama pull nomic-embed-text

# LLM - choose based on your RAM:
# For 8GB RAM:
ollama pull llama3.2:1b

# For 16GB RAM (recommended):
ollama pull llama3.2:3b

# For 32GB+ RAM or GPU:
ollama pull mistral:7b
```

### Step 3: Verify Installation

```bash
# Test embedding
ollama run nomic-embed-text "Hello world"

# Test LLM
ollama run llama3.2:3b "What is PDF?"
```

After this initial download, **no internet is ever required again**.

---

## 📊 Performance Expectations

### Indexing Speed

| PDF Size | Pages | Chunks | Index Time (CPU) |
| -------- | ----- | ------ | ---------------- |
| 100 KB   | 5     | ~20    | ~5 seconds       |
| 1 MB     | 50    | ~200   | ~30 seconds      |
| 10 MB    | 200   | ~800   | ~2 minutes       |
| 50 MB    | 500   | ~2000  | ~5 minutes       |

### Query Response Time

| Model         | RAM Used | Response Time | Quality   |
| ------------- | -------- | ------------- | --------- |
| `llama3.2:1b` | ~4 GB    | 2-5 seconds   | Basic     |
| `llama3.2:3b` | ~6 GB    | 5-15 seconds  | Good      |
| `mistral:7b`  | ~10 GB   | 10-30 seconds | Excellent |

---

## ⚠️ Limitations & Considerations

### Current Limitations

1. **First-time setup requires internet** - Model download is one-time
2. **CPU inference is slow** - GPU recommended for production use
3. **RAM intensive** - 8GB minimum, 16GB recommended
4. **Large PDFs** - Very large documents may need pagination
5. **Image-heavy PDFs** - OCR may be needed for scanned documents

### Privacy Guarantees

| Aspect               | Guarantee                     |
| -------------------- | ----------------------------- |
| Data transmission    | ❌ Zero bytes sent to internet |
| Cloud APIs           | ❌ None used                   |
| Telemetry            | ❌ None collected              |
| Model weights        | ✅ Stored locally              |
| Vector database      | ✅ Stored locally              |
| Conversation history | ✅ Stored locally (optional)   |

---

## 🆚 Comparison with Cloud AI

| Feature                 | Our Solution       | Cloud AI (ChatGPT, etc.) |
| ----------------------- | ------------------ | ------------------------ |
| **Internet Required**   | ❌ No (after setup) | ✅ Always                 |
| **Data Privacy**        | ✅ 100% local       | ❌ Data sent to servers   |
| **Monthly Cost**        | $0                 | $20+/month               |
| **Speed**               | Slower (CPU)       | Faster (data centers)    |
| **Air-Gap Compatible**  | ✅ Yes              | ❌ No                     |
| **Model Quality**       | Good (7B-8B)       | Excellent (GPT-4, etc.)  |
| **Compliance Friendly** | ✅ HIPAA, SOX, GDPR | ⚠️ Depends on contracts   |

---

## 📁 Files to Create

| File                               | Purpose                 |
| ---------------------------------- | ----------------------- |
| `ai_utils.py`                      | Core RAG logic          |
| `static/js/modules/ai_chat.js`     | Frontend chat interface |
| `static/css/ai_chat.css`           | Chat styling            |
| `templates/partials/ai_panel.html` | Chat HTML component     |
| `tests/test_ai_chat.py`            | Unit tests              |

---

## 🎯 Success Criteria

- [ ] User can ask questions about opened PDF
- [ ] All processing happens locally (verifiable)
- [ ] Works without internet after initial setup
- [ ] Response time < 30 seconds on 16GB RAM
- [ ] Clear error messages when Ollama not running
- [ ] Model status shown in UI

---

## 📚 References

- [Ollama Documentation](https://ollama.com/)
- [LangChain RAG Tutorial](https://python.langchain.com/docs/tutorials/rag/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Nomic Embed Text](https://ollama.com/library/nomic-embed-text)

---

*This document is a living specification. Update as implementation progresses.*
