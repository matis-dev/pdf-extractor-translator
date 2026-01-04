
@app.route('/api/sanitize', methods=['POST'])
def sanitize_pdf():
    filename = request.form.get('filename')
    # Default to string 'true' check
    remove_js = request.form.get('remove_js') == 'true'
    remove_metadata = request.form.get('remove_metadata') == 'true' 
    remove_layers = request.form.get('remove_layers') == 'true'
    remove_embedded = request.form.get('remove_embedded') == 'true'

    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404

    try:
        pdf = pikepdf.Pdf.open(input_path)
        summary = []
        
        # 1. Remove JavaScript
        if remove_js:
            if '/Names' in pdf.root:
                names = pdf.root['/Names']
                if '/JavaScript' in names:
                    del names['/JavaScript']
                    summary.append('Removed document-level JavaScript')
            
            if '/OpenAction' in pdf.root:
                 del pdf.root['/OpenAction']
                 summary.append('Removed OpenAction scripts')
            
            count = 0
            for page in pdf.pages:
                if '/AA' in page:
                    del page['/AA']
                    count += 1
                if '/Annots' in page:
                    for annot in page.Annots:
                        if '/A' in annot and '/S' in annot.A and annot.A.S == '/JavaScript':
                             del annot['/A']
                             count += 1
                        if '/AA' in annot:
                             del annot['/AA']
                             count += 1
            if count > 0:
                summary.append(f'Removed {count} JS actions from pages/annotations')

        # 2. Remove Metadata
        if remove_metadata:
            # Clear /Info
            keys = list(pdf.docinfo.keys())
            for k in keys:
                del pdf.docinfo[k]
            summary.append('Cleared Document Info dictionary')
            
            if '/Metadata' in pdf.root:
                del pdf.root['/Metadata']
                summary.append('Removed XMP Metadata')

        # 3. Remove Hidden Layers (OCG)
        if remove_layers:
            if '/OCProperties' in pdf.root:
                del pdf.root['/OCProperties']
                summary.append('Removed Optional Content (Layers)')

        # 4. Remove Embedded Files
        if remove_embedded:
             if '/Names' in pdf.root:
                names = pdf.root['/Names']
                if '/EmbeddedFiles' in names:
                  del names['/EmbeddedFiles']
                  summary.append('Removed Embedded Files')
                  
             if '/EmbeddedFiles' in pdf.root:
                 del pdf.root['/EmbeddedFiles']
                 summary.append('Removed Root Embedded Files')

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"sanitized_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        pdf.save(output_path)
        pdf.close()
        
        return jsonify({
            'filename': output_filename, 
            'url': url_for('download_file', filename=output_filename),
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Sanitization failed: {e}")
        return jsonify({'error': str(e)}), 500
