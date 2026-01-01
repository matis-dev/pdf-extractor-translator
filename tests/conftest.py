import pytest
import os
import sys
import tempfile
import shutil

# Add project root and src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# Mock translation_utils.install_languages to prevent large downloads during import
import unittest.mock
import translation_utils
translation_utils.install_languages = unittest.mock.MagicMock()

from app import app as flask_app
 
@pytest.fixture(scope="session")
def upload_folder():
    """Create a temporary upload folder."""
    folder = tempfile.mkdtemp()
    yield folder
    shutil.rmtree(folder)

@pytest.fixture(scope="session")
def output_folder():
    """Create a temporary output folder."""
    folder = tempfile.mkdtemp()
    yield folder
    shutil.rmtree(folder)

@pytest.fixture(scope="session")
def app(upload_folder, output_folder):
    """Create and configure a new app instance for each test session."""
    # flask_app imported globally

    flask_app.config.update({
        "TESTING": True,
        "UPLOAD_FOLDER": upload_folder,
        "OUTPUT_FOLDER": output_folder,
        "WTF_CSRF_ENABLED": False
    })
    
    yield flask_app
    
    # Cleanup (optional - can keep for debugging)
    # import shutil
    # shutil.rmtree(flask_app.config["UPLOAD_FOLDER"])
    # shutil.rmtree(flask_app.config["OUTPUT_FOLDER"])

import time
import subprocess
import requests

@pytest.fixture(scope="session")
def live_server_url():
    """Start the test server and return its URL."""
    server_path = os.path.join(os.path.dirname(__file__), 'test_server.py')
    
    # Start server
    proc = subprocess.Popen([sys.executable, server_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    url = "http://localhost:5001"
    
    # Wait for server to start
    max_retries = 60
    for _ in range(max_retries):
        try:
            requests.get(url)
            break
        except requests.ConnectionError:
            time.sleep(0.5)
    else:
        proc.terminate()
        stdout, stderr = proc.communicate()
        raise RuntimeError(f"Server failed to start:\nStdout: {stdout}\nStderr: {stderr}")
        
    yield url
    
    proc.terminate()
    proc.wait()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()
