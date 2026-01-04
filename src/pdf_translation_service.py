
import fitz  # PyMuPDF
import logging
import os
from translation_utils import translate_text

logger = logging.getLogger(__name__)

class PDFTranslationService:
    def determine_font(self, target_lang):
        """Selects a built-in PyMuPDF font based on target language."""
        lang = target_lang.lower()
        if lang.startswith('zh'): return "china-s"
        if lang.startswith('ja'): return "japan"
        if lang.startswith('ko'): return "korea"
        return "helv"

    def translate_pdf_in_place(self, input_path, output_path, source_lang, target_lang):
        """
        Translates text in a PDF file and saves the result to a new file, 
        attempting to preserve layout using shrink-to-fit and correct fonts.
        """
        try:
            doc = fitz.open(input_path)
            fontname = self.determine_font(target_lang)
            
            # Create a reusable font object for measurements
            # Note: Built-in fonts don't need to be loaded from file, 
            # but fitz.Font(fontname) helps us measure.
            try:
                measure_font = fitz.Font(fontname)
            except:
                # Fallback if font definition fails
                measure_font = fitz.Font("helv")
            
            for page in doc:
                blocks = page.get_text("dict")["blocks"]
                replacements = []
                
                for block in blocks:
                    if "lines" not in block:
                        continue
                        
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text = span["text"].strip()
                            if not text:
                                continue
                                
                            translated = translate_text(text, target_lang, source_lang)
                            
                            # Original metrics
                            bbox = span["bbox"]
                            origin = span["origin"]
                            original_size = span["size"]
                            original_color = span["color"]
                            
                            # Layout Preservation Logic: Shrink to Fit
                            # 1. Calculate available width from bbox
                            # bbox: (x0, y0, x1, y1)
                            available_width = bbox[2] - bbox[0]
                            
                            # 2. Measure translated text at original size
                            try:
                                new_width = measure_font.text_length(translated, fontsize=original_size)
                            except:
                                # Fallback if text_length fails (e.g. unknown chars)
                                new_width = available_width
                                
                            # 3. Calculate new font size
                            new_size = original_size
                            if new_width > available_width * 1.05: # Allow 5% overflow tolerance
                                scale_factor = available_width / new_width
                                new_size = original_size * scale_factor
                                # Don't shrink below illegible size (e.g., 4pt)? 
                                # Let's accept it for now, better than overlapping.
                            
                            replacements.append({
                                "bbox": bbox,
                                "origin": origin,
                                "size": new_size,
                                "color": original_color,
                                "text": translated,
                                "original_text": text
                            })
                
                # Apply replacements
                for rep in replacements:
                    # 1. Redact original
                    rect = fitz.Rect(rep["bbox"])
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                    
                    # 2. Insert new text
                    # Convert color int to RGB tuple
                    c = rep["color"]
                    r = ((c >> 16) & 255) / 255.0
                    g = ((c >> 8) & 255) / 255.0
                    b = (c & 255) / 255.0
                    
                    try:
                        page.insert_text(
                            point=(rep["origin"][0], rep["origin"][1]),
                            text=rep["text"],
                            fontsize=rep["size"],
                            color=(r, g, b),
                            fontname=fontname, 
                        )
                    except Exception as e:
                        # Fallback to helv if custom font fails during insert
                        logger.warning(f"Font insertion failed: {e}. Fallback to helv.")
                        page.insert_text(
                            point=rep["origin"],
                            text=rep["text"],
                            fontsize=rep["size"],
                            color=(r, g, b),
                            fontname="helv"
                        )
            
            doc.save(output_path)
            return output_path
            
        except Exception as e:
            logger.error(f"Error translating PDF: {e}")
            raise e
