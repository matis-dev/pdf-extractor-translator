import re
import os
import pytest
from playwright.sync_api import Page, expect

def test_ai_chat_ui_flow(page: Page, live_server_url):
    """Test AI Chat UI open/close and message interaction."""
    # Use a dummy PDF for uploading
    from reportlab.pdfgen import canvas
    pdf_name = "ai_chat_test.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "AI Chat Test Content")
    c.save()

    # We need to mock the AI status endpoints because real Ollama might not be running
    # Playwright's route interception is perfect for this.
    
    # Mock /ai/status (Initial check)
    def handle_status(route):
        route.fulfill(json={
            'available': True,
            'ollama_running': True,
            'models': {'available_models': ['llama3.2:1b']},
            'langchain_installed': True
        })

    # Mock /ai/index (Indexing document)
    def handle_index(route):
        route.fulfill(json={
            'success': True,
            'chunks_indexed': 5,
            'message': 'Indexed successfully'
        })

    # Mock /ai/ask (Asking question)
    def handle_ask(route):
        data = route.request.post_data_json
        question = data.get('question', '')
        route.fulfill(json={
            'answer': f"Mock AI Answer to: {question}",
            'sources': [{'page': 1, 'content': 'Source content'}]
        })

    try:
        page.route("**/ai/status", handle_status)
        page.route("**/ai/index", handle_index)
        page.route("**/ai/ask", handle_ask)
        
        page.goto(live_server_url)
        
        # Upload file to get to editor
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        
        # Wait for editor initialization
        expect(page.locator("#sidebar")).to_be_visible()
        expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=10000)
        
        # 1. Open Chat
        # The toggle button is #ai-toggle-btn
        expect(page.locator("#ai-toggle-btn")).to_be_visible()
        page.click("#ai-toggle-btn")
        
        # Verify Chat Panel opens
        expect(page.locator("#ai-chat-panel")).to_be_visible()
        expect(page.locator("#ai-chat-panel")).not_to_have_class(re.compile(r"hidden"))
        
        # Verify Status Badge (Mocked as Online/Local)
        expect(page.locator("#ai-status")).to_contain_text("Local")
        expect(page.locator("#ai-status")).to_have_class(re.compile(r"online"))

        # 2. Send Message (Triggers Indexing first)
        page.fill("#ai-question", "Summary?")
        page.click("#ai-send-btn")
        
        # Should see indexing message first (from ai_chat.js logic)
        # "Indexing document..."
        # But wait, logic says "Auto-index if needed".
        # It adds a bot message "Indexing document..."
        expect(page.locator(".ai-message.bot").last).to_contain_text("Indexing complete!", timeout=5000)
        
        # Then it sends the question.
        # Check for answer
        expect(page.locator(".ai-message.bot").last).to_contain_text("Mock AI Answer to: Summary?", timeout=5000)
        
        # 3. Close/Minimize
        page.click("#ai-minimize-btn")
        expect(page.locator("#ai-chat-panel")).to_have_class(re.compile(r"hidden"))
        expect(page.locator("#ai-toggle-btn")).to_be_visible()

    finally:
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass


def test_ai_chat_unavailable(page: Page, live_server_url):
    """Test AI Chat UI when backend is offline."""
    from reportlab.pdfgen import canvas
    pdf_name = "ai_offline.pdf"
    absolute_pdf_path = os.path.abspath(pdf_name)
    c = canvas.Canvas(absolute_pdf_path)
    c.drawString(100, 750, "Content")
    c.save()

    # Mock Offline Status
    def handle_status_offline(route):
        route.fulfill(json={
            'available': False,
            'ollama_running': False,
            'models': {},
            'langchain_installed': True
        })

    try:
        page.route("**/ai/status", handle_status_offline)
        
        page.goto(live_server_url)
        page.set_input_files("input#pdf_file", absolute_pdf_path)
        
        expect(page.locator("#sidebar")).to_be_visible()
        # Wait for init
        expect(page.locator("body")).to_have_attribute("data-main-initialized", "true", timeout=10000)

        # Open Chat
        page.click("#ai-toggle-btn")
        
        # Status should be "Not Running" or "Error"
        expect(page.locator("#ai-status")).to_contain_text("Not Running")
        expect(page.locator("#ai-status")).to_have_class(re.compile(r"offline"))
        
        # Input should be disabled
        expect(page.locator("#ai-question")).to_be_disabled()
        expect(page.locator("#ai-send-btn")).to_be_disabled()

    finally:
        if os.path.exists(absolute_pdf_path):
            try: os.remove(absolute_pdf_path)
            except: pass
