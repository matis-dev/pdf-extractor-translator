
import os
import pytest
from playwright.sync_api import Page, expect
import re

def test_forms_tab_ui(page: Page, live_server_url):
    """Test Forms tab presence and basic field placement."""
    # Use existing dummy pdf
    pdf_path = os.path.abspath("tests/resources/dummy.pdf")
    
    page.goto(live_server_url)
    page.set_input_files("input#pdf_file", pdf_path)

    # Check redirect
    expect(page).to_have_url(re.compile(r".*/editor/dummy.pdf"))
    
    # Wait for editor
    expect(page.locator("#sidebar")).to_be_visible(timeout=15000)
    
    # 1. Click "Forms" tab
    page.locator(".tab-btn").filter(has_text="Forms").click()
    
    # 2. Verify Field Buttons
    expect(page.locator("#field-text")).to_be_visible()
    expect(page.locator("#field-check")).to_be_visible()
    expect(page.locator("#field-radio")).to_be_visible()
    expect(page.locator("#field-dropdown")).to_be_visible()
    expect(page.locator("#field-signature")).to_be_visible()
    
    # 3. Place Text Field
    page.locator("#field-text").click()
    
    # Wait for page container
    page.locator(".page-container").first.wait_for(state="visible", timeout=10000)

    # Click upon page via JS to ensure event firing (native click can be flaky with overlays)
    page.evaluate("""
        const container = document.querySelector('.page-container');
        const rect = container.getBoundingClientRect();
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 100,
            clientY: rect.top + 100
        });
        container.dispatchEvent(event);
    """)
    
    # Verify wrapper exists
    expect(page.locator(".form-field-wrapper[data-type='textfield']")).to_be_visible()
    
    # 4. Place Checkbox
    page.locator("#field-check").click()
    
    page.evaluate("""
        const container = document.querySelector('.page-container');
        const rect = container.getBoundingClientRect();
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 100,
            clientY: rect.top + 200
        });
        container.dispatchEvent(event);
    """)
    expect(page.locator(".form-field-wrapper[data-type='checkbox']")).to_be_visible()
    
    # 5. Test Styling Control Presence
    # Change Font
    expect(page.locator("select[onchange^='updateFormSettings']")).to_be_visible()
    
    # 6. Save and Verify
    print("DEBUG: Saving")
    # Switch back to Home tab to find Save button
    page.locator(".tab-btn").filter(has_text="Home").click()
    page.locator("#save-btn").click()
    expect(page.locator(".toast-body")).to_contain_text("Changes saved successfully!")
