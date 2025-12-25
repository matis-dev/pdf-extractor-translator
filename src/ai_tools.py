from langchain_core.tools import tool
from extract_tables_to_csv import extract_tables
from extract_full_document_to_word import extract_full_document_to_word as extract_doc_to_word
from translation_utils import translate_text
import os
import shutil
from pathlib import Path
from pypdf import PdfReader, PdfWriter
import subprocess
from datetime import datetime

# Global config (should match app.py or be injected)
OUTPUT_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs')

@tool
def extract_pdf_tables(pdf_path: str) -> str:
    """Extract all tables from a PDF and save as CSV files.
    Use when user asks to extract tables or wants spreadsheet data.
    Args:
        pdf_path: Path to the PDF file.
    Returns:
        Path to directory containing CSV files.
    """
    return extract_tables(pdf_path)

@tool
def convert_to_word(pdf_path: str) -> str:
    """Convert the entire PDF document to a detailed Microsoft Word (.docx) file.
    Use this when the user wants to edit the document in Word or asks for a full conversion.
    Args:
        pdf_path: Path to the PDF file.
    Returns:
        Path to the saved .docx file.
    """
    # Ensure output folder exists
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    
    # Run extraction
    output_path = extract_doc_to_word(pdf_path)
    
    # Move to global output folder if not already there
    filename = os.path.basename(output_path)
    final_path = os.path.join(OUTPUT_FOLDER, filename)
    
    # Avoid overwrite if source and dest are same (extract_doc_to_word saves alongside input usually)
    if os.path.abspath(output_path) != os.path.abspath(final_path):
        shutil.move(output_path, final_path)
        
    return str(final_path)

@tool
def split_pdf(pdf_path: str, page_ranges: str) -> str:
    """Split the PDF into multiple files based on page ranges.
    Args:
        pdf_path: Path to the PDF file.
        page_ranges: A string of comma-separated ranges, e.g., "1-3, 5, 7-9".
    Returns:
        Message with list of created files.
    """
    if not os.path.exists(pdf_path):
        return "Error: File not found."
        
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    
    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        ranges = [r.strip() for r in page_ranges.split(',')]
        output_files = []
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        for i, r in enumerate(ranges):
            writer = PdfWriter()
            if '-' in r:
                try:
                    start, end = map(int, r.split('-'))
                except ValueError:
                    return f"Error: Invalid range format '{r}'"
            else:
                try:
                    start = int(r)
                    end = int(r)
                except ValueError:
                    return f"Error: Invalid page number '{r}'"
                
            if start < 1 or end > total_pages or start > end:
                continue
                
            # pypdf is 0-indexed
            for p in range(start - 1, end):
                if p < total_pages:
                    writer.add_page(reader.pages[p])
                
            out_name = f"{base_name}_split_{r}.pdf"
            out_path = os.path.join(OUTPUT_FOLDER, out_name)
            with open(out_path, "wb") as f:
                writer.write(f)
            output_files.append(str(out_path)) # Return absolute path
            
        if not output_files:
            return "No valid pages extracted. Check page numbers."
            
        return f"Successfully split into: {', '.join(output_files)}."
    except Exception as e:
        return f"Error splitting PDF: {str(e)}"

@tool
def compress_pdf(pdf_path: str) -> str:
    """Compress the PDF file to reduce its size.
    Args:
        pdf_path: Path to the PDF file.
    Returns:
        Path to the compressed file.
    """
    if not os.path.exists(pdf_path):
        return "Error: File not found."
        
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    timestamp = datetime.now().strftime("%H%M%S")
    out_name = f"{base_name}_compressed_{timestamp}.pdf"
    out_path = os.path.join(OUTPUT_FOLDER, out_name)
    
    cmd = [
        "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook",
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        f"-sOutputFile={out_path}",
        pdf_path
    ]
    
    try:
        subprocess.run(cmd, check=True)
        return f"Compressed file saved to: {out_path}"
    except Exception as e:
        return f"Compression failed: {str(e)}"

@tool
def translate(text: str, target_lang: str, source_lang: str = "en") -> str:
    """Translate text between languages.
    Supported: en, es, fr, de, pl, pt, it, nl, ru.
    Args:
        text: Text to translate.
        target_lang: Target language code.
        source_lang: Source language code.
    """
    return translate_text(text, target_lang, source_lang)

