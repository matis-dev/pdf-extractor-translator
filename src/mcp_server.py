from mcp.server.fastmcp import FastMCP
import logging
import json
import os
import shutil
import zipfile
import subprocess
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Optional

# Import local validation schemas and security utils
from mcp_server_utils.schemas import (
    ExtractPdfInput, TranslateInput,
    CompressPdfInput, MergePdfsInput, SplitPdfInput, ConvertPdfInput,
    PdfToImagesInput, AskDocumentInput, SummarizeDocumentInput, GetPdfInfoInput,
    ListPdfsInput
)
from mcp_server_utils.security import validate_path, ALLOWED_DIRECTORIES

# Import project utilities
from extract_full_document_to_word import extract_full_document_to_word as _extract_doc
from extract_tables_to_csv import extract_tables as _extract_tables
from translation_utils import translate_text as _translate_text
from ai_utils import get_pdf_chat_instance, LANGCHAIN_AVAILABLE

# Libraries for local logic implementation
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
import pikepdf
from pdf2image import convert_from_path

# Initialize FastMCP server
mcp = FastMCP("PDF Extractor")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Resources ---

@mcp.resource("pdf://capabilities")
def get_capabilities() -> str:
    """Returns the server's capabilities as structured JSON."""
    return json.dumps({
        "name": "PDF Extractor",
        "version": "3.0.0",
        "tools": [
            "extract_pdf_to_word", "extract_pdf_tables", "translate_text",
            "compress_pdf", "merge_pdfs", "split_pdf", "convert_pdf",
            "pdf_to_images", "ask_document", "summarize_document",
            "list_pdfs", "get_pdf_info"
        ],
        "supported_languages": ["en", "es", "fr", "de", "pl", "pt", "it", "nl", "ru"],
        "ai_enabled": LANGCHAIN_AVAILABLE
    })

@mcp.resource("pdf://status")
def get_status() -> str:
    """Returns the server health and AI availability status."""
    ai_status = "unavailable"
    if LANGCHAIN_AVAILABLE:
        try:
            chat = get_pdf_chat_instance()
            if chat.check_ollama_available():
                ai_status = "ready"
            else:
                ai_status = "ollama_not_running"
        except Exception:
            ai_status = "error"
            
    return json.dumps({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "ai_status": ai_status,
        "allowed_directories": [str(d) for d in ALLOWED_DIRECTORIES]
    })

# --- Helper Functions ---

def _get_output_path(original_path: Path, suffix: str, output_filename: Optional[str] = None) -> Path:
    """Determines output path, ensuring it's safe."""
    if output_filename:
        # If user provides a filename, we put it in the same directory as original
        # This assumes the user wants output in the same place.
        # We validate the full proposed path.
        target_dir = original_path.parent
        full_path = target_dir / output_filename
        return validate_path(str(full_path), check_exists=False)
    else:
        # Generate default name
        new_name = f"{original_path.stem}_{suffix}"
        return original_path.parent / new_name

# --- Tools ---

@mcp.tool()
def extract_pdf_to_word(input: ExtractPdfInput) -> str:
    """Converts a PDF document to Word (.docx)."""
    logger.info(f"Extracting PDF to Word: {input.pdf_path}")
    try:
        valid_path = validate_path(input.pdf_path)
        output_path = _extract_doc(str(valid_path))
        return f"Successfully extracted to: {output_path}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"Error: {str(e)}"

@mcp.tool()
def extract_pdf_tables(input: ExtractPdfInput) -> str:
    """Extracts tables from PDF to CSV files."""
    logger.info(f"Extracting tables from PDF: {input.pdf_path}")
    try:
        valid_path = validate_path(input.pdf_path)
        output_dir = _extract_tables(str(valid_path))
        if output_dir:
            return f"Tables extracted to directory: {output_dir}"
        return "No tables found or error occurred."
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"Error: {str(e)}"

