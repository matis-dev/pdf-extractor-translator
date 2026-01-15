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
import pdf2image

logger = logging.getLogger(__name__)

class ConversionService:
    """
    Service to handle document conversion logic.
    Prioritizes type safety and atomic operations.
    """

    ALLOWED_FORMATS = {'docx', 'jpg', 'pdfa', 'csv'}

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
    def convert_to_jpg(pdf_path: str, output_folder: str) -> str:
        """
        Converts PDF to a series of JPG images, zipped.
        """
        images = pdf2image.convert_from_path(pdf_path)
        base_name = Path(pdf_path).stem
        temp_dir = os.path.join(output_folder, f"{base_name}_jpgs")
        os.makedirs(temp_dir, exist_ok=True)

        for i, image in enumerate(images):
            image.save(os.path.join(temp_dir, f"{base_name}_page_{i+1}.jpg"), "JPEG")
        
        # Zip it
        shutil.make_archive(temp_dir, 'zip', temp_dir)
        zip_filename = f"{base_name}_jpgs.zip"
        final_path = os.path.join(output_folder, zip_filename)
        shutil.move(f"{temp_dir}.zip", final_path)
        shutil.rmtree(temp_dir)
        
        return zip_filename

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
    def process_conversion(filename: str, target_format: str, is_async: bool = False):
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
        
        try:
            result_file = None
            if target_format == 'docx':
                 # Re-use run_pdf_extraction logic which calls extract_full_document_to_word
                 # But run_pdf_extraction is return dict.
                 res = run_pdf_extraction('word', filename, upload_folder, output_folder)
                 if res['status'] == 'Completed':
                     result_file = res['result_file']
                 else:
                     raise Exception(res.get('error', 'Unknown error'))

            elif target_format == 'csv':
                 res = run_pdf_extraction('csv', filename, upload_folder, output_folder)
                 if res['status'] == 'Completed':
                     result_file = res['result_file']
                 else:
                     raise Exception(res.get('error', 'Unknown error'))

            elif target_format == 'jpg':
                 result_file = ConversionService.convert_to_jpg(pdf_path, output_folder)

            elif target_format == 'pdfa':
                 result_file = ConversionService.convert_to_pdfa(pdf_path, output_folder)
            
            return {
                'job_id': job_id,
                'status': 'completed',
                'output_url': f"/outputs/{result_file}"
            }

        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            return {'job_id': job_id, 'status': 'failed', 'error': str(e)}
