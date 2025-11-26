import os
import shutil
import warnings
from pathlib import Path
from flask import Flask, request, render_template, send_from_directory, url_for
from werkzeug.utils import secure_filename

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
    file = request.files['pdf_file']
    if file.filename == '':
        return "No selected file", 400

    if file:
        filename = secure_filename(file.filename)
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(pdf_path)

        # Redirect to the editor page instead of processing immediately
        return url_for('editor', filename=filename)

@app.route('/editor/<filename>')
def editor(filename):
    return render_template('editor.html', filename=filename)

@app.route('/process_request', methods=['POST'])
def process_request():
    filename = request.form.get('filename')
    extraction_type = request.form.get('extraction_type')
    target_lang = request.form.get('target_lang')
    source_lang = request.form.get('source_lang', 'en')
    
    # Trigger Celery task
    task = process_pdf_task.delay(extraction_type, filename, app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'], target_lang, source_lang)
    
    return {'task_id': task.id}, 202

@app.route('/status/<task_id>')
def task_status(task_id):
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

if __name__ == '__main__':
    app.run(debug=True)
