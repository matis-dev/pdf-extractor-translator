# API Reference

This document outlines the REST API endpoints available in the PDF Content Extractor & Translator.

## Table of Contents
- [File Operations](#file-operations)
- [PDF Processing](#pdf-processing)
- [PDF Editor Operations](#pdf-editor-operations)
- [AI Chat Operations](#ai-chat-operations)

---

## File Operations

### `POST /upload`
Uploads one or more PDF files.
- **Form Data:**
  - `pdf_file`: File(s) (required)
- **Response:** Redirects to the editor (for single file) or index (for multiple).

### `POST /create_zip`
Creates a ZIP file containing processed results.
- **Request Body:**
  ```json
  { "filenames": ["file1.pdf", "file2.pdf"] }
  ```
- **Response:** `application/zip` file.

### `GET /outputs/<filename>`
Downloads a file from the output directory.

---

## PDF Processing

### `POST /process_request`
Initiates a background task for document extraction or translation.
- **Form Data:**
  - `filename`: Source PDF name (required)
  - `extraction_type`: Type of extraction (e.g., `full_content`, `tables_csv`, `tables_word`)
  - `target_lang`: Target language for translation (optional)
  - `source_lang`: Source language (default: `en`)
- **Response:**
  ```json
  { "task_id": "...", "mode": "async|sync" }
  ```

### `GET /status/<task_id>`
Checks the status of a background task.
- **Response:**
  ```json
  {
    "state": "PENDING|SUCCESS|FAILURE",
    "status": "...",
    "current": 0,
    "total": 100,
    "result_file": "..." (if SUCCESS)
  }
  ```

---

## PDF Editor Operations

### `POST /save_pdf`
Saves/Updates a PDF in the upload directory.
- **Form Data:**
  - `pdf_file`: The PDF file.

### `POST /extract_text_region`
Extracts text from a specific region on a PDF page.
- **Form Data:**
  - `filename`: PDF name
  - `page_index`: 0-indexed page number
  - `x`, `y`, `w`, `h`: Region coordinates
  - `page_width`, `page_height`: Dimensions in DOM

### `POST /merge`
Merges multiple PDFs into one.
- **Request Body:**
  ```json
  { "filenames": ["1.pdf", "2.pdf"] }
  ```

### `POST /compress`
Compresses a PDF file.
- **Request Body:**
  ```json
  { "filename": "input.pdf" }
  ```

### `POST /split`
Splits a PDF by page ranges.
- **Request Body:**
  ```json
  { "filename": "input.pdf", "ranges": ["1-3", "5"] }
  ```

---

## AI Chat Operations

### `GET /ai/status`
Checks if local AI (Ollama) is available and which models are installed.

### `POST /ai/index`
Indexes a PDF for AI chatting.
- **Request Body:**
  ```json
  { "filename": "input.pdf" }
  ```

### `POST /ai/ask`
Asks a question about the indexed PDF.
- **Request Body:**
  ```json
  { "question": "What is...", "model": "llama3.2:3b" }
  ```

### `POST /ai/pull`
Instructs the server to download a new model from Ollama.
- **Request Body:**
  ```json
  { "model": "mistral" }
  ```
