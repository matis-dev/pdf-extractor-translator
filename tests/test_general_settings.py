
import pytest
from playwright.sync_api import Page, expect

def test_general_settings_ui(page: Page):
    """Test that general settings UI elements (theme, compact mode) are visible."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    
    page.click('button[data-bs-target="#settingsModal"]')
    # General tab is default
    
    # Check Theme Radio Group
    expect(page.locator('label[for="theme-light"]')).to_be_visible()
    expect(page.locator('label[for="theme-dark"]')).to_be_visible()
    expect(page.locator('label[for="theme-auto"]')).to_be_visible()
    
    # Check Compact Mode Toggle
    expect(page.locator('label[for="compact-mode"]')).to_be_visible()
    
    # Check About Section
    expect(page.locator('text=Version: v1.0.0')).to_be_visible()

def test_theme_switch(page: Page):
    """Test switching themes."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    page.click('button[data-bs-target="#settingsModal"]')
    
    # Initial state (default light)
    # Check body attribute
    # Note: 'light' removes data-theme attribute
    expect(page.locator('body')).not_to_have_attribute('data-theme', 'dark')
    
    # Switch to Dark
    page.click('label[for="theme-dark"]')
    
    # Save
    page.click('#save-settings-btn')
    
    # Verify dark theme applied
    expect(page.locator('body')).to_have_attribute('data-theme', 'dark')
    
    # Reload and verify persistence
    page.reload() 
    expect(page.locator('body')).to_have_attribute('data-theme', 'dark')
    
    # Open modal, verify Dark is checked
    page.click('button[data-bs-target="#settingsModal"]')
    expect(page.locator('#theme-dark')).to_be_checked()

def test_compact_mode_toggle(page: Page):
    """Test compact mode toggle."""
    page.goto('http://localhost:8083')
    page.wait_for_selector('body[data-main-initialized="true"]')
    page.click('button[data-bs-target="#settingsModal"]')
    
    # Toggle Compact Mode ON
    page.click('label[for="compact-mode"]')
    
    # Save
    page.click('#save-settings-btn')
    
    # Verify class added to body
    expect(page.locator('body')).to_have_class(token='compact-mode')
    
    # Reload and verify persistence
    page.reload()
    expect(page.locator('body')).to_have_class(token='compact-mode')
    
    # Open modal, verify checked
    page.click('button[data-bs-target="#settingsModal"]')
    expect(page.locator('#compact-mode')).to_be_checked()
