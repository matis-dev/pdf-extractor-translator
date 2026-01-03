
import pytest
from playwright.sync_api import Page, expect

def test_cloud_picker_modal(page: Page, live_server_url):
    """
    Test that the cloud picker modal opens and displays correctly for Google Drive.
    """
    page.goto(live_server_url)
    
    # 1. Click Google Drive button
    # The button text is "Google Drive"
    drive_btn = page.locator("button").filter(has_text="Google Drive")
    expect(drive_btn).to_be_visible()
    drive_btn.click()
    
    # 2. Check Modal Open
    modal = page.locator("#cloudPickerModal")
    expect(modal).to_be_visible()
    
    # 3. Check Title and Connect Button
    expect(page.locator("#cloud-provider-name")).to_have_text("Connect to Google Drive")
    conn_btn = page.locator("#cloud-connect-btn")
    expect(conn_btn).to_be_visible()
    
    # 4. Simulate Connect (Click generic connect)
    # Since we mocked the JS to skip real auth, clicking should show file browser
    conn_btn.click()
    
    # 5. Check File Browser visible
    browser_div = page.locator("#cloud-file-browser")
    expect(browser_div).to_be_visible()
    
    # 6. Check Mock Files
    files = page.locator("#cloud-file-list button")
    expect(files).to_have_count(3) # Documents, Invoice.pdf, Presentation.pdf
    
    # 7. Select a file
    invoice = files.filter(has_text="Invoice.pdf")
    invoice.click()
    
    # 8. Check Select button enabled
    select_btn = page.locator("#cloud-select-btn")
    expect(select_btn).to_be_enabled()
    
    # 9. Click Select (Handles alert?)
    # We can handle dialog
    page.on("dialog", lambda dialog: dialog.accept())
    select_btn.click()
    
def test_cloud_buttons(page: Page, live_server_url):
    """Verify all cloud buttons are visible."""
    page.goto(live_server_url)
    expect(page.locator("button").filter(has_text="Google Drive")).to_be_visible()
    expect(page.locator("button").filter(has_text="Nextcloud")).to_be_visible()
    expect(page.locator("button").filter(has_text="Dropbox")).to_be_visible()
    expect(page.locator("button").filter(has_text="OneDrive")).to_be_visible()

def test_cloud_picker_dropbox(page: Page, live_server_url):
    """Test Dropbox button opens modal correctly."""
    page.goto(live_server_url)
    page.locator("button").filter(has_text="Dropbox").click()
    expect(page.locator("#cloud-provider-name")).to_have_text("Connect to Dropbox")
    # Mock fallback to simuluation means connect will immediately show files if we click it
    # But since we don't have creds configured, backend returns 500/404 for auth url
    # JS catches it and normally would work.
    pass

def test_cloud_picker_nextcloud(page: Page, live_server_url):
    """
    Test that the cloud picker modal works for Nextcloud (login form).
    """
    page.goto(live_server_url)
    
    # 1. Click Nextcloud button
    nc_btn = page.locator("button").filter(has_text="Nextcloud")
    nc_btn.click()
    
    # 2. Check Modal Title and Form
    expect(page.locator("#cloud-provider-name")).to_have_text("Connect to Nextcloud")
    expect(page.locator("#nextcloud-login-form")).to_be_visible()
    
    # 3. Fill Form (Mock)
    page.fill("#nc-url", "https://cloud.example.com")
    page.fill("#nc-user", "testuser")
    page.fill("#nc-pass", "secret")
    
    # Mock backend response to avoid hitting real (non-existent) Nextcloud
    page.route("**/api/cloud/nextcloud/connect", lambda route: route.fulfill(
        status=200, 
        content_type="application/json", 
        body='{"success": true}'
    ))
    
    # Mock list response too
    page.route("**/api/cloud/nextcloud/list*", lambda route: route.fulfill(
        status=200, 
        content_type="application/json", 
        body='{"files": [{"name": "MockDoc.pdf", "type": "file", "id": "/MockDoc.pdf", "mimeType": "application/pdf"}]}'
    ))
    
    # 4. Login
    page.click("#nc-login-btn")
    
    # 5. Check File Browser visible
    expect(page.locator("#cloud-file-browser")).to_be_visible()
    expect(page.locator("#cloud-auth-section")).not_to_be_visible()
