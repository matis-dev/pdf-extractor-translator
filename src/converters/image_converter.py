import os
from pdf2image import convert_from_path
from PIL import Image

def pdf_to_images(pdf_path: str, output_dir: str, target_format='png', options=None):
    """
    Converts a PDF to images (PNG, WEBP, TIFF).
    
    Args:
        pdf_path: Path to source PDF
        output_dir: Directory to save output images
        target_format: 'png', 'webp', or 'tiff'
        options: Dict containing 'dpi', 'quality', 'multipage'
    
    Returns:
        List of generated filenames
    """
    options = options or {}
    dpi = int(options.get('dpi', 150))
    quality = int(options.get('quality', 85))
    is_multipage = bool(options.get('multipage', False))
    
    # Convert PDF to PIL Images
    images = convert_from_path(pdf_path, dpi=dpi)
    generated_files = []
    
    base_name = "page"
    
    if target_format == 'tiff' and is_multipage:
        # Multi-page TIFF
        output_filename = "document.tiff"
        output_path = os.path.join(output_dir, output_filename)
        
        if images:
            images[0].save(
                output_path, 
                save_all=True, 
                append_images=images[1:], 
                compression="tiff_deflate"
            )
            generated_files.append(output_filename)
            
    else:
        # Single page images (PNG, WEBP, or single-page TIFF)
        for i, img in enumerate(images):
            ext = target_format
            filename = f"{base_name}_{i+1}.{ext}"
            output_path = os.path.join(output_dir, filename)
            
            save_kwargs = {}
            format_name = target_format.upper()
            
            if target_format == 'webp':
                save_kwargs['quality'] = quality
            
            # PIL expects 'JPEG' not 'JPG'
            if format_name == 'JPG':
                format_name = 'JPEG'
                
            img.save(output_path, format_name, **save_kwargs)
            generated_files.append(filename)
            
    return generated_files
