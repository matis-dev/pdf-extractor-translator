
import fitz  # PyMuPDF
import logging
import os
from translation_utils import translate_text

logger = logging.getLogger(__name__)

class PDFTranslationService:
    def translate_pdf_in_place(self, input_path, output_path, source_lang, target_lang):
        """
        Translates text in a PDF file and saves the result to a new file, 
        attempting to preserve layout.
        
        Args:
            input_path (str): Path to source PDF.
            output_path (str): Path to save translated PDF.
            source_lang (str): Source language code.
            target_lang (str): Target language code.
            
        Returns:
            str: Path to the output file (same as output_path).
        """
        try:
            doc = fitz.open(input_path)
            
            for page in doc:
                # Get all text blocks
                blocks = page.get_text("dict")["blocks"]
                
                # We need to collect operations and apply them
                # To avoid modifying the page while iterating, we'll store data
                replacements = []
                
                for block in blocks:
                    if "lines" not in block:
                        continue
                        
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text = span["text"].strip()
                            if not text:
                                continue
                                
                            # Basic translation
                            # Note: Translating word-by-word or span-by-span is terrible for grammar
                            # but easiest for "In Place" layout preservation without advanced segmentation.
                            # Ideally, we would reconstruct sentences. Refactoring this is a future task.
                            translated = translate_text(text, target_lang, source_lang)
                            
                            replacements.append({
                                "bbox": span["bbox"],
                                "origin": span["origin"],
                                "size": span["size"],
                                "color": span["color"],
                                "text": translated,
                                "original_text": text
                            })
                
                # Apply replacements
                for rep in replacements:
                    # 1. Redact original (draw white rectangle)
                    # bbox is (x0, y0, x1, y1)
                    # Add a small padding to ensure we cover the text?
                    rect = fitz.Rect(rep["bbox"])
                    
                    # Draw white box
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                    
                    # 2. Insert new text
                    # Convert color int to RGB tuple
                    # PyMuPDF span color is integer (sRGB)
                    # Ex: 0xRRGGBB ? No, it's usually an integer.
                    c = rep["color"]
                    r = ((c >> 16) & 255) / 255.0
                    g = ((c >> 8) & 255) / 255.0
                    b = (c & 255) / 255.0
                    
                    # Check if text fits?
                    # For now just insert
                    page.insert_text(
                        point=(rep["origin"][0], rep["origin"][1]),
                        text=rep["text"],
                        fontsize=rep["size"],
                        color=(r, g, b),
                        fontname="helv", # Default font for now
                    )
            
            doc.save(output_path)
            return output_path
            
        except Exception as e:
            logger.error(f"Error translating PDF: {e}")
            raise e
