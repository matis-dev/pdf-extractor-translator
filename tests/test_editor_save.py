import pytest
from playwright.sync_api import Page, expect

@pytest.fixture(scope="module")
def pdf_file(tmp_path_factory):
    """Creates a dummy PDF file for testing."""
    filename = dict(name="test_doc.pdf")
    # We rely on the app to have a sample or just upload one
    # For now, let's assume we can upload from index or just go to editor if we mock the file load
    # Easier: Upload a file on index page
    return filename

def test_editor_save_to_cloud_flow(page: Page, live_server_url):
    """
    Test the 'Save to Cloud' flow in the editor:
    1. Upload PDF
    2. Open Editor
    3. Click Save to Cloud
    4. Select Provider
    5. Verify Picker Save Mode
    """
    
    # 1. Upload File to get to Editor
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.goto(live_server_url)
    
    # Create a dummy PDF file in memory/disk to upload
    with open("test_upload.pdf", "wb") as f:
        f.write(b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Resources <<\n/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]\n>>\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF")
        
    page.set_input_files("input[type='file']", "test_upload.pdf")
    
    # Wait for editor to load
    expect(page.locator("text=PDF Editor")).to_be_visible(timeout=10000)
    
    # Debug: Print tabs
    tabs = page.locator(".tab-btn").all_text_contents()
    print(f"Tabs found: {tabs}")
    
    # 2. Click Home Tab (File group is in Home)
    page.locator(".tab-btn").filter(has_text="Home").click()
    
    # Debug: Print Ribbon Content
    ribbon_text = page.locator("#ribbon-content").inner_text()
    print(f"Ribbon Content: {ribbon_text}")
    print(f"Buttons: {page.locator('.ribbon-btn').all_inner_texts()}")
    
    # 3. Click Save to Cloud button
    save_btn = page.locator("#save-cloud-btn")
    expect(save_btn).to_be_visible()
    save_btn.click()
    
    # 4. Verify Provider Selection Modal
    provider_modal = page.locator("#save-cloud-provider-modal")
    expect(provider_modal).to_be_visible()
    
    # 5. Select Google Drive (This opens the Cloud Picker, DOES NOT start OAuth yet)
    # Mock the auth check to avoid popup being blocked or failing
    page.route("**/auth/google/url", lambda route: route.fulfill(
        status=200, 
        body='{"url": "about:blank"}'
    ))
    
    # Mock the file list to ensure we see "Save Here"
    page.route("**/api/cloud/google/list*", lambda route: route.fulfill(
        status=200, 
        body='{"files": [{"id": "folder1", "name": "My Folder", "mimeType": "application/vnd.google-apps.folder", "type": "folder"}]}'
    ))
    
    # Click Google Drive in Provider Modal
    provider_modal.locator("button").filter(has_text="Google Drive").click()
    
    # 6. Verify Picker in Save Mode (Auth Section)
    picker_modal = page.locator("#cloudPickerModal")
    expect(picker_modal).to_be_visible()
    
    # Debug: Title
    print(f"Modal Title: {picker_modal.locator('.modal-title').inner_text()}")
    
    expect(picker_modal.locator(".modal-title")).to_have_text("Save to Cloud")
    expect(picker_modal.locator("#cloud-provider-name")).to_have_text("Save to Google Drive")
    
    # Click Connect Button to Start OAuth
    connect_btn = picker_modal.locator("#cloud-connect-btn")
    expect(connect_btn).to_be_visible()
    
    with page.expect_popup() as popup_info:
        connect_btn.click()
    
    # Simulate Auth Success Message
    page.evaluate("window.postMessage({type: 'GOOGLE_AUTH_SUCCESS'}, '*')")
    
    # 7. Verify File List and Save Here Button
    save_here_btn = page.locator("#cloud-action-btn")
    expect(save_here_btn).to_be_visible()
    expect(save_here_btn).to_have_text("Save Here")
    
    # 8. Mock Upload Endpoint
    page.route("**/api/cloud/google/upload", lambda route: route.fulfill(
        status=200,
        body='{"success": true, "fileId": "new_id"}'
    ))
    
    # 8. Click Save Here
    save_here_btn.click()
    
    # 9. Verify Success Alert (Mocked via dialog or we check modal closes)
    # The code uses alert(), so we handle dialog
    page.on("dialog", lambda d: d.accept())
    
    # Expect modal to close
    expect(picker_modal).not_to_be_visible()
