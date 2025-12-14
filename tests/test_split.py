
import os
import pytest
import zipfile
from reportlab.pdfgen import canvas

def create_dummy_pdf(filename, pages=5):
    c = canvas.Canvas(filename)
    for i in range(1, pages + 1):
        c.drawString(100, 750, f"Page {i}")
        c.showPage()
    c.save()

def test_split_success(client, app):
    # Setup
    pdf = "split_test.pdf"
    path = os.path.join(app.config['UPLOAD_FOLDER'], pdf)
    create_dummy_pdf(path, pages=10)
    
    zip_path = None
    
    try:
        # Request split: 1-2, 5, 8-9 (Total 5 pages)
        response = client.post('/split', json={
            'filename': pdf,
            'ranges': ['1-2', '5', '8-9']
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'filename' in data
        assert data['filename'].endswith('.zip')
        
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        assert os.path.exists(zip_path)
        
        # Verify ZIP content
        with zipfile.ZipFile(zip_path, 'r') as zf:
            files = zf.namelist()
            assert len(files) == 3
            # Expected filenames logic: split_test_part1_1-2.pdf, etc.
            assert any('part1_1-2' in f for f in files)
            assert any('part2_5' in f for f in files)
            assert any('part3_8-9' in f for f in files)
            
    finally:
        if os.path.exists(path): os.remove(path)
        if zip_path and os.path.exists(zip_path): os.remove(zip_path)

def test_split_invalid_ranges(client, app):
    # Setup
    pdf = "split_test_invalid.pdf"
    path = os.path.join(app.config['UPLOAD_FOLDER'], pdf)
    create_dummy_pdf(path, pages=3)
    
    try:
        response = client.post('/split', json={
            'filename': pdf,
            'ranges': ['10-12'] # Out of bounds
        })
        # Should return 400 because no ranges processed
        assert response.status_code == 400
        
    finally:
        if os.path.exists(path): os.remove(path)
