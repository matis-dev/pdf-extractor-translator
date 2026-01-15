import os
import pdfplumber
from pdf2image import convert_from_path
try:
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

def pdf_to_txt(pdf_path: str, output_dir: str, options=None):
    """
    Extracts text from PDF to a TXT file.
    
    Args:
        pdf_path: Path to source PDF
        output_dir: Directory to save output
        options: Dict containing 'page_separator', 'encoding'
    
    Returns:
        List containing the generated filename (usually just one .txt)
    """
    options = options or {}
    use_separator = options.get('page_separator', True)
    encoding = options.get('encoding', 'utf-8')
    
    output_filename = "document.txt"
    output_path = os.path.join(output_dir, output_filename)
    
    full_text = []
    
    # Open PDF
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Check if we need OCR (if mostly empty)? 
        # Strategy: Try extract_text. If empty/scant on a page, try OCR for that page.
        
        # Lazily load images only if needed to save perf? 
        # Actually pdfplumber doesn't give images easily for OCR without pdf2image usually.
        # We'll just iterate pages.
        
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            
            # Simple heuristic: if text is None or very short, try OCR
            if (not text or len(text.strip()) < 5) and OCR_AVAILABLE:
                # We need to render the page to image to OCR it.
                # pdfplumber can .to_image() but pdf2image is more robust usually.
                # Let's use pdfplumber's to_image if available to stay within context, 
                # or simpler: just use pdf2image for that specific page index.
                # For simplicity/speed in this slice, let's use global pdf2image if text failed.
                try:
                    # Convert specific page to image
                    images = convert_from_path(pdf_path, first_page=i+1, last_page=i+1)
                    if images:
                        text = pytesseract.image_to_string(images[0])
                except Exception:
                    pass # Fallback to empty if OCR fails too
            
            text = text or ""
            
            if use_separator:
                header = f"--- Page {i+1} ---"
                full_text.append(header)
                full_text.append(text)
                full_text.append("") # Spacing
            else:
                full_text.append(text)
    
    # Write to file
    content = "\n".join(full_text)
    with open(output_path, "w", encoding=encoding) as f:
        f.write(content)
        
    return [output_filename]
