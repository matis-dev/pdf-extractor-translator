import pytest
from unittest.mock import patch, MagicMock
from app import app

@pytest.fixture
def run_mock():
    with patch('routes.convert_routes.ConversionService.process_conversion') as mock:
        yield mock

@pytest.fixture
def validate_mock():
    with patch('routes.convert_routes.ConversionService.validate_request') as mock:
        yield mock

def test_convert_missing_data(client):
    response = client.post('/api/convert', json={})
    assert response.status_code == 400
    assert 'error' in response.json

def test_convert_invalid_file(client, validate_mock):
    validate_mock.return_value = "File 'test.pdf' not found."
    
    response = client.post('/api/convert', json={
        'filename': 'test.pdf',
        'target_format': 'docx'
    })
    
    assert response.status_code == 404
    assert response.json['error'] == "File 'test.pdf' not found."

def test_convert_unknown_format(client, validate_mock):
    validate_mock.return_value = "Invalid format 'xyz'. Allowed: docx, jpg, pdfa, csv"
    
    response = client.post('/api/convert', json={
        'filename': 'test.pdf',
        'target_format': 'xyz'
    })
    
    assert response.status_code == 400
    # assert 'Invalid format' in response.json['error']

def test_convert_success_sync(client, validate_mock, run_mock):
    validate_mock.return_value = None
    run_mock.return_value = {
        'job_id': '123',
        'status': 'completed',
        'output_url': '/outputs/test_full_content.docx'
    }
    
    response = client.post('/api/convert', json={
        'filename': 'test.pdf',
        'target_format': 'docx'
    })
    
    assert response.status_code == 202
    assert response.json['status'] == 'completed'
    assert response.json['output_url'] == '/outputs/test_full_content.docx'

def test_convert_success_async(client, validate_mock, run_mock):
    validate_mock.return_value = None
    run_mock.return_value = {
        'job_id': 'task-uuid',
        'status': 'queued'
    }
    
    response = client.post('/api/convert', json={
        'filename': 'test.pdf',
        'target_format': 'docx'
    })
    
    assert response.status_code == 202
    assert response.json['status'] == 'queued'
    assert response.json['job_id'] == 'task-uuid'

def test_get_formats(client):
    response = client.get('/api/convert/formats')
    assert response.status_code == 200
    assert 'formats' in response.json
    assert len(response.json['formats']) == 4
    ids = [f['id'] for f in response.json['formats']]
    assert 'docx' in ids
    assert 'jpg' in ids
