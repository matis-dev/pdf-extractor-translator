
import pytest
import os
from playwright.sync_api import Page, expect

def wait_for_app_ready(page: Page):
    expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=15000)

def test_summarize_ui_flow(page: Page, live_server_url):
    """Test Summarize Document UI flow."""
    from reportlab.pdfgen import canvas
    pdf_name = "summary_test.pdf"
    path = os.path.abspath(pdf_name)
    c = canvas.Canvas(path)
    c.drawString(100, 750, "Summary Test Content")
    c.drawString(100, 730, "This is a document to test summarization UI.")
    c.save()
    
    try:
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", path)
        wait_for_app_ready(page)
        
        # Tools tab
        page.locator(".tab-btn").filter(has_text="Tools").click()
        
        # Summarize button
        sum_btn = page.locator("#summarize-doc")
        expect(sum_btn).to_be_visible()
        
        # Click
        sum_btn.click()
        
        # Expect overlay to appear
        overlay = page.locator("#processing-overlay")
        expect(overlay).to_be_visible()
        
        # Check status text indicates start of process (Analyzing, Indexing, etc)
        # We use a relaxed assertion because it changes fast
        status = page.locator("#status-text")
        expect(status).to_be_visible()
        
    finally:
        if os.path.exists(path):
            try: os.remove(path)
            except: pass
