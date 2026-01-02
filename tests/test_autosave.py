import os
import pytest
import time
from playwright.sync_api import Page, expect

def wait_for_app_ready(page: Page):
    expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=15000)

@pytest.mark.critical
def test_autosave_recovery_modal(page: Page, live_server_url):
    """Test autosave, crash (reload), and recovery modal appearance."""
    from reportlab.pdfgen import canvas
    pdf_name = "autosave_modal_test.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "Autosave Modal Test")
    c.save()
    
    try:
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        wait_for_app_ready(page)
        
        # 1. Trigger Autosave manually (even without changes, it should save current state)
        page.evaluate("async () => await window.saveDraft()")
        time.sleep(1) 
        
        # 2. Reload page (Simulate crash/close)
        page.reload()
        wait_for_app_ready(page)
        
        # 3. Check for Recovery Modal
        expect(page.locator("#recovery-modal")).to_be_visible(timeout=10000)
        expect(page.locator("#recovery-modal .modal-body")).to_contain_text("unsaved draft")
        
        # 4. Click Restore
        page.click("#btn-restore-draft")
        
        # 5. Verify Success Toast (implied by restoreDraft calling showToast)
        expect(page.locator(".toast-body")).to_contain_text("Draft restored", timeout=5000)
        
        # Clean up
        page.evaluate("window.clearDraft()")
        
    finally:
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
            
def test_autosave_discard_modal(page: Page, live_server_url):
    """Test discarding a draft."""
    from reportlab.pdfgen import canvas
    pdf_name = "autosave_discard_modal.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "Discard Modal Test")
    c.save()
    
    try:
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        wait_for_app_ready(page)
        
        # Create draft
        page.evaluate("async () => await window.saveDraft()")
        time.sleep(1)
        
        # Reload
        page.reload()
        wait_for_app_ready(page)
        
        # Expect Modal
        expect(page.locator("#recovery-modal")).to_be_visible()
        
        # Click Discard
        page.click("#btn-discard-draft")
        
        # Verify Toast or just absence of modal
        expect(page.locator("#recovery-modal")).not_to_be_visible()
        # Verify draft is gone by reloading again?
        # If I reload again and NO modal appears, then discard worked.
        page.reload()
        wait_for_app_ready(page)
        expect(page.locator("#recovery-modal")).not_to_be_visible()
        
    finally:
         if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
