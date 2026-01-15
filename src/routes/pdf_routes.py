
import os
import json
import zipfile
import io
import subprocess
import logging
from datetime import datetime
from PIL import Image, ImageChops
from flask import Blueprint, request, jsonify, url_for, current_app, Response, stream_with_context
from werkzeug.utils import secure_filename
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from pdf2image import convert_from_path
import pikepdf
from pipeline_executor import PipelineExecutor

logger = logging.getLogger(__name__)

pdf_bp = Blueprint('pdf', __name__)

@pdf_bp.route('/split', methods=['POST'])
def split_pdf():
    filename = request.json.get('filename')
    ranges = request.json.get('ranges') # List of strings "1-3", "5", etc.
    
    if not filename or not ranges:
        return jsonify({'error': 'Filename and ranges required'}), 400
        
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        reader = PdfReader(input_path)
        total_pages = len(reader.pages)
        
        output_files = []
        base_name = os.path.splitext(secure_filename(filename))[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for i, r in enumerate(ranges):
            writer = PdfWriter()
            r = r.strip()
            if '-' in r:
                start, end = map(int, r.split('-'))
            else:
                start = int(r)
                end = int(r)
                
            # validation
            if start < 1 or end > total_pages or start > end:
                continue # Skip invalid
                
            # pypdf is 0-indexed, user is 1-indexed
            for p in range(start - 1, end):
                writer.add_page(reader.pages[p])
                
            out_name = f"{base_name}_part{i+1}_{r}.pdf"
            out_path = os.path.join(current_app.config['OUTPUT_FOLDER'], out_name)
            writer.write(out_path)
            output_files.append(out_name)
            
        if not output_files:
             return jsonify({'error': 'No valid ranges processed'}), 400
             
        # Create ZIP
        zip_filename = f"split_{timestamp}_{base_name}.zip"
        zip_path = os.path.join(current_app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for f in output_files:
                zf.write(os.path.join(current_app.config['OUTPUT_FOLDER'], f), f)
                
        return jsonify({'filename': zip_filename, 'url': url_for('download_file', filename=zip_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/merge', methods=['POST'])
def merge_files():
    data = request.json
    filenames = data.get('filenames', [])
    
    if not filenames or len(filenames) < 2:
        return jsonify({'error': 'At least two files are required for merging.'}), 400
        
    try:
        merger = PdfWriter()
        for filename in filenames:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
            if not os.path.exists(file_path):
                 return jsonify({'error': f'File not found: {filename}'}), 404
            merger.append(file_path)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"merged_{timestamp}.pdf"
        output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
        
        merger.write(output_path)
        merger.close()
        
        return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/compress', methods=['POST'])
def compress_file():
    data = request.json
    filename = data.get('filename')
    quality = data.get('quality', 'ebook')  # Default to ebook

    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    original_size = os.path.getsize(input_path)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"compressed_{quality}_{timestamp}_{secure_filename(filename)}"
    output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
    
    # Quality Presets Mapping
    QUALITY_PRESETS = {
        'screen': '/screen',    # 72 dpi
        'ebook': '/ebook',      # 150 dpi
        'printer': '/printer',  # 300 dpi
        'prepress': '/prepress' # 300 dpi + color
    }
    
    preset = QUALITY_PRESETS.get(quality, '/ebook')

    # GS Command
    cmd = [
        "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", 
        f"-dPDFSETTINGS={preset}",
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        f"-sOutputFile={output_path}",
        input_path
    ]
    
    try:
        subprocess.run(cmd, check=True)
        
        compressed_size = os.path.getsize(output_path)
        reduction_percent = 0
        if original_size > 0:
            reduction_percent = round(((original_size - compressed_size) / original_size) * 100, 1)

        return jsonify({
            'filename': output_filename, 
            'url': url_for('download_file', filename=output_filename),
            'original_size': original_size,
            'compressed_size': compressed_size,
            'reduction_percent': reduction_percent
        })
    except subprocess.CalledProcessError as e:
        return jsonify({'error': 'Compression failed'}), 500


@pdf_bp.route('/pdf-to-jpg', methods=['POST'])
def pdf_to_jpg():
    try:
        filename = request.json.get('filename')
        if not filename:
             return jsonify({'error': 'Filename required'}), 400
             
        input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if not os.path.exists(input_path):
             return jsonify({'error': 'File not found'}), 404
             
        # Convert
        images = convert_from_path(input_path, dpi=150)
        
        base_name = os.path.splitext(secure_filename(filename))[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"images_{timestamp}_{base_name}.zip"
        zip_path = os.path.join(current_app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for i, image in enumerate(images):
                img_name = f"{base_name}_page{i+1}.jpg"
                img_path = os.path.join(current_app.config['OUTPUT_FOLDER'], img_name)
                image.save(img_path, 'JPEG')
                zf.write(img_path, img_name)
                # Cleanup individual image
                os.remove(img_path)
                
        return jsonify({'filename': zip_filename, 'url': url_for('download_file', filename=zip_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/repair', methods=['POST'])
def repair_pdf():
    try:
        filename = request.json.get('filename')
        if not filename:
             return jsonify({'error': 'Filename required'}), 400
             
        input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if not os.path.exists(input_path):
             return jsonify({'error': 'File not found'}), 404
             
        # Repair by reading and rewriting
        try:
            reader = PdfReader(input_path)
            writer = PdfWriter()
            
            # Add all pages to new writer
            for page in reader.pages:
                writer.add_page(page)
                
            base_name = os.path.splitext(secure_filename(filename))[0]
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"repaired_{timestamp}_{base_name}.pdf"
            output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
            
            with open(output_path, "wb") as f:
                writer.write(f)
                
            return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
            
        except Exception as e:
            return jsonify({'error': f"Repair failed: {str(e)}"}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/compare', methods=['POST'])
def compare_pdfs():
    """Visually compares two PDFs."""
    
    filename1 = request.json.get('filename1')  # Current PDF
    filename2 = request.json.get('filename2')  # Comparison PDF
    
    if not filename1 or not filename2:
        return jsonify({'error': 'Both filenames are required'}), 400
    
    path1 = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename1))
    path2 = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename2))
    
    if not os.path.exists(path1):
        return jsonify({'error': f'File not found: {filename1}'}), 404
    if not os.path.exists(path2):
        return jsonify({'error': f'File not found: {filename2}'}), 404
    
    try:
        # Convert PDFs to images
        images1 = convert_from_path(path1, dpi=150)
        images2 = convert_from_path(path2, dpi=150)
        
        # Handle page count differences
        max_pages = max(len(images1), len(images2))
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base1 = os.path.splitext(secure_filename(filename1))[0]
        base2 = os.path.splitext(secure_filename(filename2))[0]
        zip_filename = f"compare_{timestamp}_{base1}_vs_{base2}.zip"
        zip_path = os.path.join(current_app.config['OUTPUT_FOLDER'], zip_filename)
        
        differences_found = []
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for i in range(max_pages):
                # Get images for this page (or create blank if one PDF is shorter)
                if i < len(images1):
                    img1 = images1[i].convert('RGB')
                else:
                    # Create blank image matching img2 size
                    img1 = Image.new('RGB', images2[i].size, (255, 255, 255))
                
                if i < len(images2):
                    img2 = images2[i].convert('RGB')
                else:
                    # Create blank image matching img1 size
                    img2 = Image.new('RGB', images1[i].size, (255, 255, 255))
                
                # Resize to match if dimensions differ
                if img1.size != img2.size:
                    # Resize img2 to match img1
                    img2 = img2.resize(img1.size, Image.Resampling.LANCZOS)
                
                # Calculate difference
                diff = ImageChops.difference(img1, img2)
                
                # Check if there are any differences
                diff_bbox = diff.getbbox()
                has_diff = diff_bbox is not None
                
                if has_diff:
                    differences_found.append(i + 1)
                
                # Create side-by-side comparison
                width = img1.width + img2.width + 20  # 20px gap
                height = max(img1.height, img2.height)
                side_by_side = Image.new('RGB', (width, height), (240, 240, 240))
                side_by_side.paste(img1, (0, 0))
                side_by_side.paste(img2, (img1.width + 20, 0))
                
                # Save side-by-side
                sbs_name = f"page_{i+1}_sidebyside.jpg"
                sbs_buffer = io.BytesIO()
                side_by_side.save(sbs_buffer, 'JPEG', quality=85)
                sbs_buffer.seek(0)
                zf.writestr(sbs_name, sbs_buffer.getvalue())
                
                # Create diff overlay (highlight differences in red)
                if has_diff:
                    # Convert diff to grayscale and threshold
                    diff_gray = diff.convert('L')
                    # Create a red overlay for differences
                    diff_overlay = Image.new('RGBA', img1.size, (0, 0, 0, 0))
                    
                    # Iterate pixels and highlight differences
                    diff_pixels = diff_gray.load()
                    overlay_pixels = diff_overlay.load()
                    
                    for x in range(diff_gray.width):
                        for y in range(diff_gray.height):
                            if diff_pixels[x, y] > 20:  # Threshold for noise
                                overlay_pixels[x, y] = (255, 0, 0, 128)  # Semi-transparent red
                    
                    # Composite overlay on img1
                    img1_rgba = img1.convert('RGBA')
                    diff_result = Image.alpha_composite(img1_rgba, diff_overlay)
                    
                    diff_name = f"page_{i+1}_diff.png"
                    diff_buffer = io.BytesIO()
                    diff_result.save(diff_buffer, 'PNG')
                    diff_buffer.seek(0)
                    zf.writestr(diff_name, diff_buffer.getvalue())
            
            # Create summary JSON
            summary = {
                'pdf1': filename1,
                'pdf2': filename2,
                'pages_pdf1': len(images1),
                'pages_pdf2': len(images2),
                'pages_with_differences': differences_found,
                'total_differences': len(differences_found)
            }

            zf.writestr('summary.json', json.dumps(summary, indent=2))
        
        return jsonify({
            'filename': zip_filename,
            'url': url_for('download_file', filename=zip_filename),
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/api/crop', methods=['POST'])
def crop_pdf():
    data = request.json
    filename = data.get('filename')
    crops = data.get('crops', [])
    
    if not filename or not crops:
        return jsonify({'error': 'Filename and crops required'}), 400
        
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        # Map crop data by page index
        crop_map = {c['pageIndex']: c for c in crops}
        
        for i, page in enumerate(reader.pages):
            writer.add_page(page)
            
            if i in crop_map:
                c = crop_map[i]
                page_height = float(page.mediabox.height)
                
                # Inputs (DOM / Visual Top-Left origin)
                x = float(c['x'])
                y = float(c['y'])
                w = float(c['width'])
                h = float(c['height'])
                
                # Convert to PDF Bottom-Left origin
                llx = x
                lly = page_height - (y + h)
                urx = x + w
                ury = page_height - y
                
                # Apply crop
                current_page = writer.pages[-1]
                current_page.cropbox.lower_left = (llx, lly)
                current_page.cropbox.upper_right = (urx, ury)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"cropped_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(current_app.config['UPLOAD_FOLDER'], output_filename)
        
        with open(output_path, "wb") as f:
            writer.write(f)
            
        return jsonify({
            'filename': output_filename,
            'download_url': url_for('uploaded_file', filename=output_filename)
        })
        
    except Exception as e:
        logger.error(f"Crop failed: {e}")
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/api/apply_redactions', methods=['POST'])
def apply_redactions():
    data = request.json
    filename = data.get('filename')
    redactions = data.get('redactions', [])
    
    if not filename or not redactions:
        return jsonify({'error': 'Filename and redactions required'}), 400
        
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        for i, page in enumerate(reader.pages):
            writer.add_page(page)
            
            page_redactions = [r for r in redactions if r['pageIndex'] == i]
            
            for r in page_redactions:
                page_height = float(page.mediabox.height)
                
                x = float(r['x'])
                y = float(r['y'])
                w = float(r['width'])
                h = float(r['height'])
                
                pdf_y = page_height - y - h
                
                writer_page = writer.pages[i]
                rect = RectangleObject([x, pdf_y, x + w, pdf_y + h])
                
                annotation = {
                    '/Type': '/Annot',
                    '/Subtype': '/Square',
                    '/Rect': rect,
                    '/BS': {'/W': 0},
                    '/IC': [0, 0, 0],
                    '/C': [0, 0, 0],
                    '/F': 4,
                    '/T': 'Redaction'
                }
                
                if '/Annots' not in writer_page:
                    writer_page['/Annots'] = []
                writer_page['/Annots'].append(annotation)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"redacted_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(current_app.config['UPLOAD_FOLDER'], output_filename)
        
        with open(output_path, "wb") as f:
            writer.write(f)
            
        return jsonify({
            'filename': output_filename,
            'download_url': url_for('uploaded_file', filename=output_filename)
        })

    except Exception as e:
        logger.error(f"Redaction failed: {e}")
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/pdf-to-pdfa', methods=['POST'])
def convert_to_pdfa():
    filename = request.json.get('filename')
    level = request.json.get('level', '2b')
    
    logger.info(f"PDF/A conversion requested for {filename} at level {level}")
    
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"pdfa_{level}_{timestamp}_{secure_filename(filename)}"
    output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
    
    gs_level = 2
    if level == '1b': gs_level = 1
    elif level == '2b': gs_level = 2
    elif level == '3b': gs_level = 3
    
    cmd = [
        "gs", 
        f"-dPDFA={gs_level}",
        "-dBATCH", "-dNOPAUSE", 
        "-sColorConversionStrategy=RGB",
        "-sDEVICE=pdfwrite", 
        "-dPDFACompatibilityPolicy=1", 
        f"-sOutputFile={output_path}",
        input_path
    ]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Conversion timed out'}), 504
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        return jsonify({'error': f'PDF/A conversion failed: {error_msg}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@pdf_bp.route('/api/sanitize', methods=['POST'])
def sanitize_pdf():
    filename = request.form.get('filename')
    remove_js = request.form.get('remove_js') == 'true'
    remove_metadata = request.form.get('remove_metadata') == 'true' 
    remove_layers = request.form.get('remove_layers') == 'true'
    remove_embedded = request.form.get('remove_embedded') == 'true'

    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404

    try:
        pdf = pikepdf.Pdf.open(input_path)
        summary = []
        
        if remove_js:
            if '/Names' in pdf.Root:
                names = pdf.Root['/Names']
                if '/JavaScript' in names:
                    del names['/JavaScript']
                    summary.append('Removed document-level JavaScript')
            
            if '/OpenAction' in pdf.Root:
                 del pdf.Root['/OpenAction']
                 summary.append('Removed OpenAction scripts')
            
            count = 0
            for page in pdf.pages:
                if '/AA' in page:
                    del page['/AA']
                    count += 1
                if '/Annots' in page:
                    for annot in page.Annots:
                        if '/A' in annot and '/S' in annot.A and annot.A.S == '/JavaScript':
                             del annot['/A']
                             count += 1
                        if '/AA' in annot:
                             del annot['/AA']
                             count += 1
            if count > 0:
                summary.append(f'Removed {count} JS actions from pages/annotations')

        if remove_metadata:
            keys = list(pdf.docinfo.keys())
            for k in keys:
                del pdf.docinfo[k]
            summary.append('Cleared Document Info dictionary')
            
            if '/Metadata' in pdf.Root:
                del pdf.Root['/Metadata']
                summary.append('Removed XMP Metadata')

        if remove_layers:
            if '/OCProperties' in pdf.Root:
                del pdf.Root['/OCProperties']
                summary.append('Removed Optional Content (Layers)')

        if remove_embedded:
             if '/Names' in pdf.Root:
                names = pdf.Root['/Names']
                if '/EmbeddedFiles' in names:
                  del names['/EmbeddedFiles']
                  summary.append('Removed Embedded Files')
                  
             if '/EmbeddedFiles' in pdf.Root:
                 del pdf.Root['/EmbeddedFiles']
                 summary.append('Removed Root Embedded Files')

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"sanitized_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
        
        pdf.save(output_path)
        pdf.close()
        
        return jsonify({
            'filename': output_filename, 
            'url': url_for('download_file', filename=output_filename),
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Sanitization failed: {e}")
        return jsonify({'error': str(e)}), 500

@pdf_bp.route('/api/flatten', methods=['POST'])
def flatten_pdf():
    filename = request.form.get('filename')
    
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    try:
        pdf = pikepdf.Pdf.open(input_path)
        pdf.flatten_annotations()
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"flattened_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(current_app.config['OUTPUT_FOLDER'], output_filename)
        
        pdf.save(output_path)
        pdf.close()
        
        return jsonify({
            'filename': output_filename,
            'url': url_for('download_file', filename=output_filename)
        })
    except Exception as e:
        logger.error(f"Flatten failed: {e}")
        return jsonify({'error': str(e)}), 500

@pdf_bp.route('/api/pipeline/run', methods=['POST'])
def run_pipeline():
    data = request.json
    filename = data.get('filename')
    steps = data.get('steps', [])
    
    if not filename or not steps:
        return jsonify({'error': 'Filename and steps required'}), 400
        
    def generate():
        executor = PipelineExecutor(current_app.config['UPLOAD_FOLDER'], current_app.config['OUTPUT_FOLDER'])
        for update in executor.execute(filename, steps):
             if update['status'] == 'complete' and 'download_url' in update:
                 update['download_url'] = url_for('download_file', filename=update['download_url'])
                 
             yield f"data: {json.dumps(update)}\n\n"
             
    return Response(stream_with_context(generate()), mimetype='text/event-stream')
