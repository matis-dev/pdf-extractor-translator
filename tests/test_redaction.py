import pytest
from playwright.sync_api import Page, expect

@pytest.mark.e2e
def test_redaction_tool(page: Page, base_url):
    # Load Editor
    page.goto(f"{base_url}/editor/dummy.pdf") # Using dummy.pdf which exists
    
    # Wait for toolbar
    expect(page.locator("#ribbon-content")).to_be_visible()
    
    # Click 'Security' Tab
    page.click("button:has-text('Security')")
    
    # Click Redact Tool
    page.click("#redact")
    
    # Verify cursor
    # Note: Check body cursor style? Hard in playwright sometimes.
    # We can check button active state
    expect(page.locator("#redact")).to_have_class("ribbon-btn active")
    
    # Draw redaction box on page 1
    page_container = page.locator(".page-container[data-page-index='0']")
    expect(page_container).to_be_visible()
    
    # Perform drag
    box = page_container.bounding_box()
    start_x = box['x'] + 100
    start_y = box['y'] + 100
    
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 100, start_y + 50)
    page.mouse.up()
    
    # Check if box exists
    redaction_box = page.locator(".redaction-box").first
    expect(redaction_box).to_be_visible()
    expect(redaction_box).to_contain_text("REDACT")
    
    # Check Apply Button enabled
    apply_btn = page.locator("#apply-redactions-btn")
    expect(apply_btn).to_be_visible()
    expect(apply_btn).not_to_be_disabled()
    
    # Click Apply
    # We need to mock the backend? Or allow it to fail if backend not perfect?
    # Backend IS implemented now. So it should work.
    # However, it involves a confirm dialog.
    
    page.on("dialog", lambda dialog: dialog.accept())
    apply_btn.click()
    
    # It should reload or show toast
    # Wait for reload or success toast
    # If reload happens, URL might stay same but content refreshes.
    # We can check for a specific success message if we added one.
    # In redaction.js: window.showToast("Redaction applied successfully!", "success");
    
    expect(page.locator(".toast-body")).to_contain_text("Redaction applied successfully")

