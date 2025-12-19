
import pytest
import os
from playwright.sync_api import Page, expect

def test_command_palette_opens(page: Page, live_server_url):
    """Test that Ctrl+K opens the command palette."""
    from reportlab.pdfgen import canvas
    pdf_name = "cmd_test.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "Command Palette Test")
    c.save()

    try:
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        
        # Wait for editor
        expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=10000)
        
        # Press Ctrl+K
        page.keyboard.press("Control+k")
        
        # Check modal visibility
        expect(page.locator("#command-palette-modal")).to_be_visible()
        expect(page.locator("#cmd-search")).to_be_focused()
        
        # Search for "Dark Mode"
        page.fill("#cmd-search", "Dark Mode")
        
        # Check results
        expect(page.locator(".cmd-item").first).to_contain_text("Toggle Dark Mode")
        
        # Execute command (Dark Mode)
        page.keyboard.press("Enter")
        
        # Modal should close
        expect(page.locator("#command-palette-modal")).not_to_be_visible()
        
        # Verify Dark Mode toggled
        expect(page.locator("body")).to_have_attribute("data-theme", "dark")
        
    finally:
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
