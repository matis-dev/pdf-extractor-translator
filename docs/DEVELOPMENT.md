# Development Guide

This guide is for developers who want to contribute to the PDF Extractor & Translator project.

## Tech Stack
- **Backend:** Flask, Celery, Redis
- **Frontend:** Vanilla JavaScript, Bootstrap 5, pdf-lib
- **Processing:** Docling, pypdf, pdfplumber, Argos Translate
- **AI Integration:** LangChain, ChromaDB, Ollama

## Local Environment Setup

### 1. Python Environment
We recommend using a virtual environment.
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 2. System Dependencies
- **Redis:** Required for Celery background tasks.
- **Tesseract OCR:** Required for Docling extraction.
- **Pandoc:** Required for ODT conversion.
- **Ghostscript (gs):** Required for PDF compression.
- **Poppler:** Required for PDF-to-JPG conversion.

### 3. Celery Worker
Most extractions run in the background. Start the worker:
```bash
celery -A tasks worker --loglevel=info
```

## Repository Structure

- `app.py`: Main Flask application (Routes, Logic).
- `tasks.py`: Celery tasks for background processing.
- `ai_utils.py`: RAG (Retrieval Augmented Generation) logic for the AI chat.
- `translation_utils.py`: Local translation helper using Argos.
- `mcp_server.py`: Model Context Protocol implementation for AI assistants.
- `static/js/modules/`: Modular frontend logic (PDF rendering, annotations, AI chat).
- `templates/`: HTML templates.
- `tests/`: Pytest test suite.

## Coding Standards

### Python
- Follow **PEP 8**.
- Use type hints where appropriate.
- Document complex logic with docstrings (Google or NumPy style).

### JavaScript
- Use ES6+ features.
- Keep modules clean and focused.
- Ensure all interactive elements have descriptive IDs for testing.

## Testing Strategy

### Unit & Integration Tests
Run backend tests with:
```bash
python -m pytest
```

### Frontend / E2E Tests
We use Playwright for visual and functional testing in some scenarios.
```bash
pytest tests/test_frontend.py
```

## Adding New Features
1. **Discuss:** Open an issue to discuss the proposal.
2. **Develop:** Implement in a feature branch.
3. **Document:** Update `API.md` and `README.md` if necessary.
4. **Test:** Add tests to cover the new functionality.
5. **PR:** Submit a pull request.
