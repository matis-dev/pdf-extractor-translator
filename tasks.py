from celery import shared_task
import os
import shutil
from pathlib import Path
from docx import Document
from extract_full_document_to_word import extract_full_document_to_word
from extract_tables_to_csv import extract_tables as extract_tables_to_csv
from translation_utils import translate_text, install_languages
import subprocess

# Ensure languages are installed (could be done on startup)
try:
    install_languages()
except Exception as e:
    print(f"Warning: Could not install languages: {e}")

@shared_task(bind=True)
def process_pdf_task(self, extraction_type, filename, upload_folder, output_folder, target_lang=None, source_lang='en'):
    """
    Background task to process PDF files.
    """
    # Update state to processing
    self.update_state(state='PROCESSING', meta={'status': 'Starting extraction...', 'current': 0, 'total': 100})
    
    pdf_path = os.path.join(upload_folder, filename)
    result_file = None

    try:
        if extraction_type == 'word' or extraction_type == 'odt':
            self.update_state(state='PROCESSING', meta={'status': 'Extracting content...', 'current': 10, 'total': 100})
            output_path = extract_full_document_to_word(pdf_path)
            self.update_state(state='PROCESSING', meta={'status': 'Extraction complete. Preparing translation...', 'current': 30, 'total': 100})
            
            # Translate if requested
            if target_lang and target_lang != 'none':
                 self.update_state(state='PROCESSING', meta={'status': f'Translating to {target_lang}...', 'current': 30, 'total': 100})
                 
                 doc = Document(output_path)
                 
                 # Count total items to translate for progress
                 total_items = len(doc.paragraphs) + sum(len(row.cells) * len(cell.paragraphs) for table in doc.tables for row in table.rows for cell in row.cells)
                 processed_items = 0
                 
                 # Translate paragraphs
                 for para in doc.paragraphs:
                     if para.text.strip():
                         para.text = translate_text(para.text, target_lang, source_lang)
                     processed_items += 1
                     if processed_items % 10 == 0:
                         progress = 30 + int((processed_items / total_items) * 60) # 30% to 90%
                         self.update_state(state='PROCESSING', meta={'status': f'Translating... ({int(processed_items/total_items*100)}%)', 'current': progress, 'total': 100})

                 # Translate tables
                 for table in doc.tables:
                     for row in table.rows:
                         for cell in row.cells:
                             for para in cell.paragraphs:
                                 if para.text.strip():
                                     para.text = translate_text(para.text, target_lang, source_lang)
                                 processed_items += 1
                                 if processed_items % 10 == 0:
                                     progress = 30 + int((processed_items / total_items) * 60)
                                     self.update_state(state='PROCESSING', meta={'status': f'Translating tables... ({int(processed_items/total_items*100)}%)', 'current': progress, 'total': 100})
                 
                 doc.save(output_path)

            if extraction_type == 'odt':
                self.update_state(state='PROCESSING', meta={'status': 'Converting to ODT...'})
                odt_path = output_path.replace('.docx', '.odt')
                subprocess.run(['pandoc', output_path, '-o', odt_path], check=True)
                os.remove(output_path) # Remove intermediate DOCX
                output_path = odt_path

            # Move the file to the output folder
            destination = os.path.join(output_folder, os.path.basename(output_path))
            if os.path.exists(destination):
                os.remove(destination)
            shutil.move(output_path, destination)
            result_file = os.path.basename(output_path)

        elif extraction_type == 'csv':
            self.update_state(state='PROCESSING', meta={'status': 'Extracting tables...', 'current': 10, 'total': 100})
            output_dir_path = extract_tables_to_csv(pdf_path)
            
            # Zip the contents of the output directory
            zip_filename = f"{Path(pdf_path).stem}_csv_files"
            shutil.make_archive(zip_filename, 'zip', output_dir_path)
            
            # Move the zip file to the output folder
            destination = os.path.join(output_folder, f"{zip_filename}.zip")
            if os.path.exists(destination):
                os.remove(destination)
            shutil.move(f"{zip_filename}.zip", destination)
            result_file = f"{zip_filename}.zip"

            # Clean up the original CSV directory
            shutil.rmtree(output_dir_path)
        
        return {'status': 'Completed', 'result_file': result_file}
    except Exception as e:
        # In a real app, you might want to log this better
        self.update_state(state='FAILURE', meta={'status': 'Failed', 'error': str(e)})
        # Do not raise the exception to avoid Celery serialization issues with custom exceptions or complex objects
        # Just return the failure state
        return {'status': 'Failed', 'error': str(e)}
