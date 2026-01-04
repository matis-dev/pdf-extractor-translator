
import pytest
import os
import pikepdf

def test_sanitize_full(client, upload_folder, output_folder):
    # 1. Create a "dirty" PDF
    dirty_path = os.path.join(upload_folder, 'dirty.pdf')
    pdf = pikepdf.new()
    pdf.add_blank_page()
    
    # Add Metadata
    with pdf.open_metadata() as meta:
        meta['dc:title'] = 'Dirty PDF'
        
    pdf.docinfo['/Author'] = 'Evil Author'
    
    # Add JS structure manually
    # pdf.root.Names = pikepdf.Dictionary()
    # pdf.root.Names.JavaScript = pikepdf.Dictionary()
    # Manual dict creation
    pdf.Root.Names = pikepdf.Dictionary({
        '/JavaScript': pikepdf.Dictionary({
             '/Names': [pikepdf.Name('/TestScript'), pikepdf.Dictionary(S=pikepdf.Name('/JavaScript'), JS=b"app.alert('XSS')")]
        })
    })

    pdf.save(dirty_path)
    
    # 2. Call Endpoint
    response = client.post('/api/sanitize', data={
        'filename': 'dirty.pdf',
        'remove_js': 'true',
        'remove_metadata': 'true',
        'remove_layers': 'true',
        'remove_embedded': 'true'
    })
    
    assert response.status_code == 200
    data = response.json
    assert data['filename'].startswith('sanitized_')
    
    # Verify summary contains expected items
    summary = " ".join(data['summary'])
    assert "JavaScript" in summary
    assert "Document Info" in summary
    
    # 3. Verify Output
    output_path = os.path.join(output_folder, data['filename'])
    assert os.path.exists(output_path)
    
    clean_pdf = pikepdf.Pdf.open(output_path)
    clean_pdf = pikepdf.Pdf.open(output_path)
    
    # Check Metadata
    if '/Author' in clean_pdf.docinfo:
       assert False, "Author metadata should be removed"
    
    # Check JS
    # Logic in app: if '/Names' in pdf.root and '/JavaScript' in pdf.root.Names: del ...
    if '/Names' in clean_pdf.Root:
        names = clean_pdf.Root['/Names']
        if '/JavaScript' in names:
            assert False, "JS Names tree should be removed"
        
    clean_pdf.close()
