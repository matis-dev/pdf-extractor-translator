# PDF Content and Table Extraction Scripts

This repository contains Python scripts and a Flask web application to extract content from PDF documents using the Docling library. You can extract just the tables into separate CSV files, or extract the entire document structure (headings, paragraphs, tables, etc.) into a Microsoft Word (`.docx`) file.

## Prerequisites

Before using these tools, ensure you have the following installed:

1.  **Python 3:** All scripts and the web application are written in Python 3.
2.  **Redis:** Required for background task processing.
    -   **Docker (Recommended):** `docker run -d -p 6379:6379 --name redis-pdf-extractor --restart always redis`
    -   Or install via your package manager.
3.  **Pandoc:** Required for ODT conversion.
    -   **Conda:** `conda install -c conda-forge pandoc`
    -   Or `sudo apt-get install pandoc`
4.  **Python Dependencies:**
    ```bash
    pip install "docling[tesserocr]" pandas python-docx Flask celery redis argostranslate
    ```
5.  **Tesseract OCR Engine:** (See original instructions below)

    -   **On Debian/Ubuntu-based Linux:**
        ```bash
        sudo apt-get update && sudo apt-get install tesseract-ocr
        ```
    -   **On macOS (using Homebrew):**
        ```bash
        brew install tesseract
        ```
    -   **On Windows:** Download and run the installer from the [Tesseract at UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) page.

    After installing Tesseract, you may need to set the `TESSDATA_PREFIX` environment variable.

---

## Web Application

The `app.py` script provides a user-friendly web interface for extracting content from PDF files.

**Script:** `app.py`

**Description:**
A Flask web application that allows users to upload a PDF file through a web browser. It uses asynchronous background processing (Celery) to handle large files without blocking.

**Features:**
1.  **Extract to Word (.docx):** Preserves document structure.
2.  **Extract to ODT (.odt):** OpenDocument Text format (requires Pandoc).
3.  **Extract Tables to CSV:** Saves tables as separate CSV files in a ZIP.
4.  **Offline Translation:** Optionally translate extracted content to Spanish, French, or German using `argostranslate` (runs locally, no API keys required).

### How to Run

1.  **Start Redis:** Ensure your Redis server/container is running.
2.  **Start the Worker:**
    ```bash
    ./start_worker.sh
    ```
3.  **Start the Flask App:**
    ```bash
    python app.py
    ```
4.  **Open Browser:** Go to [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Command-Line Scripts

(Scripts `extract_full_document_to_word.py` and `extract_tables_to_csv.py` can still be used directly for basic extraction without translation/async features.)
