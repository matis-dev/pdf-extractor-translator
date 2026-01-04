
@app.route('/api/pipeline/run', methods=['POST'])
def run_pipeline():
    data = request.json
    filename = data.get('filename')
    steps = data.get('steps', [])
    
    if not filename or not steps:
        # For SSE, returning JSON error might be tricky if client expects stream.
        # But we can return 400 JSON before stream starts.
        return jsonify({'error': 'Filename and steps required'}), 400
        
    def generate():
        executor = PipelineExecutor(app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER'])
        for update in executor.execute(filename, steps):
             if update['status'] == 'complete' and 'download_url' in update:
                 # Update download_url to be a full URL/path
                 update['download_url'] = url_for('download_file', filename=update['download_url'])
                 
             yield f"data: {json.dumps(update)}\n\n"
             
    return Response(stream_with_context(generate()), mimetype='text/event-stream')
