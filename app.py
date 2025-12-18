import os
import shutil
import warnings
from pathlib import Path
from flask import Flask, request, render_template, send_from_directory, url_for, redirect, jsonify
from werkzeug.utils import secure_filename
import zipfile
from datetime import datetime

# Suppress specific Pydantic warnings from Docling
warnings.filterwarnings("ignore", message="Field .* has conflict with protected namespace 'model_'")

# Import the refactored extraction functions
# from extract_full_document_to_word import extract_full_document_to_word
# from extract_tables_to_csv import extract_tables as extract_tables_to_csv
from celery_utils import celery_init_app
from tasks import process_pdf_task

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload size

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
    return not (filename.startswith('.') or filename.startswith('~') or filename.endswith('#'))

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

    import zipfile
    import io

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

# ... (imports)
from tasks import process_pdf_task, run_pdf_extraction
import redis

# ... (app config)

# Helper to check Redis availability
def is_redis_available():
    try:
        r = redis.from_url(app.config['CELERY']['broker_url'])
        r.ping()
        return True
    except:
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

@app.route('/process_request', methods=['POST'])
def process_request():
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
        import uuid
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
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename, as_attachment=True)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
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
    import pdfplumber
    
    filename = request.form.get('filename')
    page_index = int(request.form.get('page_index'))
    x = float(request.form.get('x'))
    y = float(request.form.get('y'))
    w = float(request.form.get('w'))
    h = float(request.form.get('h'))
    page_width_dom = float(request.form.get('page_width'))
    page_height_dom = float(request.form.get('page_height'))
    
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
    from translation_utils import translate_text
    
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


@app.route('/merge', methods=['POST'])
def merge_files():
    from pypdf import PdfWriter
    from datetime import datetime
    from flask import jsonify
    
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
    import subprocess
    from datetime import datetime
    from flask import jsonify
    
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
    import zipfile
    import os
    from io import BytesIO
    from pypdf import PdfReader, PdfWriter
    from datetime import datetime
    from flask import request, jsonify, url_for
    from werkzeug.utils import secure_filename
    
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
        from pdf2image import convert_from_path
        
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
        from pypdf import PdfReader, PdfWriter
        
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
    """Compare two PDF files visually and highlight differences."""
    from pdf2image import convert_from_path
    from PIL import Image, ImageChops, ImageDraw
    import io
    
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
            import json
            zf.writestr('summary.json', json.dumps(summary, indent=2))
        
        return jsonify({
            'filename': zip_filename,
            'url': url_for('download_file', filename=zip_filename),
            'summary': summary
        })
        
    except Exception as e:
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
        
    def pull_background(model_name):
        try:
            print(f"Starting pull for {model_name}...")
            # Use requests to talk to Ollama directly
            import requests
            # stream=False waits until done (which might timeout Nginx/Flask).
            # We just want to trigger it.
            # But the user needs to know when it's done.
            # For this MVP, we will rely on checking /ai/status later.
            requests.post('http://localhost:11434/api/pull', json={'name': model_name, 'stream': False})
            print(f"Finished pull for {model_name}")
        except Exception as e:
            print(f"Error pulling {model_name}: {e}")

    # Start in background thread
    import threading
    thread = threading.Thread(target=pull_background, args=(model,))
    thread.start()
    
    return jsonify({'success': True, 'message': f"Started downloading {model}. Check status in a few minutes."})

if __name__ == '__main__':
    app.run(debug=True)
