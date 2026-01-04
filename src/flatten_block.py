
@app.route('/api/flatten', methods=['POST'])
def flatten_pdf():
    filename = request.form.get('filename')
    
    if not filename:
         return jsonify({'error': 'Filename required'}), 400
         
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(input_path):
         return jsonify({'error': 'File not found'}), 404
         
    try:
        pdf = pikepdf.Pdf.open(input_path)
        
        # Flatten all annotations
        pdf.flatten_annotations(render=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"flattened_{timestamp}_{secure_filename(filename)}"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        pdf.save(output_path)
        pdf.close()
        
        return jsonify({
            'filename': output_filename,
            'url': url_for('download_file', filename=output_filename)
        })
    except Exception as e:
        logger.error(f"Flatten failed: {e}")
        return jsonify({'error': str(e)}), 500
