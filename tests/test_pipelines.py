
import pytest
import os
import io
import json
import pikepdf

def test_pipeline_execution(client, upload_folder, output_folder):
    # 1. Create a PDF
    input_path = os.path.join(upload_folder, 'pipeline_test.pdf')
    pdf = pikepdf.new()
    pdf.add_blank_page()
    # Add simple JS to sanitize
    pdf.Root.Names = pikepdf.Dictionary({
        '/JavaScript': pikepdf.Dictionary({
             '/Names': [pikepdf.Name('/Test'), pikepdf.Dictionary(S=pikepdf.Name('/JavaScript'), JS=b"console.log('test')")]
        })
    })
    pdf.save(input_path)
    
    # 2. Call Pipeline
    data = {
        'filename': 'pipeline_test.pdf',
        'steps': [
            {'op': 'sanitize'},
            {'op': 'compress'}
        ]
    }
    
    response = client.post('/api/pipeline/run', json=data)
    
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    
    # 3. Read Stream
    # Flask test client .data gives full content.
    content = response.data.decode('utf-8')
    lines = content.split('\n')
    
    updates = []
    for line in lines:
        if line.startswith('data: '):
            update = json.loads(line[6:])
            updates.append(update)
            
    # Start
    assert updates[0]['status'] == 'start'
    assert updates[0]['total_steps'] == 2
    
    # Step 1: Sanitize
    assert updates[1]['status'] == 'progress'
    assert updates[1]['step_name'] == 'sanitize'
    
    # Step 2: Compress
    assert updates[2]['status'] == 'progress'
    assert updates[2]['step_name'] == 'compress'
    
    # Complete
    assert updates[-1]['status'] == 'complete'
    final_url = updates[-1]['download_url']
    assert '/outputs/' in final_url or 'download' in final_url
    
    # Verify file
    # Extract filename from url if possible, or just rely on 'pipeline_comp_' prefix check of last update if implementation provides it?
    # Our impl returns 'download_url' which is a URL.
    # But executor returns filename. App wrapper converts to URL.
    # We can check output folder for files starting with pipeline_comp_
    
    found = False
    for f in os.listdir(output_folder):
        if f.startswith('pipeline_comp_') and 'pipeline_test' in f:
            found = True
            break
    assert found
