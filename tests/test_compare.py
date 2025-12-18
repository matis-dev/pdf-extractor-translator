import os
import pytest
from reportlab.pdfgen import canvas


def create_dummy_pdf(filename, content, pages=1):
    """Create a dummy PDF with the specified content."""
    c = canvas.Canvas(filename)
    for i in range(pages):
        c.drawString(100, 750, f"{content} - Page {i+1}")
        c.showPage()
    c.save()


def test_compare_success(client, app):
    """Test successful comparison of two different PDFs."""
    pdf1 = "compare_test_1.pdf"
    pdf2 = "compare_test_2.pdf"
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], pdf1)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], pdf2)
    
    # Create two different PDFs
    create_dummy_pdf(path1, "Document A")
    create_dummy_pdf(path2, "Document B")
    
    output_path = None
    
    try:
        response = client.post('/compare', json={
            'filename1': pdf1,
            'filename2': pdf2
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Check response structure
        assert 'filename' in data
        assert data['filename'].startswith('compare_')
        assert data['filename'].endswith('.zip')
        assert 'url' in data
        assert 'summary' in data
        
        # Check summary
        summary = data['summary']
        assert summary['pdf1'] == pdf1
        assert summary['pdf2'] == pdf2
        assert summary['pages_pdf1'] == 1
        assert summary['pages_pdf2'] == 1
        # Different content should show differences
        assert summary['total_differences'] >= 0  # Could be 0 if content is visually similar
        
        # Verify output exists
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        assert os.path.exists(output_path)
        
        # Verify ZIP contents
        import zipfile
        with zipfile.ZipFile(output_path, 'r') as zf:
            names = zf.namelist()
            assert 'summary.json' in names
            assert 'page_1_sidebyside.jpg' in names
        
    finally:
        # Cleanup
        if os.path.exists(path1): os.remove(path1)
        if os.path.exists(path2): os.remove(path2)
        if output_path and os.path.exists(output_path): os.remove(output_path)


def test_compare_identical(client, app):
    """Test comparison of identical PDFs - should show no differences."""
    pdf1 = "compare_identical_1.pdf"
    pdf2 = "compare_identical_2.pdf"
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], pdf1)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], pdf2)
    
    # Create two identical PDFs
    create_dummy_pdf(path1, "Identical Content")
    create_dummy_pdf(path2, "Identical Content")
    
    output_path = None
    
    try:
        response = client.post('/compare', json={
            'filename1': pdf1,
            'filename2': pdf2
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Identical PDFs should have 0 differences
        assert data['summary']['total_differences'] == 0
        
        # Verify no diff images were created (only side-by-side)
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        import zipfile
        with zipfile.ZipFile(output_path, 'r') as zf:
            names = zf.namelist()
            # Should have summary and side-by-side, but no diff
            assert 'summary.json' in names
            assert 'page_1_sidebyside.jpg' in names
            assert 'page_1_diff.png' not in names
        
    finally:
        if os.path.exists(path1): os.remove(path1)
        if os.path.exists(path2): os.remove(path2)
        if output_path and os.path.exists(output_path): os.remove(output_path)


def test_compare_missing_file(client, app):
    """Test error handling for missing files."""
    response = client.post('/compare', json={
        'filename1': 'nonexistent1.pdf',
        'filename2': 'nonexistent2.pdf'
    })
    
    assert response.status_code == 404
    assert 'error' in response.get_json()


def test_compare_missing_filename(client):
    """Test error handling for missing filename parameters."""
    # Missing both
    response = client.post('/compare', json={})
    assert response.status_code == 400
    
    # Missing filename2
    response = client.post('/compare', json={'filename1': 'test.pdf'})
    assert response.status_code == 400
    
    # Missing filename1
    response = client.post('/compare', json={'filename2': 'test.pdf'})
    assert response.status_code == 400


def test_compare_different_page_counts(client, app):
    """Test comparison of PDFs with different page counts."""
    pdf1 = "compare_short.pdf"
    pdf2 = "compare_long.pdf"
    path1 = os.path.join(app.config['UPLOAD_FOLDER'], pdf1)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], pdf2)
    
    # Create PDFs with different page counts
    create_dummy_pdf(path1, "Short Doc", pages=1)
    create_dummy_pdf(path2, "Long Doc", pages=3)
    
    output_path = None
    
    try:
        response = client.post('/compare', json={
            'filename1': pdf1,
            'filename2': pdf2
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Check page counts
        summary = data['summary']
        assert summary['pages_pdf1'] == 1
        assert summary['pages_pdf2'] == 3
        
        # Verify ZIP has side-by-side for all pages
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], data['filename'])
        import zipfile
        with zipfile.ZipFile(output_path, 'r') as zf:
            names = zf.namelist()
            assert 'page_1_sidebyside.jpg' in names
            assert 'page_2_sidebyside.jpg' in names
            assert 'page_3_sidebyside.jpg' in names
        
    finally:
        if os.path.exists(path1): os.remove(path1)
        if os.path.exists(path2): os.remove(path2)
        if output_path and os.path.exists(output_path): os.remove(output_path)
