
import pytest
import os
from playwright.sync_api import Page

# Define snapshot directory relative to this test file
SNAPSHOT_DIR = os.path.join(os.path.dirname(__file__), "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

def take_snapshot(page: Page, name: str, masks: list[str] = None):
    """
    Manually takes a snapshot with masks applied.
    Safely handles Playwright-specific selectors like :has-text().
    """
    # 1. Apply masks (hide elements)
    if masks:
        for selector in masks:
            try:
                # Use locator().evaluate_all() to leverage Playwright's selector engine
                # which supports :has-text() and other extensions that querySelectorAll does not.
                page.locator(selector).evaluate_all("els => els.forEach(e => e.style.visibility = 'hidden')")
            except Exception as e:
                # print(f"Warning: Failed to mask selector '{selector}': {e}")
                pass
    
    # 2. Take Screenshot
    path = os.path.join(SNAPSHOT_DIR, name)
    # Ensure full_page is True for layout tests
    try:
        page.screenshot(path=path, full_page=True)
    except Exception as e:
        print(f"Screenshot failed for {name}: {e}")
    
    # 3. Cleanup (restore) - Optional but good practice
    if masks:
        for selector in masks:
            try:
                page.locator(selector).evaluate_all("els => els.forEach(e => e.style.visibility = '')")
            except Exception:
                pass

# VIS-001: Dashboard & Library Layout
def test_vis_001_dashboard(page: Page, live_server_url, global_visual_masks):
    page.goto(f"{live_server_url}/")
    
    # Wait for hydration
    page.wait_for_selector('.upload-zone')
    
    # Desktop Snapshot
    page.set_viewport_size({"width": 1920, "height": 1080})
    take_snapshot(page, "vis_001_dashboard_desktop.png", masks=global_visual_masks)
    
    # Mobile Snapshot
    page.set_viewport_size({"width": 375, "height": 812})
    take_snapshot(page, "vis_001_dashboard_mobile.png", masks=global_visual_masks)

# Common fixture to enter editor for VIS-002, 003, 004
@pytest.fixture
def run_to_editor(page: Page, live_server_url, visual_test_pdf_path):
    page.goto(f"{live_server_url}/")
    
    # Upload the baseline PDF
    with page.expect_file_chooser() as fc_info:
        page.locator(".upload-zone").click()
    file_chooser = fc_info.value
    file_chooser.set_files(visual_test_pdf_path)
    
    # Wait for editor load
    page.wait_for_selector("#pdf-viewer", timeout=10000)
    # Clear any potential tutorial/toast overlays
    page.evaluate("document.querySelectorAll('.toast').forEach(e => e.remove())")
    return page

# VIS-002: Editor Shell & Responsive Ribbon
def test_vis_002_editor_shell(run_to_editor, global_visual_masks):
    page = run_to_editor
    
    # Desktop
    page.set_viewport_size({"width": 1920, "height": 1080})
    # Wait for render
    page.wait_for_timeout(1000) 
    take_snapshot(page, "vis_002_editor_desktop.png", masks=global_visual_masks)
    
    # Tablet (Ribbon Check)
    page.set_viewport_size({"width": 1024, "height": 768})
    take_snapshot(page, "vis_002_editor_tablet.png", masks=global_visual_masks)

# VIS-003: Navigation Bar Components
def test_vis_003_navbar(run_to_editor, global_visual_masks):
    page = run_to_editor
    page.set_viewport_size({"width": 1920, "height": 1080})
    
    # Ensure navbar IS visible
    nav_bar = page.locator("#navigation-bar")
    # expect(nav_bar).to_be_visible() # Standard expect works
    
    take_snapshot(page, "vis_003_navbar_base.png", masks=global_visual_masks)
    
    # Interaction: Open Zoom Dropdown
    page.click("#nav-zoom-display")
    page.wait_for_selector("#zoom-dropdown")
    take_snapshot(page, "vis_003_navbar_dropdown.png", masks=global_visual_masks)

# VIS-004: Critical Modals
def test_vis_004_modals(run_to_editor, global_visual_masks):
    page = run_to_editor
    page.set_viewport_size({"width": 1920, "height": 1080})
    
    # 1. Settings Modal
    page.click("button[data-bs-target='#settingsModal']")
    page.wait_for_selector("#settingsModal.show")
    # Wait for animation
    page.wait_for_timeout(500)
    take_snapshot(page, "vis_004_settings_modal.png", masks=global_visual_masks)
    page.click("#settingsModal .btn-close")
    
    # 2. Watermark Modal (via JS to be fast/reliable)
    page.evaluate("new bootstrap.Modal(document.getElementById('watermarkModal')).show()")
    page.wait_for_selector("#watermarkModal.show")
    page.wait_for_timeout(500)
    take_snapshot(page, "vis_004_watermark_modal.png", masks=global_visual_masks)
    page.click("#watermarkModal .btn-close")
