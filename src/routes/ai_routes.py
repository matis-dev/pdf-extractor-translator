import os
import threading
import logging
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from ai_utils import get_pdf_chat_instance, LANGCHAIN_AVAILABLE

logger = logging.getLogger(__name__)

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')

# Global state for pulling models
pulling_models = set()

@ai_bp.route('/status', methods=['GET'])
def ai_status():
    """Check if local AI is available."""
    try:
        if not LANGCHAIN_AVAILABLE:
             return jsonify({
                'available': False,
                'error': 'AI dependencies not installed. Please install requirements.'
            })
            
        chat = get_pdf_chat_instance()
        ollama_ok = chat.check_ollama_available()
        models = chat.check_models_installed()
        return jsonify({
            'available': ollama_ok,
            'ollama_running': ollama_ok,
            'models': models.get('available_models', []),
            'langchain_installed': True
        })
    except ImportError:
         return jsonify({
            'available': False,
            'error': 'AI module import failed.'
        })
    except Exception as e:
        return jsonify({
            'available': False,
            'error': str(e)
        })

@ai_bp.route('/index', methods=['POST'])
def ai_index_pdf():
    """Index a PDF for AI chat."""
    filename = request.json.get('filename')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
    
    upload_folder = current_app.config['UPLOAD_FOLDER']
    pdf_path = os.path.join(upload_folder, secure_filename(filename))
    
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        chat = get_pdf_chat_instance()
        
        if not chat.check_ollama_available():
            return jsonify({'error': 'Ollama is not running. Please start Ollama first.'}), 503
        
        num_chunks = chat.index_pdf(pdf_path)
        return jsonify({
            'success': True,
            'chunks_indexed': num_chunks,
            'message': f'PDF indexed successfully with {num_chunks} chunks'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/ask', methods=['POST'])
def ai_ask():
    """Ask a question about the indexed PDF."""
    question = request.json.get('question')
    model = request.json.get('model')
    
    if not question:
        return jsonify({'error': 'Question required'}), 400
    
    try:
        chat = get_pdf_chat_instance()
        
        # Switch model if requested and different
        if model and model != chat.llm_model:
            chat.update_llm(model)
            
        result = chat.ask(question)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/summarize', methods=['POST'])
def ai_summarize():
    """Generates a structured summary of the indexed PDF."""
    mode = request.json.get('mode', 'brief') # brief | detailed
    
    try:
        chat = get_pdf_chat_instance()
        
        result = chat.summarize_document(mode=mode)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/pull', methods=['POST'])
def ai_pull():
    """Pull a new model from Ollama."""
    model = request.json.get('model')
    if not model:
        return jsonify({'error': 'Model name required'}), 400
        
    if model in pulling_models:
        return jsonify({'error': f'Model {model} is already being pulled.'}), 409
        
    def pull_background(model_name):
        try:
            logger.info(f"Starting pull for {model_name}...")
            # Use requests to talk to Ollama directly
            import requests
            # stream=False waits until done
            requests.post('http://localhost:11434/api/pull', json={'name': model_name, 'stream': False})
            logger.info(f"Finished pull for {model_name}")
        except Exception as e:
            logger.error(f"Error pulling {model_name}: {e}")
        finally:
            pulling_models.discard(model_name)

    # Start in background thread
    pulling_models.add(model)
    thread = threading.Thread(target=pull_background, args=(model,))
    thread.start()
    
    return jsonify({'status': 'started', 'message': f'Pulling {model} in background'})
