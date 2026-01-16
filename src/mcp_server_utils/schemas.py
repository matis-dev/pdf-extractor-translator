from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from pathlib import Path

SUPPORTED_LANGUAGES = Literal['en', 'es', 'fr', 'de', 'pl', 'pt', 'it', 'nl', 'ru']

class ExtractPdfInput(BaseModel):
    """Input for PDF extraction tools."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file. Must exist and be readable.",
        examples=["/home/user/Documents/report.pdf"]
    )
    
    @field_validator('pdf_path')
    @classmethod
    def validate_pdf_exists(cls, v: str) -> str:
        path = Path(v)
        if not path.exists():
            raise ValueError(f"PDF file not found: {v}")
        if not path.suffix.lower() == '.pdf':
            raise ValueError(f"File must be a PDF: {v}")
        return str(path.resolve())

class TranslateInput(BaseModel):
    """Input for text translation."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=50000,
        description="The text to translate. Maximum 50,000 characters."
    )
    target_lang: SUPPORTED_LANGUAGES = Field(
        ...,
        description="Target language code: en, es, fr, de, pl, pt, it, nl, ru"
    )
    source_lang: SUPPORTED_LANGUAGES = Field(
        default='en',
        description="Source language code (default: en)"
    )

class ListPdfsInput(BaseModel):
    """Input for listing PDF files."""
    directory: str = Field(
        ...,
        description="Directory path to search for PDF files."
    )
    recursive: bool = Field(
        default=False,
        description="Whether to search subdirectories."
    )

class CompressPdfInput(BaseModel):
    """Input for PDF compression."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file to compress."
    )
    quality: Literal['screen', 'ebook', 'printer', 'prepress', 'default'] = Field(
        default='ebook',
        description="Compression quality preset: screen (lowest/smallest), ebook (medium), printer (high), prepress (highest)."
    )

class MergePdfsInput(BaseModel):
    """Input for merging multiple PDFs."""
    pdf_paths: list[str] = Field(
        ...,
        min_length=2,
        description="List of absolute paths to PDF files to merge, in order."
    )
    output_filename: Optional[str] = Field(
        default=None,
        description="Optional specific output filename. Checks allowed directories."
    )

class SplitPdfInput(BaseModel):
    """Input for splitting a PDF."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file to split."
    )
    page_ranges: str = Field(
        ...,
        description="Page ranges to extract (e.g. '1-5', '1,3,5', '10-end')."
    )

class ConvertPdfInput(BaseModel):
    """Input for converting PDF to other formats."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file to convert."
    )
    target_format: Literal['docx', 'csv', 'odt', 'txt', 'html', 'pdfa'] = Field(
        ...,
        description="Target format: docx, csv, odt, txt, html, pdfa"
    )

class PdfToImagesInput(BaseModel):
    """Input for converting PDF pages to images."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file."
    )
    output_format: Literal['png', 'jpg', 'webp', 'tiff'] = Field(
        default='png',
        description="Output image format (default: png)."
    )

class AskDocumentInput(BaseModel):
    """Input for asking questions about a PDF."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file."
    )
    question: str = Field(
        ...,
        description="The question to ask about the document."
    )

class SummarizeDocumentInput(BaseModel):
    """Input for summarizing a PDF."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file."
    )
    mode: Literal['brief', 'detailed'] = Field(
        default='brief',
        description="Summary mode: 'brief' for executive summary, 'detailed' for section-by-section."
    )

class GetPdfInfoInput(BaseModel):
    """Input for getting PDF metadata."""
    pdf_path: str = Field(
        ...,
        description="Absolute path to the PDF file."
    )
