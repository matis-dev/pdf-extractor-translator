import os
import uuid
import logging
import shutil
import subprocess
from pathlib import Path
from flask import current_app
from tasks import process_pdf_task, run_pdf_extraction
from extract_full_document_to_word import extract_full_document_to_word
from extract_tables_to_csv import extract_tables as extract_tables_to_csv
from extract_tables_to_csv import extract_tables as extract_tables_to_csv
import pdf2image
from converters import pdf_to_images, pdf_to_txt

logger = logging.getLogger(__name__)

class ConversionService:
    """
    Service to handle document conversion logic.
    Prioritizes type safety and atomic operations.
    """

    ALLOWED_FORMATS = {'docx', 'odt', 'jpg', 'pdfa', 'csv', 'png', 'webp', 'tiff', 'txt'}

    @staticmethod
    def validate_request(filename: str, target_format: str) -> str:
        """
        Validates the conversion request.
        Returns None if valid, otherwise an error message.
        """
        if target_format not in ConversionService.ALLOWED_FORMATS:
            return f"Invalid format '{target_format}'. Allowed: {', '.join(ConversionService.ALLOWED_FORMATS)}"
        
        upload_folder = current_app.config['UPLOAD_FOLDER']
        if not os.path.exists(os.path.join(upload_folder, filename)):
            return f"File '{filename}' not found."
            
        return None

    @staticmethod
    def handle_output_files(generated_files: list, output_folder: str, base_name: str) -> str:
        """
        Helper to package output files.
        If single file -> return filename
        If multiple files -> zip and return zip filename
        """
        if not generated_files:
            raise Exception("No file generated")
            
        if len(generated_files) == 1:
            # Move file to output_folder if not already there (converters write to temp or output?)
            # Converters in my impl write directly to output_dir (which is passed as temp_dir or output_folder).
            # If we let converters write to a temp subdir, we should move them.
            # Let's assume converters wrote to 'output_folder/temp_sub_dir' or similar?
            # My converters take 'output_dir'.
            # If I pass the final output_folder to converters, they write there.
            # But 'page_1.png', 'page_2.png' clutter output folder.
            # Better to write to a temp dir first.
            return generated_files[0]
            
        # Zip multiple
        # generated_files are filenames inside the specific directory they were written to.
        # We need to know where they are.
        # Let's assume the caller manages the directory context.
        return "batch.zip" # Placeholder, logic moved to process_conversion


    @staticmethod
    def convert_to_pdfa(pdf_path: str, output_folder: str) -> str:
        """
        Converts PDF to PDF/A using Ghostscript.
        """
        base_name = Path(pdf_path).stem
        output_filename = f"{base_name}_pdfa.pdf"
        output_path = os.path.join(output_folder, output_filename)

        # Ghostscript command for PDF/A
        # This is a standard command, assuming gs is installed.
        cmd = [
            "gs",
            "-dPDFA",
            "-dBATCH",
            "-dNOPAUSE",
            "-sColorConversionStrategy=UseDeviceIndependentColor",
            "-sProcessColorModel=DeviceCMYK",
            "-sDEVICE=pdfwrite",
            "-dPDFACompatibilityPolicy=1",
            f"-sOutputFile={output_path}",
            pdf_path
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return output_filename

    @staticmethod
    def process_conversion(filename: str, target_format: str, is_async: bool = False, options: dict = None):
        """
        Orchestrates the conversion.
        """
        upload_folder = current_app.config['UPLOAD_FOLDER']
        output_folder = current_app.config['OUTPUT_FOLDER']

        if is_async:
            # Re-use existing Celery task structure where possible or dispatch generic
            # For strict type safety, we map formats to what tasks.py expects
            # tasks.py expects 'word', 'odt', 'csv'.
            # It doesn't handle 'jpg' or 'pdfa' explicitly yet.
            # We will extend this logic here or creates wrapper tasks.
            # For this slice, if formats match tasks.py, use it.
            if target_format in ['docx', 'csv']:
                task_type_map = {'docx': 'word', 'csv': 'csv'}
                task = process_pdf_task.delay(
                    task_type_map[target_format], 
                    filename, 
                    upload_folder, 
                    output_folder
                )
                return {'job_id': task.id, 'status': 'queued'}
            else:
                # Fallback to sync for now if async task not implemented for format
                # Or unimplemented strict requirement.
                # Story says: "S-001 AC4: Sync fallback". 
                # Ideally we create a new task for these, but let's run sync logic wrapped in a pseudo-id
                pass

        # Synchronous execution
        job_id = str(uuid.uuid4())
        pdf_path = os.path.join(upload_folder, filename)
        base_name = Path(filename).stem
        options = options or {}
        
        try:
            result_file = None
            
            if target_format == 'docx':
                 # Extract translation options
                 target_lang = options.get('target_lang')
                 source_lang = options.get('source_lang', 'en')
                 
                 res = run_pdf_extraction('word', filename, upload_folder, output_folder, target_lang, source_lang)
                 if res['status'] == 'Completed':
                     result_file = res['result_file']
                 else:
                     raise Exception(res.get('error', 'Unknown error'))

            elif target_format == 'odt':
                 target_lang = options.get('target_lang')
                 source_lang = options.get('source_lang', 'en')
                 res = run_pdf_extraction('odt', filename, upload_folder, output_folder, target_lang, source_lang)
                 if res['status'] == 'Completed':
                     result_file = res['result_file']
                 else:
                     raise Exception(res.get('error', 'Unknown error'))

            elif target_format == 'csv':
                 target_lang = options.get('target_lang')
                 source_lang = options.get('source_lang', 'en')
                 res = run_pdf_extraction('csv', filename, upload_folder, output_folder, target_lang, source_lang)
                 if res['status'] == 'Completed':
                     result_file = res['result_file']
                 else:
                     raise Exception(res.get('error', 'Unknown error'))

            elif target_format == 'pdfa':
                 result_file = ConversionService.convert_to_pdfa(pdf_path, output_folder)
                 
            elif target_format in ['png', 'jpg', 'webp', 'tiff']:
                # Image formats
                # Create a temp directory for outputs to avoid clutter and facilitate zipping
                temp_dir = os.path.join(output_folder, f"{base_name}_{target_format}_{job_id}")
                os.makedirs(temp_dir, exist_ok=True)
                
                try:
                    files = pdf_to_images(pdf_path, temp_dir, target_format, options)
                    
                    if not files:
                        raise Exception("No images generated")
                        
                    if len(files) > 1:
                        # Zip
                        shutil.make_archive(temp_dir, 'zip', temp_dir)
                        result_file = f"{base_name}_{target_format}.zip"
                        # Handle collision
                        final_path = os.path.join(output_folder, result_file)
                        if os.path.exists(final_path):
                            result_file = f"{base_name}_{target_format}_{job_id}.zip"
                            final_path = os.path.join(output_folder, result_file)
                            
                        shutil.move(f"{temp_dir}.zip", final_path)
                    else:
                        # Single file (e.g. single page or multipage tiff)
                        # Move it to output
                        src_file = os.path.join(temp_dir, files[0])
                        result_file = files[0] # Try to keep original name
                        final_path = os.path.join(output_folder, result_file)
                        if os.path.exists(final_path):
                            result_file = f"{job_id}_{files[0]}"
                            final_path = os.path.join(output_folder, result_file)
                        shutil.move(src_file, final_path)
                        
                finally:
                     # Cleanup temp dir
                     if os.path.exists(temp_dir):
                         shutil.rmtree(temp_dir)
                         
            elif target_format == 'txt':
                # Text format
                temp_dir = os.path.join(output_folder, f"{base_name}_{target_format}_{job_id}")
                os.makedirs(temp_dir, exist_ok=True)
                try:
                    files = pdf_to_txt(pdf_path, temp_dir, options)
                    if files:
                        src_file = os.path.join(temp_dir, files[0])
                        result_file = files[0]
                        final_path = os.path.join(output_folder, result_file)
                        if os.path.exists(final_path):
                            result_file = f"{job_id}_{files[0]}"
                            final_path = os.path.join(output_folder, result_file)
                        shutil.move(src_file, final_path)
                finally:
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir)
            
            return {
                'job_id': job_id,
                'status': 'completed',
                'output_url': f"/outputs/{result_file}"
            }

        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            return {'job_id': job_id, 'status': 'failed', 'error': str(e)}
