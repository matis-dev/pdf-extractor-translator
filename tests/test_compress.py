import os
import pytest
from reportlab.pdfgen import canvas

def create_dummy_pdf(filename, content):
    c = canvas.Canvas(filename)
    c.drawString(100, 750, content)
    c.save()

def test_compress_success(client, app):
    # Setup
    pdf = "compress_test.pdf"
    path = os.path.join(app.config['UPLOAD_FOLDER'], pdf)
    create_dummy_pdf(path, "Compress Me")
    
    # Check if gs is available, otherwise skip
    import shutil
    if not shutil.which('gs'):
        pytest.skip("Ghostscript not installed")

    try:
        response = client.post('/compress', json={'filename': pdf})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'filename' in data
        assert data['filename'].startswith('compressed_')
        
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        assert os.path.exists(output_path)
        
    finally:
        if os.path.exists(path): os.remove(path)
        if 'output_path' in locals() and os.path.exists(output_path):
             os.remove(output_path)

def test_compress_missing_file(client):
    response = client.post('/compress', json={'filename': 'fake.pdf'})
    assert response.status_code == 404
