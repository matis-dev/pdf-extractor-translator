# PDF Extractor Quick Reference Card

> **Cheat sheet for common operations** — Print this or keep it handy!

---

### 🚀 Startup

**Manual (Local)**
```bash
./scripts/start.sh
```

**Docker**
```bash
./scripts/start.sh --docker
# OR
docker-compose up --build        # First time / after changes
docker-compose up                # Subsequent runs
docker-compose down              # Stop all services
```

### Manual Setup
```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Celery Worker
celery -A tasks worker --loglevel=info

# Terminal 3: Flask App
python app.py
```

**Access:** http://localhost:5000

---

## 📄 Document Extraction

### Web UI
| Action                   | Steps                                           |
| ------------------------ | ----------------------------------------------- |
| **Extract to Word**      | Home → Full Content → Word → Process → Download |
| **Extract Tables (CSV)** | Home → Tables → CSV → Process → Download        |
| **Extract + Translate**  | Home → Full Content → Select Language → Process |

### Command Line
```bash
# Full document to Word
python extract_full_document_to_word.py document.pdf

# Tables to CSV
python extract_tables_to_csv.py document.pdf

# Tables to Word
python extract_tables_to_word.py document.pdf
```

---

## ✏️ Editor Keyboard Shortcuts

| Shortcut   | Action               |
| ---------- | -------------------- |
| `Ctrl + Z` | Undo                 |
| `Ctrl + Y` | Redo                 |
| `Ctrl + S` | Save PDF             |
| `Ctrl + K` | Command Palette      |
| `+` / `-`  | Zoom In / Out        |
| `←` / `→`  | Previous / Next Page |
| `Esc`      | Cancel current tool  |

---

## 🔧 Common API Calls

### Upload a PDF
```bash
curl -X POST http://localhost:5000/upload \
  -F "pdf_file=@document.pdf"
```

### Extract Content (Async)
```bash
# Start extraction
curl -X POST http://localhost:5000/process_request \
  -d "filename=document.pdf" \
  -d "extraction_type=full_content"

# Check status
curl http://localhost:5000/status/{task_id}
```

### Merge PDFs
```bash
curl -X POST http://localhost:5000/merge \
  -H "Content-Type: application/json" \
  -d '{"filenames": ["doc1.pdf", "doc2.pdf"]}'
```

### Compress PDF
```bash
curl -X POST http://localhost:5000/compress \
  -H "Content-Type: application/json" \
  -d '{"filename": "large.pdf"}'
```

### Split PDF
```bash
curl -X POST http://localhost:5000/split \
  -H "Content-Type: application/json" \
  -d '{"filename": "document.pdf", "ranges": ["1-3", "5", "7-10"]}'
```

---

## 🤖 AI Chat Operations

### Check AI Status
```bash
curl http://localhost:5000/ai/status
```

### Index a PDF
```bash
curl -X POST http://localhost:5000/ai/index \
  -H "Content-Type: application/json" \
  -d '{"filename": "report.pdf"}'
```

### Ask a Question
```bash
curl -X POST http://localhost:5000/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the main topic?", "model": "llama3.2:3b"}'
```

### Pull New Model
```bash
curl -X POST http://localhost:5000/ai/pull \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral"}'
```

---

## 🌍 Translation Language Codes

| Language | Code | Language   | Code |
| -------- | ---- | ---------- | ---- |
| English  | `en` | Spanish    | `es` |
| French   | `fr` | German     | `de` |
| Italian  | `it` | Portuguese | `pt` |
| Polish   | `pl` | Russian    | `ru` |
| Chinese  | `zh` | Arabic     | `ar` |

---

## 📁 Important Paths

| Path         | Purpose                |
| ------------ | ---------------------- |
| `uploads/`   | Uploaded PDF files     |
| `outputs/`   | Processed output files |
| `logs/`      | Application logs       |
| `chroma_db/` | AI embeddings database |

---

## 🛠️ Troubleshooting Quick Fixes

| Problem                | Solution                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| **Celery task stuck**  | Restart worker: `pkill -f celery && celery -A tasks worker --loglevel=info` |
| **Redis not running**  | `redis-server` or `docker run -d -p 6379:6379 redis`                        |
| **Tesseract error**    | `export TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/`               |
| **Ollama unavailable** | Start Ollama: `ollama serve`                                                |
| **Out of memory**      | Reduce Celery concurrency: `--concurrency=2`                                |
| **Port 5000 in use**   | Kill process: `lsof -ti:5000                                                | xargs kill` |

---

## 🧹 Maintenance Commands

```bash
# Clear old uploads (7+ days)
find uploads/ -type f -mtime +7 -delete

# Clear old outputs (7+ days)
find outputs/ -type f -mtime +7 -delete

# Reset AI index
rm -rf chroma_db/

# Clear logs
rm -f logs/*.log

# Check disk usage
du -sh uploads/ outputs/ chroma_db/ logs/
```

---

## 🧪 Testing Commands

```bash
# Run all tests
python -m pytest

# Run with verbose output
python -m pytest -v

# Run specific test file
python -m pytest tests/test_frontend.py -v

# Run single test
python -m pytest tests/test_frontend.py::test_upload -v

# Run with coverage
python -m pytest --cov=. --cov-report=html
```

---

## 🐳 Docker Commands

```bash
# View logs
docker-compose logs -f web
docker-compose logs -f worker

# Restart single service
docker-compose restart web

# Rebuild single service
docker-compose up --build web

# Shell into container
docker-compose exec web bash

# Clean up everything
docker-compose down -v --rmi all
```

---

## 📊 Health Checks

```bash
# Check Flask app
curl http://localhost:5000/

# Check Redis
redis-cli ping

# Check Celery
celery -A tasks inspect ping

# Check Ollama
curl http://localhost:11434/api/tags
```

---

## 🔗 Useful Links

| Resource               | URL                               |
| ---------------------- | --------------------------------- |
| **Main App**           | http://localhost:5000             |
| **API Docs**           | `docs/API.md`                     |
| **Full Documentation** | `docs/TECHNICAL_DOCUMENTATION.md` |
| **Development Guide**  | `docs/DEVELOPMENT.md`             |
| **Ollama Models**      | https://ollama.com/library        |

---

*PDF Extractor & Translator — Quick Reference v1.0*
