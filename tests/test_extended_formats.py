import pytest
from unittest.mock import patch, MagicMock
from app import app
from conversion_service import ConversionService

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_get_extended_formats(client):
    """Verify new formats are available in the API."""
    response = client.get('/api/convert/formats')
    assert response.status_code == 200
    formats = response.json['formats']
    ids = [f['id'] for f in formats]
    
    expected_new = ['png', 'webp', 'tiff', 'txt']
    for fmt in expected_new:
        assert fmt in ids, f"Format {fmt} missing from formats list"

@patch('conversion_service.shutil')
@patch('conversion_service.pdf_to_images')
def test_convert_png_with_options(mock_pdf_to_images, mock_shutil, client):
    """Test passing options to PNG conversion."""
    # Setup mock
    mock_pdf_to_images.return_value = ['page_1.png']
    
    # Mock validation to always succeed
    with patch.object(ConversionService, 'validate_request', return_value=None):
        payload = {
            'filename': 'test.pdf',
            'target_format': 'png',
            'options': {
                'dpi': 300
            }
        }
        
        response = client.post('/api/convert', json=payload)
        
        if response.status_code != 202:
             print(f"DEBUG ERROR: {response.json}")
             
        assert response.status_code == 202
        assert response.json['status'] == 'completed'
        
        # Verify options passed to converter
        args, kwargs = mock_pdf_to_images.call_args
        # args: (pdf_path, temp_dir, format, options)
        assert args[2] == 'png'
        assert args[3]['dpi'] == 300
        
        # Verify shutil.move called (simulating success)
        assert mock_shutil.move.called

@patch('conversion_service.shutil')
@patch('conversion_service.pdf_to_txt')
def test_convert_txt_with_options(mock_pdf_to_txt, mock_shutil, client):
    """Test passing options to Text conversion."""
    mock_pdf_to_txt.return_value = ['document.txt']
    
    with patch.object(ConversionService, 'validate_request', return_value=None):
        payload = {
            'filename': 'test_doc.pdf',
            'target_format': 'txt',
            'options': {
                'page_separator': True,
                'encoding': 'utf-8'
            }
        }
        
        response = client.post('/api/convert', json=payload)
        
        assert response.status_code == 202
        
        args, kwargs = mock_pdf_to_txt.call_args
        # args: (pdf_path, temp_dir, options)
        assert args[2]['page_separator'] == True
        assert args[2]['encoding'] == 'utf-8'
        
        assert mock_shutil.move.called
