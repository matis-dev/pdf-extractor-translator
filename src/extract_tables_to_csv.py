#!/usr/bin/env python3
"""
A script to extract tables from a PDF file and save each table as a separate CSV file.

This script uses the Docling library to parse the PDF, identify tables, and export
them to a structured format (pandas DataFrame), which is then saved as a CSV file.

Usage:
    python extract_tables_from_pdf.py <path_to_pdf_file>

Example:
    python extract_tables_from_pdf.py my_document.pdf
"""

import logging
import os
import sys
from pathlib import Path

import pandas as pd
from docling.document_converter import DocumentConverter

_log = logging.getLogger(__name__)


def extract_tables(pdf_path: str):
    """
    Extracts tables from a PDF file and saves them as CSV files.

    Args:
        pdf_path: The path to the PDF file.
    """
    logging.basicConfig(level=logging.INFO)

    # Set TESSDATA_PREFIX if not already set (important for tesserocr)
    if "TESSDATA_PREFIX" not in os.environ:
        # This is a common path on Debian/Ubuntu systems. You may need to adjust it.
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

    # Create an output directory named after the PDF file
    output_dir = Path(f"{input_doc_path.stem}_tables")
    output_dir.mkdir(parents=True, exist_ok=True)

    _log.info(f"Processing PDF: {input_doc_path}")
    _log.info(f"Output directory: {output_dir}")

    doc_converter = DocumentConverter()
    conv_res = doc_converter.convert(input_doc_path)

    # Export tables
    if not conv_res.document.tables:
        _log.info("No tables found in the document.")
        return

    for table_ix, table in enumerate(conv_res.document.tables):
        table_df: pd.DataFrame = table.export_to_dataframe(doc=conv_res.document)

        # Save the table as CSV
        element_csv_filename = output_dir / f"table_{table_ix + 1}.csv"
        _log.info(f"Saving table {table_ix + 1} to {element_csv_filename}")
        table_df.to_csv(element_csv_filename, index=False)

    _log.info(
        f"Successfully extracted {len(conv_res.document.tables)} tables to '{output_dir}'."
    )
    return str(output_dir)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python extract_tables_from_pdf.py <path_to_pdf_file>")
        print("Example: python extract_tables_from_pdf.py my_document.pdf")
        sys.exit(1)

    pdf_file = sys.argv[1]
    extract_tables(pdf_file)
