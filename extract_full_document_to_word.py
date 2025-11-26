#!/usr/bin/env python3
"""
A script to extract all content (text and tables) from a PDF file and save it
into a structured Microsoft Word (.docx) document.

This script uses the Docling library to parse the PDF and preserve its structure,
including headings, paragraphs, lists, and tables.

Usage:
    python extract_full_document_to_word.py <path_to_pdf_file>

Example:
    python extract_full_document_to_word.py my_document.pdf
"""

import logging
import os
import sys
from pathlib import Path

import pandas as pd
from docling.document_converter import DocumentConverter
from docx import Document
from docx.shared import Inches

_log = logging.getLogger(__name__)


def extract_full_document_to_word(pdf_path: str):
    """
    Extracts all content from a PDF and saves it to a Word document.

    Args:
        pdf_path: The path to the PDF file.
    """
    logging.basicConfig(level=logging.INFO)

    if "TESSDATA_PREFIX" not in os.environ:
        tessdata_prefix = "/usr/share/tesseract-ocr/5/tessdata/"
        if os.path.exists(tessdata_prefix):
            os.environ["TESSDATA_PREFIX"] = tessdata_prefix
        else:
            _log.warning(
                f"TESSDATA_PREFIX not set and default path '{tessdata_prefix}' not found. "
                "OCR may fail if Tesseract is not configured correctly."
            )

    input_doc_path = Path(pdf_path)
    if not input_doc_path.exists():
        _log.error(f"Error: PDF file not found at '{input_doc_path}'")
        return

    output_docx_path = Path(f"{input_doc_path.stem}_full_content.docx")

    _log.info(f"Processing PDF: {input_doc_path}")
    _log.info(f"Output will be saved to: {output_docx_path}")

    doc_converter = DocumentConverter()
    conv_res = doc_converter.convert(input_doc_path)
    docling_doc = conv_res.document

    # Create a mapping of self_ref to element for easy lookup
    element_map = {}
    for element_type in ["texts", "tables", "groups", "pictures"]:
        for element in getattr(docling_doc, element_type, []):
            element_map[element.self_ref] = element

    document = Document()
    document.add_heading(f"Content Extracted from {input_doc_path.name}", 0)

    # Process elements in the order they appear in the document body
    for child_ref in docling_doc.body.children:
        element_cref = child_ref.cref
        element_type = element_cref.split('/')[1] # e.g., #/texts/0 -> texts
        element = element_map.get(element_cref)
        if not element:
            continue

        if element_type == "texts":
            if hasattr(element, 'label') and element.label == "section_header":
                document.add_heading(element.text, level=element.level or 1)
            elif hasattr(element, 'label') and element.label == "list_item":
                document.add_paragraph(element.text, style='List Bullet')
            else:
                document.add_paragraph(element.text)

        elif element_type == "tables":
            document.add_heading(f"Table", level=2)
            table_df: pd.DataFrame = element.export_to_dataframe(doc=docling_doc)
            
            if not table_df.empty:
                # Add a table to the document
                doc_table = document.add_table(rows=1, cols=len(table_df.columns))
                doc_table.style = 'Table Grid'

                # Add the header row
                for j, col_name in enumerate(table_df.columns):
                    doc_table.cell(0, j).text = str(col_name)

                # Add the data rows
                for i, row in table_df.iterrows():
                    row_cells = doc_table.add_row().cells
                    for j, cell_value in enumerate(row):
                        row_cells[j].text = str(cell_value)
            document.add_paragraph() # Add some space after the table

    document.save(output_docx_path)
    _log.info(f"Successfully extracted full document content to '{output_docx_path}'.")
    return output_docx_path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python extract_full_document_to_word.py <path_to_pdf_file>")
        print("Example: python extract_full_document_to_word.py my_document.pdf")
        sys.exit(1)

    pdf_file = sys.argv[1]
    extract_full_document_to_word(pdf_file)
