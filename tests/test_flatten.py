
import pytest
import os
import pikepdf

def test_flatten_endpoint(client, upload_folder, output_folder):
    # 1. Create a PDF with an annotation
    flatten_path = os.path.join(upload_folder, 'to_flatten.pdf')
    pdf = pikepdf.new()
    pdf.add_blank_page()
    
    # Add a Dummy Annotation
    page = pdf.pages[0]
    # Simple rectangle annotation
    rect = [10, 10, 100, 100]
    
    # Create Appearance Stream
    normal_appearance = pdf.make_stream(
        b"1 0 0 RG 0 0 100 100 re f",
        Type=pikepdf.Name.XObject,
        Subtype=pikepdf.Name.Form,
        FormType=1,
        BBox=[0, 0, 100, 100],
        Resources=pikepdf.Dictionary(),
    )

    annot = pikepdf.Dictionary(
        Type=pikepdf.Name.Annot,
        Subtype=pikepdf.Name.Square,
        Rect=rect,
        C=[1, 0, 0], # Red
        AP=pikepdf.Dictionary(N=normal_appearance)
    )
    if '/Annots' not in page:
        page['/Annots'] = []
    page['/Annots'].append(annot)
    
    pdf.save(flatten_path)
    
    # 2. Call Endpoint
    response = client.post('/api/flatten', data={
        'filename': 'to_flatten.pdf'
    })
    
    if response.status_code != 200:
        print(f"FAILED: {response.data}")
    
    assert response.status_code == 200
    data = response.json
    assert data['filename'].startswith('flattened_')
    
    # 3. Verify Output
    output_path = os.path.join(output_folder, data['filename'])
    assert os.path.exists(output_path)
    
    flat_pdf = pikepdf.Pdf.open(output_path)
    # Annotations should be empty or the specific annot removed
    # NOTE: flatten_annotations removes them from /Annots
    
    page0 = flat_pdf.pages[0]
    if '/Annots' in page0:
        print(f"DEBUG: Annots present: {page0.Annots}")
        # Should be empty or None, or just cleaned
        assert len(page0.Annots) == 0, "Annotations should be removed after flattening"
    
    flat_pdf.close()
