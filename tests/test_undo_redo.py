
import pytest
import os
import time
from playwright.sync_api import Page, expect

def wait_for_app_ready(page: Page):
    expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=15000)

def test_undo_redo_notes_flow(page: Page, live_server_url):
    """Test Undo/Redo for Notes."""
    from reportlab.pdfgen import canvas
    pdf_name = "history_test.pdf"
    path = os.path.abspath(pdf_name)
    c = canvas.Canvas(path)
    c.drawString(100, 750, "History Test")
    c.save()
    
    try:
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", path)
        page.wait_for_url("**/editor/*")
        wait_for_app_ready(page)
        
        # Add Note
        # Ensure 'Comment' tab is active for Note button.
        page.locator(".tab-btn").filter(has_text="Comment").click()
        
        page.locator("#note").click() 
        page.mouse.click(200, 200) 
        
        note = page.locator(".note-annotation")
        expect(note).to_be_visible()
        
        # Get location
        box1 = note.bounding_box()
        
        # Move Note
        header = note.locator(".note-header")
        header.hover()
        page.mouse.down()
        page.mouse.move(box1['x'] + 100, box1['y'] + 100, steps=10)
        page.mouse.up()
        
        # Check moved
        box2 = note.bounding_box()
        assert box2['x'] > box1['x']
        
        # Undo Move
        page.locator(".tab-btn").filter(has_text="Edit").click()
        page.locator("button[title='Undo']").click()
        # Give JS time to animate/update
        time.sleep(0.5) 
        
        box3 = note.bounding_box()
        # Should be back to box1
        assert abs(box3['x'] - box1['x']) < 5
        
        # Undo Creation
        page.locator("button[title='Undo']").click()
        time.sleep(0.5)
        
        expect(note).not_to_be_visible()
        
        # Redo Creation
        page.locator("button[title='Redo']").click()
        time.sleep(0.5)
        
        expect(note).to_be_visible()
        
    finally:
        if os.path.exists(path):
            try: os.remove(path)
            except: pass
