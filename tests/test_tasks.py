import pytest
import os
from unittest.mock import patch, MagicMock
from tasks import process_pdf_task

@patch('tasks.shutil.move')
@patch('tasks.extract_full_document_to_word')
def test_process_pdf_task_word(mock_extract, mock_move):
    """Test PDF to Word processing task."""
    mock_extract.return_value = "/tmp/output.docx"
    
    # Mocking self.update_state is tricky with bind=True, 
    # but we can check the return value or side effects.
    # We'll skip deep Celery mocking and test logic flow.
    
    # Mock Document to avoid docling dependency here if possible, 
    # or rely on logic that it's called.
    # Since tasks.py imports Document from docx, we need to handle that if used.
    
    with patch('tasks.Document') as mock_doc_cls:
        mock_doc = MagicMock()
        mock_doc_cls.return_value = mock_doc
        mock_doc.paragraphs = [] # Empty paragraphs
        
        # Mock update_state on the task object itself to avoid "task_id must not be empty"
        with patch.object(process_pdf_task, 'update_state') as mock_update:
            # Test basic flow without translation
            result = process_pdf_task(
                extraction_type='word',
                filename='test.pdf',
                upload_folder='/uploads',
                output_folder='/outputs',
                target_lang='none'
            )
            
            assert result['status'] == 'Completed'
            assert result['result_file'] == 'output.docx' # Based on mocked return value
            mock_extract.assert_called_once()


@patch('tasks.extract_tables_to_csv')
def test_process_pdf_task_csv(mock_extract):
    """Test PDF to CSV processing task."""
    mock_extract.return_value = "/tmp/output_dir"
    
    # We also need to mock os.path.join, shutil.make_archive etc.
    # Or just mock the heavy lifting `extract_tables_to_csv` and verifying key path logic.
    
    with patch('shutil.make_archive') as mock_archive, \
         patch('shutil.move') as mock_move, \
         patch('shutil.rmtree') as mock_rmtree, \
         patch.object(process_pdf_task, 'update_state') as mock_update:
             
        mock_archive.return_value = "/tmp/output.zip"
        
        result = process_pdf_task(
            extraction_type='csv',
            filename='test.pdf',
            upload_folder='/uploads',
            output_folder='/outputs'
        )
        
        assert result['status'] == 'Completed'
        assert 'result_file' in result
        mock_extract.assert_called_once()
