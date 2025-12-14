import os
import pytest
from unittest.mock import patch, MagicMock

def test_index_page(client):
    """Test that the index page loads successfully."""
    response = client.get('/')
    assert response.status_code == 200
    assert b"PDF Extractor" in response.data

def test_editor_page(client):
    """Test editor page loads."""
    # We need a filename
    res = client.get('/editor/test.pdf')
    assert res.status_code == 200
    assert b'PDF Editor' in res.data
    # editor.js was replaced by main.js (module)
    assert b'main.js' in res.data
    assert b"editor.css" in res.data

def test_upload_no_file(client):
    """Test uploading without a file."""
    response = client.post('/upload', data={})
    assert response.status_code == 400
    assert b"No file part" in response.data

def test_upload_empty_filename(client):
    """Test uploading an empty filename."""
    data = {'pdf_file': (b'', '')}
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 400

@patch('app.process_pdf_task')
def test_process_request(mock_task, client):
    """Test the processing request endpoint."""
    # Mock the Celery task
    mock_task_instance = MagicMock()
    mock_task_instance.id = 'fake-task-id'
    mock_task.delay.return_value = mock_task_instance

    data = {
        'filename': 'test.pdf',
        'extraction_type': 'word',
        'source_lang': 'en',
        'target_lang': 'es'
    }
    
    response = client.post('/process_request', data=data)
    
    assert response.status_code == 202
    assert response.json['task_id'] == 'fake-task-id'
    mock_task.delay.assert_called_once()

@patch('app.process_pdf_task')
def test_task_status_pending(mock_task, client):
    """Test status endpoint for pending task."""
    # Setup mock AsyncResult
    mock_result = MagicMock()
    mock_result.state = 'PENDING'
    mock_task.AsyncResult.return_value = mock_result
    
    response = client.get('/status/fake-id')
    
    assert response.status_code == 200
    assert response.json['state'] == 'PENDING'

@patch('app.process_pdf_task')
def test_task_status_success(mock_task, client):
    """Test status endpoint for successful task."""
    # Setup mock AsyncResult
    mock_result = MagicMock()
    mock_result.state = 'SUCCESS'
    mock_result.info = {'result_file': 'output.docx', 'status': 'Completed'}
    mock_task.AsyncResult.return_value = mock_result
    
    assert response.status_code == 200
    assert response.json['state'] == 'SUCCESS'
    assert response.json['result_file'] == 'output.docx'

def test_download_file(client, app):
    """Test downloading a file."""
    # Create valid file in OUTPUT_FOLDER
    output_dir = app.config['OUTPUT_FOLDER']
    filename = "test_download.pdf"
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, "wb") as f:
        f.write(b"%PDF-1.4 mock content")
        
    response = client.get(f'/outputs/{filename}')
    assert response.status_code == 200
    assert response.headers['Content-Disposition'] == f'attachment; filename={filename}'
    assert b"%PDF-1.4 mock content" in response.data
