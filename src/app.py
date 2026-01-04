import os
import shutil
import warnings
import io
import threading
import uuid
import json
import subprocess
from pathlib import Path
from datetime import datetime

from flask import Flask, request, render_template, send_from_directory, url_for, redirect, jsonify, stream_with_context, Response
from werkzeug.utils import secure_filename
import zipfile

# Third-party imports
import pdfplumber
import redis
from pypdf import PdfReader, PdfWriter
from pdf2image import convert_from_path
from PIL import Image, ImageChops, ImageDraw
import pikepdf

# App specific imports
from celery_utils import celery_init_app
from tasks import process_pdf_task, run_pdf_extraction, run_ocr_task, process_ocr, translate_pdf_task, run_translation
from translation_utils import translate_text
from ai_utils import get_pdf_chat_instance, LANGCHAIN_AVAILABLE
from logging_config import setup_logging, get_logger
from language_manager import get_available_languages, get_installed_languages, install_language, uninstall_language
from pipeline_executor import PipelineExecutor
from dotenv import load_dotenv
from cloud_routes import cloud_bp

# Initialize logging
setup_logging()
logger = get_logger("app")

# Configuration
load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent # Project root
SRC_DIR = Path(__file__).resolve().parent

UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', str(BASE_DIR / 'uploads'))
OUTPUT_FOLDER = os.environ.get('OUTPUT_FOLDER', str(BASE_DIR / 'outputs'))

app = Flask(__name__, 
            static_folder=str(SRC_DIR / 'static'), 
            template_folder=str(SRC_DIR / 'templates'))

app.register_blueprint(cloud_bp)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB upload limit

# Celery Configuration
app.config.from_mapping(
    CELERY=dict(
        broker_url="redis://localhost:6379/0",
        result_backend="redis://localhost:6379/0",
        task_ignore_result=False,
    ),
)
celery = celery_init_app(app)

# Ensure upload and output directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

