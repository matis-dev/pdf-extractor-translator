
import pytest
from playwright.sync_api import Page, expect

def wait_for_app_ready(page: Page):
    """Helper to wait for app initialization."""
    page.wait_for_selector('body[data-main-initialized="true"]', timeout=10000)
    # Wait for PDF viewer
    page.wait_for_selector('#pdf-viewer', timeout=10000)
    # Wait for nav bar
    page.wait_for_selector('#navigation-bar', state="visible", timeout=5000)

class TestNavigationBar:
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, live_server_url):
        # We need a PDF. Upload default dummy
        page.goto(f"{live_server_url}/")
        
        # Unique filename to avoid DB state leakage
        import uuid
        unique_name = f"dummy_{uuid.uuid4().hex[:8]}.pdf"
        dummy_pdf = f"tests/samples/{unique_name}"
        
        import os
        if not os.path.exists("tests/samples"):
             os.makedirs("tests/samples", exist_ok=True)
             
        from reportlab.pdfgen import canvas
        c = canvas.Canvas(dummy_pdf)
        for i in range(5):
             c.drawString(100, 750, f"Page {i+1}")
             c.showPage()
        c.save()

        # Upload
        with page.expect_file_chooser() as fc_info:
            # Click the div that triggers the file input click
            page.locator(".upload-zone").click()
        
        file_chooser = fc_info.value
        file_chooser.set_files(dummy_pdf)
        
        # Wait for editor page load
        wait_for_app_ready(page)
        self.filename = unique_name

    def test_nav_bar_presence(self, page: Page):
        """NAV-003: Verify navigation bar appears."""
        nav_bar = page.locator("#navigation-bar")
        expect(nav_bar).to_be_visible()
        # Ensure it doesn't have the hidden class
        import re
        expect(nav_bar).not_to_have_class(re.compile(r"nav-hidden"))

    def test_page_navigation(self, page: Page):
        """NAV-001, NAV-002: Page tracking and controls."""
        # Initial State
        expect(page.locator("#nav-page-input")).to_have_value("1")
        
        # Next Page
        page.click("#nav-next-page")
        expect(page.locator("#nav-page-input")).to_have_value("2")
        
        # Input Navigation
        page.fill("#nav-page-input", "4")
        page.press("#nav-page-input", "Enter")
        expect(page.locator("#nav-page-input")).to_have_value("4")

    def test_zoom_controls(self, page: Page):
        """NAV-004: Zoom display and input."""
        zoom_disp = page.locator("#nav-zoom-display")
        expect(zoom_disp).to_contain_text("100%")
        
        # Zoom In
        page.click("#nav-zoom-in")
        pass # Depending on implementation, might go to 125%
        # Check logic: 100 * 1.25 = 125
        expect(zoom_disp).to_contain_text("125%")
        
        # Editable Input
        zoom_disp.click()
        # Wait for focus?
        page.wait_for_timeout(100)
        # Select all (handled by JS on focus, but let's be safe)
        # page.keyboard.press("Control+A") 
        # Type new value
        page.keyboard.type("200")
        page.keyboard.press("Enter")
        expect(zoom_disp).to_contain_text("200%")

    def test_zoom_presets(self, page: Page):
        """NAV-005: Dropdown and Fit modes."""
        zoom_disp = page.locator("#nav-zoom-display")
        # Ensure we are not editing
        page.evaluate("document.activeElement.blur()")
        zoom_disp.click()
        
        dropdown = page.locator("#zoom-dropdown")
        expect(dropdown).to_be_visible()
        
        # Click Fit Width
        dropdown.get_by_text("Fit Width").click()
        # Verify mode changed (state check or visual)
        # We can check if dropdown closed
        expect(dropdown).not_to_be_visible()
        
    def test_fullscreen(self, page: Page):
        """NAV-006: Fullscreen toggle."""
        import re
        # Note: Browsers headless play mode might block fullscreen API or not support it fully.
        # usually requires user gesture. We simulate click.
        
        page.click("#nav-fullscreen")
        # Check if body class added
        expect(page.locator("body")).to_have_class(re.compile(r"app-fullscreen"))
        
        page.click("#nav-fullscreen") # Exit
        expect(page.locator("body")).not_to_have_class(re.compile(r"app-fullscreen"))

    def test_auto_hide(self, page: Page):
        """NAV-007: Auto hide after inactivity."""
        import re
        # Verify visible first
        nav_bar = page.locator("#navigation-bar")
        expect(nav_bar).to_be_visible()
        
        # Instead of hard wait, we wait for the class to appear.
        # The app has a 3s timer. Assertion default timeout is usually 5s.
        # So this will poll until it succeeds or timeouts at 5s.
        expect(nav_bar).to_have_class(re.compile(r"nav-hidden"), timeout=6000)
        
        # Move mouse
        page.mouse.move(100, 100)
        # Verify it reappears immediately
        expect(nav_bar).not_to_have_class(re.compile(r"nav-hidden"))
