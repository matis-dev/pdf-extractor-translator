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
from database import init_db, get_document_state, update_document_state

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

from routes.ai_routes import ai_bp
app.register_blueprint(ai_bp)

from routes.pdf_routes import pdf_bp
app.register_blueprint(pdf_bp)

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

# Initialize Database
with app.app_context():
    init_db()

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

@app.route('/api/state/<filename>', methods=['GET'])
def get_state(filename):
    state = get_document_state(filename)
    if state:
        return jsonify(state)
    return jsonify({'current_page': 1, 'zoom_level': 1.0})

@app.route('/api/state/<filename>', methods=['POST'])
def save_state(filename):
    data = request.json
    page = data.get('current_page', 1)
    zoom = data.get('zoom_level', 1.0)
    update_document_state(filename, page, zoom)
    return jsonify({'status': 'saved'})


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
        # If Redis is not available, we cannot check for Celery tasks.
        # This implies a lost sync task (e.g., server restart cleared memory).
        if not is_redis_available():
            return jsonify({
                'state': 'FAILURE', 
                'status': 'Task not found. The server likely restarted.'
            }), 404

        # Assume Celery task
        task = process_pdf_task.AsyncResult(task_id)
        
    try:
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
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error checking task status: {e}")
        return jsonify({
            'state': 'FAILURE',
            'status': 'An error occurred while checking task status.'
        }), 500

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



if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode)
