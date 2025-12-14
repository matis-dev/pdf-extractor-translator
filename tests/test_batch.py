
import io
import pytest
from unittest.mock import patch, MagicMock

def test_upload_multiple_files(client):
    """Test uploading multiple PDF files."""
    data = {
        'pdf_file': [
            (io.BytesIO(b"file1"), 'test1.pdf'),
            (io.BytesIO(b"file2"), 'test2.pdf')
        ]
    }
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    
    # Should redirect to index when multiple
    assert response.status_code == 302
    assert response.location.endswith('/') or 'index' in response.location.lower()

def test_create_zip_no_files(client):
    """Test create_zip with no filenames."""
    response = client.post('/create_zip', json={'filenames': []})
    assert response.status_code == 400

@patch('os.path.exists')
@patch('zipfile.ZipFile')
def test_create_zip_success(mock_zip, mock_exists, client):
    """Test successful zip creation."""
    mock_exists.return_value = True
    
    response = client.post('/create_zip', json={'filenames': ['file1.docx', 'file2.docx']})
    
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/zip'
    assert 'attachment' in response.headers['Content-Disposition']
