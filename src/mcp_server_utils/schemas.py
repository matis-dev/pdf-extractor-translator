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
