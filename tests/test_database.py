
import pytest
import sqlite3
import os
import pytest
import sqlite3
import os
from src.database import init_db, get_document_state, update_document_state, DB_PATH
from pathlib import Path

# Mock DB name to use a test database
TEST_DB = Path("test_document_state.db")

@pytest.fixture
def test_db():
    # Override global DB_PATH logic
    import src.database
    original_db_path = src.database.DB_PATH
    src.database.DB_PATH = TEST_DB
    
    # Init clean DB
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
        
    init_db()
    
    yield
    
    # Teardown
    src.database.DB_PATH = original_db_path
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

def test_init_db(test_db):
    """Verify database and table creation."""
    assert os.path.exists(TEST_DB)
    with sqlite3.connect(TEST_DB) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='document_state';")
        assert cursor.fetchone() is not None

def test_get_nonexistent_state(test_db):
    """Verify default return for unknown file."""
    state = get_document_state("unknown.pdf")
    assert state is None

def test_save_and_get_state(test_db):
    """Verify saving and retrieving state."""
    filename = "test_doc.pdf"
    update_document_state(filename, 5, 1.5)
    
    state = get_document_state(filename)
    assert state is not None
    assert state['current_page'] == 5
    assert state['zoom_level'] == 1.5
    assert 'updated_at' in state

def test_update_existing_state(test_db):
    """Verify updating an existing record."""
    filename = "test_doc.pdf"
    update_document_state(filename, 1, 1.0) # Initial
    update_document_state(filename, 10, 2.0) # Update
    
    state = get_document_state(filename)
    assert state['current_page'] == 10
    assert state['zoom_level'] == 2.0
