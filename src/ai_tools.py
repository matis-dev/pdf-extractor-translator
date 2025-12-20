from langchain_core.tools import tool
from extract_tables_to_csv import extract_tables
from translation_utils import translate_text
import re
import os

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
def translate(text: str, target_lang: str, source_lang: str = "en") -> str:
    """Translate text between languages.
    Supported: en, es, fr, de, pl, pt, it, nl, ru.
    Args:
        text: Text to translate.
        target_lang: Target language code.
        source_lang: Source language code.
    """
    return translate_text(text, target_lang, source_lang)
