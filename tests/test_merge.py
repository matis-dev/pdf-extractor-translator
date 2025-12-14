import os
import pytest
from reportlab.pdfgen import canvas

def create_dummy_pdf(filename, content):
    c = canvas.Canvas(filename)
    c.drawString(100, 750, content)
    c.save()

def test_merge_success(client, app):
    # Setup
    pdf1 = "merge_test_1.pdf"
    pdf2 = "merge_test_2.pdf"
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], pdf1)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], pdf2)
    
    create_dummy_pdf(path1, "Page 1 Content")
    create_dummy_pdf(path2, "Page 2 Content")
    
    output_path = None
    
    try:
        response = client.post('/merge', json={'filenames': [pdf1, pdf2]})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'filename' in data
        assert data['filename'].startswith('merged_')
        assert data['filename'].endswith('.pdf')
        
        # Verify output exists
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        assert os.path.exists(output_path)
        
        # Verify page count
        from pypdf import PdfReader
        reader = PdfReader(output_path)
        assert len(reader.pages) == 2
        
    finally:
        # Cleanup
        if os.path.exists(path1): os.remove(path1)
        if os.path.exists(path2): os.remove(path2)
        if output_path and os.path.exists(output_path):
            os.remove(output_path)

def test_merge_min_files(client):
    response = client.post('/merge', json={'filenames': ['one.pdf']})
    assert response.status_code == 400
    assert 'At least two files' in response.get_json()['error']

def test_merge_missing_file(client):
    response = client.post('/merge', json={'filenames': ['non_existent.pdf', 'another.pdf']})
    # Since checking first file existence happens first
    # Or if first is missing, returns 404
    # The logic loops.
    assert response.status_code == 404
