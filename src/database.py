
import sqlite3
import os
from pathlib import Path
from datetime import datetime

DB_PATH = Path("pdf_metadata.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS document_state (
            filename TEXT PRIMARY KEY,
            current_page INTEGER DEFAULT 1,
            zoom_level REAL DEFAULT 1.0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def get_document_state(filename):
    conn = get_db_connection()
    state = conn.execute('SELECT * FROM document_state WHERE filename = ?', (filename,)).fetchone()
    conn.close()
    if state:
        return dict(state)
    return None

def update_document_state(filename, current_page, zoom_level):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO document_state (filename, current_page, zoom_level, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
            current_page = excluded.current_page,
            zoom_level = excluded.zoom_level,
            updated_at = excluded.updated_at
    ''', (filename, current_page, zoom_level, datetime.now()))
    conn.commit()
    conn.close()
