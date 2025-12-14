import pytest
import os
import io
from flask import Flask
from unittest.mock import patch, MagicMock
from pypdf import PdfWriter

def test_repair_pdf_success(client, app):
    """Test successful PDF repair."""
    
    upload_dir = app.config['UPLOAD_FOLDER']
    filename = "test_repair.pdf"
    filepath = os.path.join(upload_dir, filename)
    
    # Create simple valid PDF
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    with open(filepath, "wb") as f:
        writer.write(f)
        
    response = client.post('/repair', json={'filename': filename})
    
    assert response.status_code == 200
    assert 'url' in response.json
    assert response.json['filename'].startswith('repaired_')
    
    # Verify file exists
    out_file = os.path.join(app.config['OUTPUT_FOLDER'], response.json['filename'])
    assert os.path.exists(out_file)

def test_repair_pdf_missing_file(client):
    """Test repair with missing file."""
    response = client.post('/repair', json={'filename': 'nonexistent.pdf'})
    assert response.status_code == 404
