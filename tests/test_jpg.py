import pytest
import os
import io
from flask import Flask
from unittest.mock import patch, MagicMock

def test_pdf_to_jpg_success(client, app):
    """Test successful PDF to JPG conversion."""
    
    # Create valid mock PDF in upload folder
    upload_dir = app.config['UPLOAD_FOLDER']
    filename = "test_image.pdf"
    filepath = os.path.join(upload_dir, filename)
    
    # We need a real PDF or mock the pdf2image conversion
    # Mocking pdf2image is safer as we don't want to rely on poppler in unit test environment if not fully setup
    # But for "Integration" we might want real. 
    # Let's mock pdf2image to isolate from system dependencies in this test file, 
    # relying on the fact that we checked availability earlier.
    
    with open(filepath, "wb") as f:
         f.write(b"%PDF-1.4 mock content")
         
    # Patching pdf2image.convert_from_path directly
    # We need to ensure pdf2image is imported or patch string works
    with patch('pdf2image.convert_from_path') as mock_convert:
        # Mock returned images (Pillow Image objects)
        mock_image = MagicMock()
        # Side effect to create the file so zipfile.write and os.remove work
        mock_image.save.side_effect = lambda path, format: open(path, 'wb').write(b'fake_jpg_content')
        mock_convert.return_value = [mock_image, mock_image] # 2 pages
        
        response = client.post('/pdf-to-jpg', json={'filename': filename})
        
        assert response.status_code == 200
        assert 'url' in response.json
        assert response.json['filename'].endswith('.zip')
        
        # Verify save called twice (once per page)
        assert mock_image.save.call_count == 2
        
def test_pdf_to_jpg_missing_file(client):
    """Test conversion with missing file."""
    response = client.post('/pdf-to-jpg', json={'filename': 'nonexistent.pdf'})
    assert response.status_code == 404