@mcp.tool()
def translate_text(input: TranslateInput) -> str:
    """Translates text using offline models."""
    logger.info(f"Translating text to {input.target_lang}")
    try:
        return _translate_text(input.text, input.target_lang, input.source_lang)
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"Error: {str(e)}"

@mcp.tool()
def compress_pdf(input: CompressPdfInput) -> str:
    """Compresses a PDF file to reduce size."""
    logger.info(f"Compressing PDF: {input.pdf_path} (Quality: {input.quality})")
    try:
        valid_path = validate_path(input.pdf_path)
        
        # Quality Presets
        presets = {
            'screen': '/screen', 'ebook': '/ebook', 
            'printer': '/printer', 'prepress': '/prepress', 
            'default': '/ebook'
        }
        gs_setting = presets.get(input.quality, '/ebook')
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = _get_output_path(valid_path, f"compressed_{input.quality}_{timestamp}.pdf")
        
        cmd = [
            "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_setting}",
            "-dNOPAUSE", "-dQUIET", "-dBATCH",
            f"-sOutputFile={output_path}",
            str(valid_path)
        ]
        
        subprocess.run(cmd, check=True)
        return f"Compressed PDF saved to: {output_path}"
    except subprocess.CalledProcessError:
        return "Error: Ghostscript compression failed. Ensure 'gs' is installed."
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def merge_pdfs(input: MergePdfsInput) -> str:
    """Merges multiple PDF files into one."""
    logger.info(f"Merging {len(input.pdf_paths)} PDFs")
    try:
        merger = PdfWriter()
        parent_dir = None
        
        for path in input.pdf_paths:
            valid_path = validate_path(path)
            if parent_dir is None:
                parent_dir = valid_path.parent
            merger.append(str(valid_path))
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_name = input.output_filename or f"merged_{timestamp}.pdf"
        
        # If output_filename is just a name, put it in the first file's dir
        if os.path.sep not in output_name:
            output_path = parent_dir / output_name if parent_dir else Path(output_name)
        else:
            output_path = Path(output_name)
            
        # Validate output path
        output_path = validate_path(str(output_path), check_exists=False)
        
        merger.write(str(output_path))
        merger.close()
        return f"Merged PDF saved to: {output_path}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def split_pdf(input: SplitPdfInput) -> str:
    """Splits a PDF based on page ranges (e.g., '1-5', '1,3,5')."""
    logger.info(f"Splitting PDF: {input.pdf_path} (Ranges: {input.page_ranges})")
    try:
        valid_path = validate_path(input.pdf_path)
        reader = PdfReader(str(valid_path))
        total_pages = len(reader.pages)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ranges = [r.strip() for r in input.page_ranges.split(',')]
        output_files = []
        
        for i, r in enumerate(ranges):
            writer = PdfWriter()
            try:
                if '-' in r:
                    start, end = map(int, r.split('-'))
                else:
                    start = int(r)
                    end = int(r)
            except ValueError:
                return f"Error: Invalid range format '{r}'"
                
            if start < 1 or end > total_pages or start > end:
                return f"Error: Invalid page range {start}-{end} (Total pages: {total_pages})"
            
            # 1-based to 0-based
            for p in range(start - 1, end):
                writer.add_page(reader.pages[p])
                
            out_name = f"{valid_path.stem}_part{i+1}_{r}.pdf"
            out_path = valid_path.parent / out_name
            writer.write(str(out_path))
            output_files.append(str(out_path))
            
        return f"Created {len(output_files)} split files:\n" + "\n".join(output_files)
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def convert_pdf(input: ConvertPdfInput) -> str:
    """Converts PDF to other formats (pdfa, images, text, etc)."""
    logger.info(f"Converting PDF: {input.pdf_path} to {input.target_format}")
    try:
        valid_path = validate_path(input.pdf_path)
        target = input.target_format
        
        if target == 'pdfa':
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            out_path = _get_output_path(valid_path, f"pdfa_{timestamp}.pdf")
            cmd = [
                "gs", "-dPDFA=2", "-dBATCH", "-dNOPAUSE", 
                "-sColorConversionStrategy=RGB", "-sDEVICE=pdfwrite", 
                "-dPDFACompatibilityPolicy=1", 
                f"-sOutputFile={out_path}", str(valid_path)
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return f"Converted to PDF/A: {out_path}"
            
        elif target in ['txt', 'html']:
            # Use basic extraction or existing tools
            if target == 'txt':
                # Simple pypdf extraction
                reader = PdfReader(str(valid_path))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                
                out_path = _get_output_path(valid_path, "content.txt")
                with open(out_path, "w") as f:
                    f.write(text)
                return f"Extracted text to: {out_path}"
            
        return "Error: This specific conversion path is partially implemented. Use specialized tools for Docx/Images."
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def pdf_to_images(input: PdfToImagesInput) -> str:
    """Converts PDF pages to images."""
    logger.info(f"Converting PDF to images: {input.pdf_path}")
    try:
        valid_path = validate_path(input.pdf_path)
        output_dir = valid_path.parent / f"{valid_path.stem}_images"
        output_dir.mkdir(exist_ok=True)
        
        images = convert_from_path(str(valid_path), dpi=150)
        saved_files = []
        
        for i, image in enumerate(images):
            fname = f"page_{i+1}.{input.output_format}"
            fpath = output_dir / fname
            image.save(str(fpath), input.output_format.upper())
            saved_files.append(str(fpath))
            
        return f"Saved {len(saved_files)} images to directory: {output_dir}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def ask_document(input: AskDocumentInput) -> str:
    """Asks questions about a PDF using local AI."""
    logger.info(f"AI Chat request for: {input.pdf_path}")
    if not LANGCHAIN_AVAILABLE:
        return "Error: AI dependencies (LangChain, Ollama) not available."
        
    try:
        valid_path = validate_path(input.pdf_path)
        chat = get_pdf_chat_instance()
        
        if not chat.check_ollama_available():
            return "Error: Ollama is not running. Please start 'ollama serve'."
            
        # Index file
        chat.index_pdf(str(valid_path))
        
        # Ask
        result = chat.ask(input.question)
        return f"Answer: {result.get('answer')}\n(Source: {result.get('model_used')})"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def summarize_document(input: SummarizeDocumentInput) -> str:
    """Summarizes a PDF document."""
    logger.info(f"AI Summary request for: {input.pdf_path}")
    if not LANGCHAIN_AVAILABLE:
        return "Error: AI dependencies not available."
        
    try:
        valid_path = validate_path(input.pdf_path)
        chat = get_pdf_chat_instance()
        
        if not chat.check_ollama_available():
            return "Error: Ollama is not running."
            
        chat.index_pdf(str(valid_path))
        result = chat.summarize_document(mode=input.mode)
        
        if result.get("error"):
            return f"Error: {result['error']}"
            
        return f"Summary ({input.mode}):\n{result.get('summary')}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def list_pdfs(input: ListPdfsInput) -> str:
    """Lists PDF files in a directory."""
    try:
        # User defined input.directory is strict string
        root_path = validate_path(input.directory)
        
        results = []
        pattern = "**/*.pdf" if input.recursive else "*.pdf"
        
        for path in root_path.glob(pattern):
            results.append(str(path))
            
        return json.dumps(results[:50], indent=2) # Cap at 50
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def get_pdf_info(input: GetPdfInfoInput) -> str:
    """Gets metadata and page count for a PDF."""
    try:
        valid_path = validate_path(input.pdf_path)
        reader = PdfReader(str(valid_path))
        
        info = {
            "filename": valid_path.name,
            "pages": len(reader.pages),
            "size_bytes": valid_path.stat().st_size,
            "metadata": reader.metadata
        }
        return json.dumps(info, indent=2, default=str)
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    mcp.run()
