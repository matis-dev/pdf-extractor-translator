![Status](https://img.shields.io/badge/Status-Beta-yellow) ![License](https://img.shields.io/badge/License-MIT-blue) ![Python](https://img.shields.io/badge/Python-3.9%2B-blue)

# PDF Content Extractor & Translator

A powerful, privacy-focused tool to extract structured content from PDF documents. It converts PDFs into editable formats like Microsoft Word (`.docx`), OpenDocument Text (`.odt`), and CSV (for tables), with built-in offline translation capabilities.

Powered by [Docling](https://github.com/DS4SD/docling) for advanced document parsing, **Flask** for the web interface, and **Celery** for background task processing.

## 🚀 Key Features

*   **Full Document Extraction:** Converts PDFs to `.docx` preserving structure (headings, paragraphs, lists) and styling.
*   **Table Extraction:** Detects tables and exports them to CSV files or directly into Word documents.
*   **Document Manipulation:**
    *   **Merge:** Combine multiple PDFs into a single file.
    *   **Split:** Extract specific page ranges into separate files.
    *   **Compress:** Reduce file size for easier sharing.
    *   **Repair:** Attempt to fix corrupted PDF files.
    *   **Convert:** Export PDF pages as high-quality JPG images.
*   **Editor Tools:**
    *   **Annotations:** Highlight text, redact sensitive info, and add sticky notes.
    *   **Shapes:** Draw rectangles, circles, lines, and arrows.
    *   **Watermark:** Add custom text or image watermarks.
    *   **Page Numbers:** Add customizable pagination.
    *   **Signatures:** Sign documents by drawing, typing, or uploading a signature.
*   **Offline Translation:** Translate extracted content (including tables!) to **Spanish**, **French**, or **German** locally using `argostranslate`. No API keys required.
*   **Format Conversion:** Supports `.odt` output (requires `pandoc`).
*   **Asynchronous Processing:** Handles large files efficiently using background workers (Redis + Celery).
*   **Dual Mode:** Run as a user-friendly Web Application or as standalone Command-Line Scripts.

---

## 🛠️ Prerequisites & Installation

### 1. System Dependencies

You need to install a few system-level tools before running the python scripts.

*   **Redis:** Required for the background worker queue.
    *   *Docker:* `docker run -d -p 6379:6379 --name redis-pdf-extractor --restart always redis`
    *   *Linux (apt):* `sudo apt-get install redis-server`
*   **Pandoc:** Required for `.odt` conversion.
    *   *Linux (apt):* `sudo apt-get install pandoc`
    *   *Conda:* `conda install -c conda-forge pandoc`
*   **Tesseract OCR:** Required by Docling for OCR capabilities.
    *   *Linux (apt):* `sudo apt-get install tesseract-ocr`
    *   *macOS:* `brew install tesseract`
    *   *Windows:* [Installer](https://github.com/UB-Mannheim/tesseract/wiki)

### 2. Python Dependencies

Clone the repository and install the required Python packages.

```bash
# Recommended: Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install "docling[tesserocr]" pandas python-docx Flask celery redis argostranslate pdfplumber
```

> **Note:** If you encounter errors related to `tesserocr`, ensure you have the Tesseract development headers installed (e.g., `sudo apt-get install libtesseract-dev` on Ubuntu).

---

## 🖥️ Usage: Web Application

The web interface is the easiest way to use the tool, offering a simple drag-and-drop UI.

1.  **Start Redis:** Ensure your Redis server is running.
2.  **Start the Background Worker:**
    ```bash
    ./start_worker.sh
    ```
3.  **Start the Web Server:**
    ```bash
    python app.py
    # or ./start_app.sh
    ```
4.  **Access the App:** Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---


## 🐳 Usage: Docker (Recommended)

Run the entire stack with a single command. This is the **most reliable way** to run the application as it handles all dependencies (Redis, OCR tools, Translation models) automatically.

```bash
docker-compose up --build
```
The app will be available at **[http://127.0.0.1:5000](http://127.0.0.1:5000)**. 

> **Note:** The first build may take a few minutes as it downloads and installs offline translation models. Subsequent runs will be instant.

To stop the application:
```bash
docker-compose down
```

---

## 💻 Usage: Command-Line Interface (CLI)

You can run the extraction scripts directly if you don't need the web UI or translation features.

### Extract Full Document to Word
Converts the entire PDF into a Word document.
```bash
python extract_full_document_to_word.py input_document.pdf
```
*Output:* `input_document_full_content.docx`

### Extract Tables to CSV
Extracts all tables found in the PDF into separate CSV files.
```bash
python extract_tables_to_csv.py input_document.pdf
```
*Output:* A folder named `input_document_tables/` containing CSV files.

### Extract Tables to Word
Extracts only the tables into a Word document.
```bash
python extract_tables_to_word.py input_document.pdf
```
*Output:* `input_document_tables.docx`

---

## 📂 Project Structure

*   `app.py`: Main Flask application entry point.
*   `tasks.py`: Celery tasks for handling long-running extractions and translations.
*   `extract_*.py`: Core logic scripts for Docling-based extraction.
*   `templates/`: HTML templates for the web interface.
*   `uploads/` & `outputs/`: Directories for storing temporary files.
*   `translation_utils.py`: Helper functions for `argostranslate`.

## ⚠️ Troubleshooting

*   **Tesseract Error:** If you see errors about `TESSDATA_PREFIX`, make sure the environment variable is set to your tessdata directory (e.g., `/usr/share/tesseract-ocr/5/tessdata/`).
*   **Redis Connection:** If the worker fails to connect, check if Redis is running on `localhost:6379`.
