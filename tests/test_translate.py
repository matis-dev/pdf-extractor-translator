
import pytest
import os
from playwright.sync_api import Page, expect

# Helper from test_frontend.py
def wait_for_app_ready(page: Page):
    expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=15000)

def test_translate_ui_flow(page: Page, live_server_url):
    """Test that the Translate Document UI works correctly."""
    
    # 1. Create a dummy PDF to upload (standard practice in these tests)
    from reportlab.pdfgen import canvas
    pdf_name = "translate_test.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "Translation Test")
    c.save()
    
    try:
        # 2. Go to home page
        page.goto(live_server_url)
        
        # 3. Upload file to get to editor
        # The input ID is usually #pdf_file based on test_frontend.py
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        
        # 4. Wait for editor to load
        wait_for_app_ready(page)
        expect(page.locator("#ribbon-container")).to_be_visible()
        
        # 5. Switch to 'Tools' tab
        tools_tab = page.locator(".tab-btn:has-text('Tools')")
        expect(tools_tab).to_be_visible()
        tools_tab.click()
        
        # 6. Verify Translate Button
        translate_btn = page.locator("#translate-doc")
        expect(translate_btn).to_be_visible()
        
        # 7. Click Translate Button
        translate_btn.click()
        
        # 8. Verify Modal opens
        modal = page.locator("#translateDocumentModal")
        expect(modal).to_be_visible()
        
        # 9. Verify Dropdowns
        expect(page.locator("#translate-source-lang")).to_be_visible()
        expect(page.locator("#translate-target-lang")).to_be_visible()
        
        # 10. Close modal
        page.locator("#translateDocumentModal .btn-close").click()
        expect(modal).not_to_be_visible()

    finally:
        # Cleanup
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
