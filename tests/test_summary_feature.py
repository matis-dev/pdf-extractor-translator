
import pytest
from playwright.sync_api import Page, expect

def test_summary_workflow(page: Page, live_server_url):
    """
    Verify the AI Summarization workflow:
    1. Open PDF
    2. Click Summarize
    3. Verify Modal opens
    4. Verify 'Executive' (Brief) summary generated
    5. Switch to 'Detailed'
    6. Verify 'Detailed' summary generated
    """
    # 1. Open PDF Editor
    # process_request is usually POST, but editor is GET /editor/<filename>
    # We need a file first. Let's assume one exists or upload one.
    # Using a known test file would be best.
    
    # Upload a dummy PDF first (mocking the upload flow or just going to editor if file exists)
    # For e2e, we often rely on a fixture to seed data, or we just use the editor with a mock file.
    
    # Let's try to verify if the server is up and we can reach the editor with a filename
    page.goto(f"{live_server_url}/editor/dummy.pdf")
    
    # Mock the /ai/index and /ai/summarize responses to avoid actual LLM calls (flaky/slow)
    page.route("**/ai/index", lambda route: route.fulfill(
        status=200, 
        content_type="application/json", 
        body='{"success": true, "chunks_indexed": 5}'
    ))
    
    page.route("**/ai/summarize", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"summary": "This is a **brief summary** of the document.\\n\\n- Point 1 [Page 1]\\n- Point 2 [Page 2]", "mode": "brief"}'
    ))
    
    # 2. Click Summarize (assuming button exists in ribbon-tab-ai)
    # First ensure we are on AI tab if needed, or find button directly
    # The ribbon usually starts on 'Home' or 'Edit'.
    # We might need to click 'AI' tab first.
    
    # Check if AI tab exists
    if page.locator("#ribbon-tab-ai").is_visible():
        page.click("#ribbon-tab-ai")
    
    # Click Summarize Button
    # ID was said to be #summarize-doc in checks
    page.click("#summarize-doc")
    
    # 3. Verify Modal
    expect(page.locator("#summaryModal")).to_be_visible()
    expect(page.locator("#status-text")).to_contain_text("Generating brief summary")
    
    # Wait for response
    # The modal content should contain the summary
    expect(page.locator("#summary-content")).to_contain_text("This is a brief summary")
    
    # 4. Verify Page Links
    expect(page.locator(".page-ref").first).to_contain_text("Page 1")
    
    # 5. Switch to Detailed
    # Update mock for detailed
    page.route("**/ai/summarize", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"summary": "## Section 1\\nDetailed content here with [Page 1].", "mode": "detailed"}'
    ))
    
    page.click("button:text('Detailed')")
    
    # Verify update
    expect(page.locator("#summary-content")).to_contain_text("Section 1")