def is_valid_file(filename):
    """Validates if a file is a PDF and not a hidden/system file.

    Args:
        filename (str): The name of the file to check.

    Returns:
        bool: True if the file is a valid PDF, False otherwise.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf'} and not (filename.startswith('.') or filename.startswith('~') or filename.endswith('#'))

@app.route('/')
def index():
    uploaded_files = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) if is_valid_file(f)]
    processed_files = [f for f in os.listdir(app.config['OUTPUT_FOLDER']) if is_valid_file(f)]
    return render_template('index.html', uploaded_files=uploaded_files, processed_files=processed_files)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'pdf_file' not in request.files:
        return "No file part", 400
    
    files = request.files.getlist('pdf_file')
    
    if not files or files[0].filename == '':
        return "No selected file", 400

    saved_files = []
    for file in files:
        if file and is_valid_file(file.filename):
            filename = secure_filename(file.filename)
            pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(pdf_path)
            saved_files.append(filename)
    
    # If single file, redirect to editor
    if len(saved_files) == 1:
        return redirect(url_for('editor', filename=saved_files[0]))
    
    # If multiple, redirect back to index
    return redirect(url_for('index'))

@app.route('/create_zip', methods=['POST'])
def create_zip():
    filenames = request.json.get('filenames', [])
    if not filenames:
        return {'error': 'No filenames provided'}, 400



    memory_file = io.BytesIO()

    with zipfile.ZipFile(memory_file, 'w') as zf:
        for fname in filenames:
            file_path = os.path.join(app.config['OUTPUT_FOLDER'], fname)
            if os.path.exists(file_path):
                zf.write(file_path, fname)
    
    memory_file.seek(0)
    return  (
        memory_file,
        200,
        {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="batch_results.zip"'
        }
    )

@app.route('/editor/<filename>')
def editor(filename):
    return render_template('editor.html', filename=filename)


# Helper to check Redis availability
def is_redis_available():
    """Checks if the Redis server is reachable for Celery background tasks.

    Returns:
        bool: True if Redis is available, False otherwise.
    """
    try:
        r = redis.from_url(app.config['CELERY']['broker_url'])
        r.ping()
        return True
    except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
        return False
    except Exception:
        return False

# Mock task for synchronous execution
class MockTask:
    def __init__(self, task_id, result=None, state='SUCCESS', error=None):
        self.id = task_id
        self.result = result
        self._state = state
        self._error = error
    
    @property
    def state(self):
        return self._state
        
    @property
    def info(self):
        if self._state == 'FAILURE':
             return {'status': 'Failed', 'error': self._error}
        if self.result:
             return {'status': 'Completed', 'result_file': self.result.get('result_file'), 'current': 100, 'total': 100}
        return {'status': 'Completed'}

# Global store for sync results (in-memory, cleared on restart)
# In production, use a localized database or file
sync_results = {}
# Global store for active model pulls
pulling_models = set()

@app.route('/process_request', methods=['POST'])
def process_request():
    """Endpoint to initiate document extraction or translation.

    This route handles both asynchronous (Celery) and synchronous 
    (blocking) execution based on Redis availability.

    Form Data:
        filename (str): Source PDF filename.
        extraction_type (str): Output format ('word', 'odt', 'csv').
        target_lang (str): ISO code for translation.
        source_lang (str): Source ISO code.

    Returns:
        JSON: {task_id, mode} and 202 status.
    """
    filename = request.form.get('filename')
    extraction_type = request.form.get('extraction_type')
    target_lang = request.form.get('target_lang')
    source_lang = request.form.get('source_lang', 'en')
    
    # Check if we should use Celery
    if is_redis_available():
        # Trigger Celery task
        task = process_pdf_task.delay(extraction_type, filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], target_lang, source_lang)
        return {'task_id': task.id, 'mode': 'async'}, 202
    else:
        # Run synchronously
        task_id = str(uuid.uuid4())

        
        try:
            # We can't really do progress updates easily in sync mode without websockets
            # so we just block until done.
            result = run_pdf_extraction(
                extraction_type, 
                filename, 
                app.config['UPLOAD_FOLDER'], 
                app.config['OUTPUT_FOLDER'], 
                target_lang, 
                source_lang
            )
            
            if result.get('status') == 'Failed':
                sync_results[task_id] = MockTask(task_id, state='FAILURE', error=result.get('error'))
            else:
                sync_results[task_id] = MockTask(task_id, result=result, state='SUCCESS')
                
        except Exception as e:
            sync_results[task_id] = MockTask(task_id, state='FAILURE', error=str(e))
            
        return {'task_id': task_id, 'mode': 'sync'}, 202

@app.route('/api/ocr_pdf', methods=['POST'])
def ocr_pdf():
    """Endpoint to run OCR on a PDF."""
    filename = request.form.get('filename')
    language = request.form.get('language', 'eng')
    
    if not filename:
        return {'error': 'Filename required'}, 400

    if is_redis_available():
        task = run_ocr_task.delay(filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], language)
        return {'task_id': task.id, 'mode': 'async'}, 202
    else:
        # Sync run
        task_id = str(uuid.uuid4())
        try:
             result = process_ocr(filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], language)
             if result.get('status') == 'Failed':
                 sync_results[task_id] = MockTask(task_id, state='FAILURE', error=result.get('error'))
             else:
                 sync_results[task_id] = MockTask(task_id, result=result, state='SUCCESS')
        except Exception as e:
             sync_results[task_id] = MockTask(task_id, state='FAILURE', error=str(e))
             
        return {'task_id': task_id, 'mode': 'sync'}, 202

@app.route('/status/<task_id>')
def task_status(task_id):
    # Check if it's a sync task
    if task_id in sync_results:
        task = sync_results[task_id]
    else:
        # Assume Celery task
        task = process_pdf_task.AsyncResult(task_id)
        
    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Pending...'
        }
    elif task.state != 'FAILURE':
        response = {
            'state': task.state,
            'status': task.info.get('status', '') if isinstance(task.info, dict) else '',
            'current': task.info.get('current', 0) if isinstance(task.info, dict) else 0,
            'total': task.info.get('total', 100) if isinstance(task.info, dict) else 100,
        }
        if task.state == 'SUCCESS':
             response['result_file'] = task.info.get('result_file')
    else:
        response = {
            'state': task.state,
            'status': str(task.info),
        }
    return response

@app.route('/results_view/<filename>')
def show_results(filename):
    return render_template('results.html', files=[filename])

@app.route('/outputs/<filename>')
def download_file(filename):
    if secure_filename(filename) != filename:
         return "Invalid filename", 400
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename, as_attachment=True)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    if secure_filename(filename) != filename:
         return "Invalid filename", 400
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/save_pdf', methods=['POST'])
def save_pdf():
    if 'pdf_file' not in request.files:
        return "No file part", 400
    file = request.files['pdf_file']
    if file.filename == '':
        return "No selected file", 400
    
    if file:
        filename = secure_filename(file.filename)
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(pdf_path)
        return "Saved", 200

@app.route('/extract_text_region', methods=['POST'])
def extract_text_region():
    """Extracts text from a coordinate-bounded region of a PDF page.

    Form Data:
        filename (str): PDF name.
        page_index (int): 0-indexed page number.
        x, y, w, h (float): Region coordinates in DOM units.
        page_width, page_height (float): DOM dimensions of the page.

    Returns:
        JSON: {text: str} or error message.
    """
    filename = request.form.get('filename')
    
    # Input validation
    try:
        page_index = int(request.form.get('page_index', 0))
        x = float(request.form.get('x', 0))
        y = float(request.form.get('y', 0))
        w = float(request.form.get('w', 0))
        h = float(request.form.get('h', 0))
        page_width_dom = float(request.form.get('page_width', 0))
        page_height_dom = float(request.form.get('page_height', 0))
    except (ValueError, TypeError) as e:
         return {'error': f'Invalid parameters: {str(e)}'}, 400
    
    if not filename:
         return {'error': 'Filename required'}, 400
         
    filename = secure_filename(filename)
         
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_index]
            
            # Coordinate conversion
            # DOM (0,0) is top-left. PDF (0,0) is usually bottom-left, but pdfplumber uses top-left for bbox usually?
            # pdfplumber bbox: (x0, top, x1, bottom)
            
            # Scale factors
            scale_x = page.width / page_width_dom
            scale_y = page.height / page_height_dom
            
            # Calculate PDF coordinates
            pdf_x = x * scale_x
            pdf_y = y * scale_y
            pdf_w = w * scale_x
            pdf_h = h * scale_y
            
            # BBox for pdfplumber: (x0, top, x1, bottom)
            bbox = (pdf_x, pdf_y, pdf_x + pdf_w, pdf_y + pdf_h)
            
            cropped_page = page.crop(bbox)
            text = cropped_page.extract_text()
            
            return {'text': text}
    except Exception as e:
        return {'error': str(e)}, 500


@app.route('/translate_content', methods=['POST'])
def translate_content():
    
    text = request.form.get('text')
    source_lang = request.form.get('source_lang')
    target_lang = request.form.get('target_lang')
    
    if not text:
        return {'error': 'No text provided'}, 400
        
    try:
        translated = translate_text(text, target_lang, source_lang)
        return {'text': translated}
    except Exception as e:
        return {'error': str(e)}, 500


@app.route('/api/translate-document', methods=['POST'])
def translate_document():
    filename = request.form.get('filename')
    source_lang = request.form.get('source_lang', 'en')
    target_lang = request.form.get('target_lang')
    
    if not filename or not target_lang:
        return {'error': 'Filename and target_lang required'}, 400
        
    if is_redis_available():
        task = translate_pdf_task.delay(filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], source_lang, target_lang)
        return {'task_id': task.id, 'mode': 'async'}, 202
    else:
        # Sync
        task_id = str(uuid.uuid4())
        try:
             result = run_translation(filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], source_lang, target_lang)
             if result.get('status') == 'Failed':
                 sync_results[task_id] = MockTask(task_id, state='FAILURE', error=result.get('error'))
             else:
                 sync_results[task_id] = MockTask(task_id, result=result, state='SUCCESS')
        except Exception as e:
             sync_results[task_id] = MockTask(task_id, state='FAILURE', error=str(e))
             
        return {'task_id': task_id, 'mode': 'sync'}, 202



@app.route('/merge', methods=['POST'])
def merge_files():
    data = request.json
    filenames = data.get('filenames', [])
    
    if not filenames or len(filenames) < 2:
        return jsonify({'error': 'At least two files are required for merging.'}), 400
        
    try:
        merger = PdfWriter()
        for filename in filenames:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
            if not os.path.exists(file_path):
                 return jsonify({'error': f'File not found: {filename}'}), 404
            merger.append(file_path)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"merged_{timestamp}.pdf"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        merger.write(output_path)
        merger.close()
        
        return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/compress', methods=['POST'])
def compress_file():
    filename = request.json.get('filename')
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"compressed_{timestamp}_{secure_filename(filename)}"
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
    
    # GS Command
    # /ebook = 150 dpi
    cmd = [
        "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook",
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        f"-sOutputFile={output_path}",
        input_path
    ]
    
    try:
        subprocess.run(cmd, check=True)
        return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
    except subprocess.CalledProcessError as e:
        return jsonify({'error': 'Compression failed'}), 500



@app.route('/split', methods=['POST'])
def split_pdf():
    filename = request.json.get('filename')
    ranges = request.json.get('ranges') # List of strings "1-3", "5", etc.
    
    if not filename or not ranges:
        return jsonify({'error': 'Filename and ranges required'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        reader = PdfReader(input_path)
        total_pages = len(reader.pages)
        
        # Prepare valid ranges
        # Valid input: "1-3, 5, 7-10" -> handled by frontend as array ["1-3", "5", "7-10"]?
        # Or simple array of strings. Let's assume array of strings.
        
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
            out_path = os.path.join(app.config['OUTPUT_FOLDER'], out_name)
            writer.write(out_path)
            output_files.append(out_name)
            
        if not output_files:
             return jsonify({'error': 'No valid ranges processed'}), 400
             
        # Create ZIP
        zip_filename = f"split_{timestamp}_{base_name}.zip"
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for f in output_files:
                zf.write(os.path.join(app.config['OUTPUT_FOLDER'], f), f)
                
        return jsonify({'filename': zip_filename, 'url': url_for('download_file', filename=zip_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/pdf-to-jpg', methods=['POST'])
def pdf_to_jpg():
    try:
        filename = request.json.get('filename')
        if not filename:
             return jsonify({'error': 'Filename required'}), 400
             
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if not os.path.exists(input_path):
             return jsonify({'error': 'File not found'}), 404
             
        # Convert
        # poppler path is typically system default
        images = convert_from_path(input_path, dpi=150)
        
        base_name = os.path.splitext(secure_filename(filename))[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"images_{timestamp}_{base_name}.zip"
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for i, image in enumerate(images):
                img_name = f"{base_name}_page{i+1}.jpg"
                img_path = os.path.join(app.config['OUTPUT_FOLDER'], img_name)
                image.save(img_path, 'JPEG')
                zf.write(img_path, img_name)
                # Cleanup individual image
                os.remove(img_path)
                
        return jsonify({'filename': zip_filename, 'url': url_for('download_file', filename=zip_filename)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/repair', methods=['POST'])
def repair_pdf():
    try:
        filename = request.json.get('filename')
        if not filename:
             return jsonify({'error': 'Filename required'}), 400
             
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
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
            output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
            
            with open(output_path, "wb") as f:
                writer.write(f)
                
            return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
            
        except Exception as e:
            return jsonify({'error': f"Repair failed: {str(e)}"}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/compare', methods=['POST'])
def compare_pdfs():
    """Visually compares two PDFs and generates a ZIP of differences.

    Request Body (JSON):
        filename1 (str): Primary (active) PDF.
        filename2 (str): Secondary PDF to compare against.

    Returns:
        JSON: {filename, url, summary} containing ZIP path and diff stats.
    """
    
    filename1 = request.json.get('filename1')  # Current PDF
    filename2 = request.json.get('filename2')  # Comparison PDF (already uploaded)
    
    if not filename1 or not filename2:
        return jsonify({'error': 'Both filenames are required'}), 400
    
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename1))
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename2))
    
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
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], zip_filename)
        
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
                    
                    # Performance op: Only iterate bbox? 
                    # For now keep naive
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


@app.route('/api/apply_redactions', methods=['POST'])
def apply_redactions():
    """Apply redactions to a PDF.
    
    This function draws black rectangles over the specified areas.
    """
    data = request.json
    filename = data.get('filename')
    redactions = data.get('redactions', [])
    
    if not filename or not redactions:
        return jsonify({'error': 'Filename and redactions required'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        from pypdf.generic import RectangleObject
        from pypdf.annotations import FreeText
        
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        # Copy pages and apply redactions
        for i, page in enumerate(reader.pages):
            writer.add_page(page)
            
            # Get redactions for this page
            page_redactions = [r for r in redactions if r['pageIndex'] == i]
            
            for r in page_redactions:
                # Convert coordinates
                # Logic similar to extract_text_region but reverse (Frontend to Backend)
                # Frontend uses same scale as extract?
                # Usually Frontend (PDF.js) renders at user scale. 
                # But our redaction.js sends: x, y, w, h in DOM pixels (divided by scale).
                # So these are PDF point coordinates (roughly 72 DPI base).
                # NOTE: PDF.js usually assumes 72 DPI = 1 scale.
                # However, pypdf coordinates are also points.
                # Only check coordinate system Y-axis.
                # PDF origin is bottom-left. DOM is top-left.
                
                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)
                
                # Inputs from redaction.js: x, y, width, height (PDF Point units, from top-left)
                x = float(r['x'])
                y = float(r['y'])
                w = float(r['width'])
                h = float(r['height'])
                
                # Convert Y to bottom-up
                # pdf_y = page_height - y - height
                pdf_y = page_height - y - h
                
                # Add Redaction Annotation (Black Rectangle)
                # Accessing the page object on the writer side
                writer_page = writer.pages[i]
                
                # Draw a black rectangle using annotation
                # Annotation dictionary
                rect = RectangleObject([x, pdf_y, x + w, pdf_y + h])
                
                # Create a Square annotation with black fill
                annotation = {
                    '/Type': '/Annot',
                    '/Subtype': '/Square',
                    '/Rect': rect,
                    '/BS': {'/W': 0}, # Border width 0
                    '/IC': [0, 0, 0], # Inner Color (Black)
                    '/C': [0, 0, 0],  # Border Color (Black)
                    '/F': 4,          # Flags (Print, NoZoom, NoRotate)
                    '/T': 'Redaction' # Title
                }
                
                # Add to page
                if '/Annots' not in writer_page:
                    writer_page['/Annots'] = []
                writer_page['/Annots'].append(annotation)

        # Write output
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"redacted_{timestamp}_{secure_filename(filename)}"
        # We save to upload folder so it can be loaded by editor again as "current file"
        # Or output folder. Editor usually loads from upload folder.
        # Let's save to UPLOAD_FOLDER to mimic "saving" the file.
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        with open(output_path, "wb") as f:
            writer.write(f)
            
        return jsonify({
            'filename': output_filename,
            'download_url': url_for('uploaded_file', filename=output_filename) # Reuse upload route
        })

    except Exception as e:
        logger.error(f"Redaction failed: {e}")
        return jsonify({'error': str(e)}), 500


# --- AI Chat Routes ---


@app.route('/ai/status')
def ai_status():
    """Check if local AI is available."""
    try:
        from ai_utils import get_pdf_chat_instance, LANGCHAIN_AVAILABLE
        
        if not LANGCHAIN_AVAILABLE:
             return jsonify({
                'available': False,
                'error': 'AI dependencies not installed. Please install requirements.'
            })
            
        chat = get_pdf_chat_instance()
        ollama_ok = chat.check_ollama_available()
        models = chat.check_models_installed()
        return jsonify({
            'available': ollama_ok,
            'ollama_running': ollama_ok,
            'models': models,
            'langchain_installed': True
        })
    except ImportError:
         return jsonify({
            'available': False,
            'error': 'AI module import failed.'
        })
    except Exception as e:
        return jsonify({
            'available': False,
            'error': str(e)
        })

@app.route('/ai/index', methods=['POST'])
def ai_index_pdf():
    """Index a PDF for AI chat."""
    filename = request.json.get('filename')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'File not found'}), 404
    

    try:
        # from ai_utils import get_pdf_chat_instance # Moved to top/local
        from ai_utils import get_pdf_chat_instance
        chat = get_pdf_chat_instance()
        
        if not chat.check_ollama_available():
            return jsonify({'error': 'Ollama is not running. Please start Ollama first.'}), 503
        
        num_chunks = chat.index_pdf(pdf_path)
        return jsonify({
            'success': True,
            'chunks_indexed': num_chunks,
            'message': f'PDF indexed successfully with {num_chunks} chunks'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ai/ask', methods=['POST'])
def ai_ask():
    """Ask a question about the indexed PDF."""
    question = request.json.get('question')
    model = request.json.get('model')
    
    if not question:
        return jsonify({'error': 'Question required'}), 400
    

    try:
        from ai_utils import get_pdf_chat_instance
        chat = get_pdf_chat_instance()
        
        # Switch model if requested and different
        if model and model != chat.llm_model:
            chat.update_llm(model)
            
        result = chat.ask(question)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ai/pull', methods=['POST'])
def ai_pull():
    """Pull a new model from Ollama."""
    model = request.json.get('model')
    if not model:
        return jsonify({'error': 'Model name required'}), 400
        
    if model in pulling_models:
        return jsonify({'error': f'Model {model} is already being pulled.'}), 409
        
    def pull_background(model_name):
        try:
            logger.info(f"Starting pull for {model_name}...")
            # Use requests to talk to Ollama directly
            import requests
            # stream=False waits until done
            requests.post('http://localhost:11434/api/pull', json={'name': model_name, 'stream': False})
            logger.info(f"Finished pull for {model_name}")
        except Exception as e:
            logger.error(f"Error pulling {model_name}: {e}")
        finally:
            pulling_models.discard(model_name)

    # Start in background thread
    pulling_models.add(model)
    thread = threading.Thread(target=pull_background, args=(model,))
    thread.start()
    
    return jsonify({'status': 'started', 'message': f'Pulling {model} in background'})


# --- Bug Reporting Routes ---

@app.route('/api/system-info')
def get_system_info():
    """Returns safe system information for bug reports."""
    import sys
    import platform
    
    info = {
        'os': platform.platform(),
        'python_version': sys.version.split(' ')[0],
        'app_dir': os.getcwd(),
        'redis_available': is_redis_available(),
        'langchain_available': LANGCHAIN_AVAILABLE
    }
    return jsonify(info)

@app.route('/api/generate-report', methods=['POST'])
def generate_bug_report():
    """Generates a ZIP file containing logs and user description."""
    description = request.json.get('description', 'No description provided.')
    include_logs = request.json.get('include_logs', True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_filename = f"bug_report_{timestamp}.zip"
    report_path = os.path.join(app.config['OUTPUT_FOLDER'], report_filename)
    
    try:
        with zipfile.ZipFile(report_path, 'w') as zf:
            # 1. Add user description
            zf.writestr('description.txt', description)
            
            # 2. Add System Info
            import sys
            import platform
            sys_info = (
                f"OS: {platform.platform()}\n"
                f"Python: {sys.version}\n"
                f"Working Dir: {os.getcwd()}\n"
                f"Redis Available: {is_redis_available()}\n"
                f"LangChain Available: {LANGCHAIN_AVAILABLE}\n"
            )
            zf.writestr('system_info.txt', sys_info)
            
            # 3. Add Logs (if requested)
            if include_logs:
                log_path = os.path.join('logs', 'app.log')
                if os.path.exists(log_path):
                    zf.write(log_path, 'app.log')
                else:
                    zf.writestr('app.log', 'Log file not found.')
                    
        return jsonify({
            'filename': report_filename,
            'url': url_for('download_file', filename=report_filename)
        })
        
    except Exception as e:
        logger.error(f"Failed to generate bug report: {e}")
        return jsonify({'error': str(e)}), 500



# --- Language Management Routes ---

@app.route('/languages', methods=['GET'])
def list_languages():
    """Returns list of available and installed languages."""
    try:
        available = get_available_languages()
        installed = get_installed_languages()
        
        # Mark installed status in available list
        # Create a set of installed pairs for easy lookup
        installed_set = {(p['from_code'], p['to_code']) for p in installed}
        
        for lang in available:
            lang['installed'] = (lang['from_code'], lang['to_code']) in installed_set
            
        return jsonify({
            'languages': available,
            'installed_count': len(installed)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/languages/install', methods=['POST'])
def install_lang_package():
    """Installs a specific language package."""
    data = request.json
    from_code = data.get('from_code')
    to_code = data.get('to_code')
    
    if not from_code or not to_code:
        return jsonify({'error': 'Source and target language codes required'}), 400
        
    try:
        success, message = install_language(from_code, to_code)
        if success:
            return jsonify({'message': message})
        else:
            return jsonify({'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/languages/uninstall', methods=['POST'])
def uninstall_lang_package():
    """Uninstalls a specific language package."""
    data = request.json
    from_code = data.get('from_code')
    to_code = data.get('to_code')
    
    if not from_code or not to_code:
        return jsonify({'error': 'Source and target language codes required'}), 400
        
    try:
        success, message = uninstall_language(from_code, to_code)
        if success:
            return jsonify({'message': message})
        else:
            return jsonify({'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/pdf-to-pdfa', methods=['POST'])
def convert_to_pdfa():
    filename = request.json.get('filename')
    level = request.json.get('level', '2b') # 1b, 2b, 3b
    
    logger.info(f"PDF/A conversion requested for {filename} at level {level}")
    
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         logger.error(f"File not found: {input_path}")
         return jsonify({'error': 'File not found'}), 404
         
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"pdfa_{level}_{timestamp}_{secure_filename(filename)}"
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
    
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
    
    logger.info(f"Running command: {' '.join(cmd)}")
    
    try:
        # Add timeout to prevent hanging
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        logger.info(f"Conversion successful: {output_filename}")
        return jsonify({'filename': output_filename, 'url': url_for('download_file', filename=output_filename)})
    except subprocess.TimeoutExpired:
        logger.error("Ghostscript timed out")
        return jsonify({'error': 'Conversion timed out'}), 504
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        logger.error(f"Ghostscript failed: {error_msg}")
        return jsonify({'error': f'PDF/A conversion failed: {error_msg}'}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/api/crop', methods=['POST'])
def crop_pdf():
    """Crops pages of a PDF based on provided coordinates.
    
    Request Body:
        filename (str): Name of the file in upload folder.
        crops (list): List of dicts {pageIndex, x, y, width, height} (DOM units).
        
    Returns:
        JSON: New filename and download URL.
    """
    data = request.json
    filename = data.get('filename')
    crops = data.get('crops', [])
    
    if not filename or not crops:
        return jsonify({'error': 'Filename and crops required'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
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
                
                # Get page dimensions
                # Note: We rely on page.mediabox for height
                # If rotation is present, pypdf handles coordinates relative to unrotated page usually?
                # PDF.js renders visually. If user selects a region on a rotated page, 
                # PDF.js gives coordinates relative to the visual view.
                # This needs careful testing with rotated pages.
                
                page_height = float(page.mediabox.height)
                
                # Inputs (DOM / Visual Top-Left origin)
                x = float(c['x'])
                y = float(c['y'])
                w = float(c['width'])
                h = float(c['height'])
                
                # Convert to PDF Bottom-Left origin
                # PDF Rect: (x_ll, y_ll, x_ur, y_ur)
                
                # Lower Left X = x
                # Lower Left Y = height - (y + h)
                # Upper Right X = x + w
                # Upper Right Y = height - y
                
                llx = x
                lly = page_height - (y + h)
                urx = x + w
                ury = page_height - y
                
                # Apply crop
                # accessing the page we just added (last one)
                current_page = writer.pages[-1]
                current_page.cropbox.lower_left = (llx, lly)
                current_page.cropbox.upper_right = (urx, ury)
                
                # Also update mediabox to match? Not strictly necessary for display, 
                # but good for printing/cleanliness.
                # current_page.mediabox.lower_left = (llx, lly)
                # current_page.mediabox.upper_right = (urx, ury)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"cropped_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        with open(output_path, "wb") as f:
            writer.write(f)
            
        return jsonify({
            'filename': output_filename,
            'download_url': url_for('uploaded_file', filename=output_filename)
        })
        
    except Exception as e:
        logger.error(f"Crop failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sanitize', methods=['POST'])
def sanitize_pdf():
    filename = request.form.get('filename')
    # Default to string 'true' check
    remove_js = request.form.get('remove_js') == 'true'
    remove_metadata = request.form.get('remove_metadata') == 'true' 
    remove_layers = request.form.get('remove_layers') == 'true'
    remove_embedded = request.form.get('remove_embedded') == 'true'

    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404

    try:
        pdf = pikepdf.Pdf.open(input_path)
        summary = []
        
        # 1. Remove JavaScript
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

        # 2. Remove Metadata
        if remove_metadata:
            # Clear /Info
            keys = list(pdf.docinfo.keys())
            for k in keys:
                del pdf.docinfo[k]
            summary.append('Cleared Document Info dictionary')
            
            if '/Metadata' in pdf.Root:
                del pdf.Root['/Metadata']
                summary.append('Removed XMP Metadata')

        # 3. Remove Hidden Layers (OCG)
        if remove_layers:
            if '/OCProperties' in pdf.Root:
                del pdf.Root['/OCProperties']
                summary.append('Removed Optional Content (Layers)')

        # 4. Remove Embedded Files
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
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
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


@app.route('/api/flatten', methods=['POST'])
def flatten_pdf():
    filename = request.form.get('filename')
    
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    try:
        pdf = pikepdf.Pdf.open(input_path)
        
        # Flatten all annotations
        pdf.flatten_annotations()
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"flattened_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        pdf.save(output_path)
        pdf.close()
        
        return jsonify({
            'filename': output_filename,
            'url': url_for('download_file', filename=output_filename)
        })
    except Exception as e:
        logger.error(f"Flatten failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/pipeline/run', methods=['POST'])
def run_pipeline():
    data = request.json
    filename = data.get('filename')
    steps = data.get('steps', [])
    
    if not filename or not steps:
        return jsonify({'error': 'Filename and steps required'}), 400
        
    def generate():
        executor = PipelineExecutor(app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'])
        for update in executor.execute(filename, steps):
             if update['status'] == 'complete' and 'download_url' in update:
                 # Update download_url to be a full URL/path
                 update['download_url'] = url_for('download_file', filename=update['download_url'])
                 
             yield f"data: {json.dumps(update)}\n\n"
             
    return Response(stream_with_context(generate()), mimetype='text/event-stream')


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode)
