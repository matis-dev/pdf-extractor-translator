
import pytest
from playwright.sync_api import Page, expect

def test_shortcuts_ui_renders(page: Page):
    """Test that the shortcuts tab renders populated list."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-shortcuts')
    
    # Check if list is populated
    # At least keys like 'Save Changes', 'Undo' should be there
    expect(page.locator('#shortcuts-list')).to_contain_text("Save Changes")
    expect(page.locator('#shortcuts-list')).to_contain_text("Undo")
    
    # Check default key display
    # Undo should depend on OS? The default logic uses 'Ctrl+Z'
    # The rendered text is inside <kbd>
    expect(page.locator('#shortcuts-list')).to_contain_text("Ctrl+Z")

def test_shortcut_filtering(page: Page):
    """Test searching for shortcuts."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-shortcuts')
    
    # Search for "Redo"
    page.fill('#shortcut-search', 'Redo')
    
    # List should contain Redo and not Undo
    expect(page.locator('#shortcuts-list')).to_contain_text("Redo")
    expect(page.locator('#shortcuts-list')).not_to_contain_text("Undo")

def test_capture_overlay(page: Page):
    """Test clicking change opens capture overlay."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-shortcuts')
    
    # Click Change on first item (Save)
    # The items are sorted. 'Add ...' comes first usually?
    # Actually sort is by name. 'Add Form Checkbox'...
    # Let's target 'Save Changes' specifically.
    # We can iterate or just assume 'Save Changes' is there.
    # Let's just click the first .change-shortcut button.
    page.click('.change-shortcut >> nth=0')
    
    expect(page.locator('#shortcut-capture-overlay')).to_be_visible()
    expect(page.locator('#captured-combo-display')).to_contain_text("Press keys...")
    
    # Click Cancel
    page.click('#cancel-capture-btn')
    expect(page.locator('#shortcut-capture-overlay')).not_to_be_visible()

def test_custom_shortcut_workflow(page: Page):
    """Test customizing a shortcut and verifying it works."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-shortcuts')
    
    # Find Undo row (assume it exists)
    # We need to find the row that has 'Undo' text
    # Locator with has_text='Undo'
    undo_row = page.locator('.list-group-item', has_text='Undo')
    undo_row.locator('.change-shortcut').click()
    
    # Capture new key: Ctrl+Shift+U
    # Simulate key press on body
    # Using keyboard.press might trigger it if focus is right.
    # The overlay doesn't focus an input, it listens on body.
    # But settings modal might trap focus? 
    # settings.js: captureKeybind(document.body)
    # So pressing keys on page should work.
    page.keyboard.press('Control+Shift+U')
    
    # Verify display
    expect(page.locator('#captured-combo-display')).to_contain_text("Ctrl+Shift+U")
    
    # Confirm
    page.click('#confirm-capture-btn')
    expect(page.locator('#shortcut-capture-overlay')).not_to_be_visible()
    
    # Verify list update
    expect(undo_row).to_contain_text("Ctrl+Shift+U")
    
    # Close modal
    page.click('button[data-bs-dismiss="modal"]')
    
    # Verify functionality: 
    # Create an action to undo. 
    # 1. Add text
    page.click('#mode-text') # activates text mode
    page.mouse.click(100, 100) # add text box
    # This adds text annotation.
    # Now undo using new shortcut.
    page.keyboard.press('Control+Shift+U')
    
    # Verify text annotation is gone?
    # Or checking history stack length?
    # Let's check history button state?
    # If undo worked, redo button should be enabled.
    expect(page.locator('#redo-btn')).not_to_be_disabled()
