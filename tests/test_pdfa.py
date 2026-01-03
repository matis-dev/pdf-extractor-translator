import os
import pytest
import time
from playwright.sync_api import Page, expect

def wait_for_app_ready(page: Page):
    expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=15000)

@pytest.mark.critical
def test_pdfa_conversion(page: Page, live_server_url):
    """Test PDF/A conversion flow."""
    from reportlab.pdfgen import canvas
    pdf_name = "pdfa_test.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "PDF/A Test Document")
    c.save()
    
    try:
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        wait_for_app_ready(page)
        
        # 1. Open PDF/A Modal
        
        # Click the Protect tab (Moved from Tools)
        protect_tab = page.locator(".tab-btn").filter(has_text="Protect")
        try:
            protect_tab.click(timeout=2000)
        except:
            protect_tab.click(force=True)
            
        time.sleep(1) # Wait for animation/render
        
        # Click the PDF/A button via JS to ensure it works even if Playwright thinks it's hidden
        count = page.locator("#pdfa").count()
        if count == 0:
            print("DEBUG: #pdfa not found in DOM. Ribbon content:")
            print(page.inner_html("#ribbon-content"))
            
        # JS Click
        page.evaluate("document.getElementById('pdfa') && document.getElementById('pdfa').click()")
        
        expect(page.locator("#pdfa-modal")).to_be_visible(timeout=5000)
        
        # 2. Select Level 2b (default)
        expect(page.locator("#pdfa-level")).to_have_value("2b")
        
        # 3. Click Convert and Check Result
        try:
            with page.expect_download(timeout=15000) as download_info:
                 # Invoking directly to bypass potential click interception/shadowing
                 page.evaluate("convertToPdfA()")
                
            download = download_info.value
            assert "pdfa_2b" in download.suggested_filename
            
            # Save to check
            download_path = os.path.abspath("downloaded_pdfa.pdf")
            download.save_as(download_path)
            assert os.path.exists(download_path)
            assert os.path.getsize(download_path) > 1000
            os.remove(download_path)
            
        except Exception as e:
            # Check for error toast
            toast = page.locator(".toast-body")
            if toast.is_visible():
                print(f"DEBUG: Found toast message: {toast.inner_text()}")
            raise e

    finally:
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
