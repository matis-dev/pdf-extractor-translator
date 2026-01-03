
import pytest
from playwright.sync_api import Page, expect
import json

def test_settings_modal_opens(page: Page):
    """Test that the settings modal opens when clicking the gear icon."""
    page.goto('http://localhost:8083')
    
    # Wait for page readiness
    page.wait_for_selector('body[data-main-initialized="true"]')
    
    # Click settings button (gear icon in header)
    page.click('button[data-bs-target="#settingsModal"]')
    
    # Verify modal is visible
    expect(page.locator('#settingsModal')).to_be_visible()
    
    # Verify title
    expect(page.locator('#settingsModalLabel')).to_contain_text('Settings')

def test_settings_modal_tabs(page: Page):
    """Test tab switching in settings modal."""
    page.goto('http://localhost:8083')
    page.click('button[data-bs-target="#settingsModal"]')
    expect(page.locator('#settingsModal')).to_be_visible()
    
    # Default tab should be General
    expect(page.locator('#tab-general')).to_have_class(token='active')
    expect(page.locator('#settings-general')).to_be_visible()
    
    # Switch to Shortcuts
    page.click('#tab-shortcuts')
    expect(page.locator('#tab-shortcuts')).to_have_class(token='active')
    expect(page.locator('#settings-shortcuts')).to_be_visible()
    expect(page.locator('#settings-general')).not_to_be_visible()

    # Switch to PDF Defaults
    page.click('#tab-pdf-defaults')
    expect(page.locator('#tab-pdf-defaults')).to_have_class(token='active')
    expect(page.locator('#settings-pdf-defaults')).to_be_visible()

def test_settings_persistence(page: Page):
    """Test that settings are saved to localStorage and persist."""
    page.goto('http://localhost:8083')
    page.click('button[data-bs-target="#settingsModal"]')
    
    # Change Theme to Dark
    page.select_option('#setting-theme', 'dark')
    
    # Save
    page.click('#save-settings-btn')
    
    # Modal should close
    expect(page.locator('#settingsModal')).not_to_be_visible()
    
    # Verify localStorage for Theme
    settings_json = page.evaluate("localStorage.getItem('pdf_editor_settings')")
    assert settings_json is not None
    settings = json.loads(settings_json)
    assert settings['general']['theme'] == 'dark'
    
    # Reload page
    page.reload()
    page.wait_for_selector('body[data-main-initialized="true"]')
    
    # Open modal again and check value
    page.click('button[data-bs-target="#settingsModal"]')
    expect(page.locator('#setting-theme')).to_have_value('dark')

def test_pdf_defaults_persistence(page: Page):
    """Test that PDF default metadata persistence works."""
    page.goto('http://localhost:8083')
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-pdf-defaults')
    
    # Fill inputs
    page.fill('#setting-pdf-author', 'Test Author')
    page.fill('#setting-pdf-creator', 'Test Creator')
    
    # Save
    page.click('#save-settings-btn')
    expect(page.locator('#settingsModal')).not_to_be_visible()
    
    # Verify localStorage
    settings_json = page.evaluate("localStorage.getItem('pdf_editor_settings')")
    settings = json.loads(settings_json)
    assert settings['pdf']['defaultAuthor'] == 'Test Author'
    assert settings['pdf']['defaultCreator'] == 'Test Creator'
    
    # Reload and verify pre-fill
    page.reload()
    page.click('button[data-bs-target="#settingsModal"]')
    page.click('#tab-pdf-defaults')
    expect(page.locator('#setting-pdf-author')).to_have_value('Test Author')
    expect(page.locator('#setting-pdf-creator')).to_have_value('Test Creator')
    # Default Producer should be the default one if not changed? 
    # Logic says: if input is present, it takes value. Default value in logic is 'PDF Editor v1.0'.
    # settings.js binds existing currentSettings or defaults.
    # The input placeholer is just a placeholder.
    # If I didn't touch Producer, it should have default value in state (PDF Editor v1.0).
    # But does the input show it?
    # settings.js: if (pdfProducer) pdfProducer.value = currentSettings.pdf.defaultProducer || '';
    # currentSettings starts with 'PDF Editor v1.0'.
    # So input should have that value.
    expect(page.locator('#setting-pdf-producer')).to_have_value('PDF Editor v1.0')
