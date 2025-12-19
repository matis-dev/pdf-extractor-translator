from mcp.server.fastmcp import FastMCP
import logging
import json
from pathlib import Path
from typing import List

# Import local validation schemas and security utils
from mcp_server_utils.schemas import ExtractPdfInput, TranslateInput
from mcp_server_utils.security import validate_path

# Import project utilities
from extract_full_document_to_word import extract_full_document_to_word as _extract_doc
from extract_tables_to_csv import extract_tables as _extract_tables
from translation_utils import translate_text as _translate_text

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
        "version": "2.0.0",
        "tools": ["extract_pdf_to_word", "extract_pdf_tables", "translate_text"],
        "supported_languages": ["en", "es", "fr", "de", "pl", "pt", "it", "nl", "ru"],
        "supported_formats": ["pdf"],
        "output_formats": ["docx", "csv"]
    })

# --- Tools ---

@mcp.tool()
def extract_pdf_to_word(input: ExtractPdfInput) -> str:
    """
    Converts a PDF document to a Microsoft Word (.docx) file, preserving:
    - Text content with formatting (headings, paragraphs, lists)
    - Tables with original structure
    - Images embedded in the document
    
    The output file is created in the same directory as the input PDF
    with '_full_content.docx' appended to the filename.
    
    USE THIS TOOL WHEN:
    - User wants to edit PDF content in Word
    - User needs to extract all content from a PDF
    - User wants a editable version of a PDF document
    
    LIMITATIONS:
    - Complex layouts may not be perfectly preserved
    - Handwritten text requires OCR and may have errors
    - Password-protected PDFs are not supported
    """
    path_str = input.pdf_path
    logger.info(f"Extracting PDF to Word: {path_str}")
    
    try:
        # Validate path (security check)
        # Note: Pydantic schema already checks existence, but we double-check security
        valid_path = validate_path(path_str)
        
        output_path = _extract_doc(str(valid_path))
        return str(output_path)
    except ValueError as ve:
        logger.warning(f"Validation error: {ve}")
        return f"Error: {str(ve)}"
    except Exception as e:
        logger.error(f"Error extracting PDF to Word: {e}")
        return f"Error: {str(e)}"

@mcp.tool()
def extract_pdf_tables(input: ExtractPdfInput) -> str:
    """
    Extracts all tables from a PDF and saves each as a separate CSV file.
    
    Tables are automatically detected and numbered (table_1.csv, table_2.csv, etc.).
    Output files are placed in a new directory named '{filename}_tables/'.
    
    USE THIS TOOL WHEN:
    - User wants to analyze tabular data from a PDF
    - User needs tables in a spreadsheet-compatible format
    - User wants to import PDF tables into Excel or pandas
    
    LIMITATIONS:
    - Tables without clear borders may not be detected
    - Merged cells may result in unexpected output
    - Returns empty result if no tables are found
    """
    path_str = input.pdf_path
    logger.info(f"Extracting tables from PDF: {path_str}")
    
    try:
        valid_path = validate_path(path_str)
        
        output_dir = _extract_tables(str(valid_path))
        if output_dir:
            return str(output_dir)
        else:
            return "No tables found or error occurred."
    except ValueError as ve:
        logger.warning(f"Validation error: {ve}")
        return f"Error: {str(ve)}"
    except Exception as e:
        logger.error(f"Error extracting tables: {e}")
        return f"Error: {str(e)}"

@mcp.tool()
def translate_text(input: TranslateInput) -> str:
    """
    Translates text between languages using local Argos Translate models.
    
    This translation runs ENTIRELY OFFLINE - no data is sent to external services.
    Suitable for sensitive or confidential documents.
    
    SUPPORTED LANGUAGES:
    - en: English
    - es: Spanish  
    - fr: French
    - de: German
    - pl: Polish
    - pt: Portuguese
    - it: Italian
    - nl: Dutch
    - ru: Russian
    
    USE THIS TOOL WHEN:
    - User needs to translate extracted text
    - User wants offline/private translation
    - User is working with multilingual documents
    
    LIMITATIONS:
    - Maximum 50,000 characters per request
    - Quality varies by language pair
    - Technical/domain-specific terms may be imprecise
    """
    logger.info(f"Translating text to {input.target_lang}")
    try:
        return _translate_text(input.text, input.target_lang, input.source_lang)
    except Exception as e:
        logger.error(f"Error translating text: {e}")
        return f"Error: {str(e)}"

if __name__ == "__main__":
    mcp.run()
