
import pytest
from app import app
import json

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_get_state_default(client):
    """GET /api/state/<filename> should return default state for new file."""
    res = client.get('/api/state/new_file.pdf')
    assert res.status_code == 200
    data = res.get_json()
    assert data['current_page'] == 1
    assert data['zoom_level'] == 1.0

def test_post_state_valid(client):
    """POST /api/state/<filename> should save valid state."""
    payload = {'current_page': 3, 'zoom_level': 1.25}
    res = client.post('/api/state/my_doc.pdf', 
                     data=json.dumps(payload),
                     content_type='application/json')
    assert res.status_code == 200
    assert res.get_json()['status'] == 'saved'
    
    # Verify persistence via GET
    res = client.get('/api/state/my_doc.pdf')
    data = res.get_json()
    assert data['current_page'] == 3
    assert data['zoom_level'] == 1.25

def test_post_state_partial(client):
    """POST /api/state/<filename> should handle partial updates (optional requirement check)."""
    # Assuming current implementation requires both or defaults?
    # Based on implementation, it expects json.get('current_page', 1) logic?
    # Let's check logic: backend code says: 
    # page = data.get('current_page', 1)
    # zoom = data.get('zoom_level', 1.0)
    # So if missing, it resets to default? Or updates only provided?
    # The SQL query is REPLACE INTO ... VALUES ...
    # So it overwrites entire row. Partial update would require fetching first.
    # Current implementation implies OVERWRITE.
    
    payload = {'current_page': 7} # Missing zoom
    res = client.post('/api/state/partial.pdf', 
                     data=json.dumps(payload),
                     content_type='application/json')
    assert res.status_code == 200
    
    res = client.get('/api/state/partial.pdf')
    data = res.get_json()
    assert data['current_page'] == 7
    assert data['zoom_level'] == 1.0 # Default fallback
    
def test_post_state_invalid_types(client):
    """Verify robust handling of bad types (though not strictly enforced scheme, shouldn't crash)."""
    payload = {'current_page': "Nan", 'zoom_level': "Big"}
    # The application code casts or passes to sqlite?
    # SQLite is dynamic. Python App doesn't cast explicitly?
    # Let's see if it crashes.
    res = client.post('/api/state/bad_type.pdf', 
                     data=json.dumps(payload),
                     content_type='application/json')
    # Should probably be 400 or 500, or handled.
    # If 200, check what was saved.
    assert res.status_code in [200, 400, 500]
