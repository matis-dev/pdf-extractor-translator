from flask import Blueprint, request, jsonify, current_app
from conversion_service import ConversionService
import redis

convert_bp = Blueprint('convert_bp', __name__)

def is_redis_available():
    """Checks if Redis is available for async tasks."""
    try:
        broker_url = current_app.config.get('CELERY', {}).get('broker_url')
        if not broker_url:
            return False
        r = redis.from_url(broker_url)
        r.ping()
        return True
    except Exception:
        return False

@convert_bp.route('/api/convert', methods=['POST'])
def convert_document():
    """
    Unified Conversion Endpoint.
    Contract:
    POST { filename: str, target_format: str }
    """
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    filename = data.get('filename')
    target_format = data.get('target_format')

    if not filename or not target_format:
        return jsonify({'error': 'Missing filename or target_format'}), 400

    # 1. Validate
    error = ConversionService.validate_request(filename, target_format)
    if error:
        # Check standard HTTP codes. 404 for file not found?
        if "found" in error:
            return jsonify({'error': error}), 404
        return jsonify({'error': error}), 400

    # 2. Determine Execution Mode
    use_async = is_redis_available()
    options = data.get('options', {})
    
    # 3. Process
    result = ConversionService.process_conversion(filename, target_format, is_async=use_async, options=options)
    
    if result.get('status') == 'failed':
        return jsonify({'error': result.get('error')}), 500

    # 202 Accepted for both async (queued) and sync (completed) usually, 
    # but strictly if sync completed immediately, we could return 200.
    # However, to keep API consistent, 202 is fine, client checks status or uses output_url.
    # The Story AC1 says "Receive 202 Accepted... contains job_id... status processing or completed".
    return jsonify(result), 202

@convert_bp.route('/api/convert/formats', methods=['GET'])
def get_formats():
    """Returns supported formats."""
    return jsonify({
        'formats': [
            {'id': 'docx', 'label': 'Word Document (DOCX)', 'icon': '📝'},
            {'id': 'odt', 'label': 'OpenDocument Text (ODT)', 'icon': '📝'},
            {'id': 'txt', 'label': 'Plain Text (TXT)', 'icon': '📄'},
            {'id': 'png', 'label': 'Image (PNG)', 'icon': '🖼️'},
            {'id': 'jpg', 'label': 'Image (JPG)', 'icon': '🖼️'},
            {'id': 'webp', 'label': 'Image (WEBP)', 'icon': '🌐'},
            {'id': 'tiff', 'label': 'Image (TIFF)', 'icon': '📸'},
            {'id': 'pdfa', 'label': 'PDF/A (Archival)', 'icon': '📋'},
            {'id': 'csv', 'label': 'Tables (CSV)', 'icon': '📊'}
        ]
    })
