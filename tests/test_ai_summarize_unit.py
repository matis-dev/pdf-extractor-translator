import pytest
from unittest.mock import MagicMock, patch
import json

# Try importing from src if needed, or rely on conftest path mgmt
try:
    from ai_utils import LocalPDFChat
except ImportError:
    from src.ai_utils import LocalPDFChat

# --- Phase 1: Analysis & Mocking Strategy ---
# We isolate LocalPDFChat from ChromaDB and Ollama using patches.
# We create a MockDoc helper to simulate LangChain Documents.

class MockDoc:
    def __init__(self, content, page):
        self.page_content = content
        self.metadata = {"page": page}

@pytest.fixture
def mock_chat_instance():
    """
    Creates a LocalPDFChat instance with completely mocked dependencies.
    """
    # Patch all major dependencies used in __init__
    with patch("ai_utils.OllamaEmbeddings"), \
         patch("ai_utils.ChatOllama"), \
         patch("ai_utils.RecursiveCharacterTextSplitter"):
        
        chat = LocalPDFChat()
        
        # Inject mocks for internal state usually set by index_pdf
        chat.vectorstore = MagicMock()
        chat.retriever = MagicMock()
        chat.llm = MagicMock()
        
        return chat

# --- Phase 2: Test Implementation (The Code) ---

describe_summarize = "LocalPDFChat.summarize_document"

def test_summarize_no_index_raises_error(mock_chat_instance):
    """
    it('should raise ValueError when no document is indexed')
    """
    # Arrange
    mock_chat_instance.vectorstore = None
    
    # Act & Assert
    with pytest.raises(ValueError, match="No document indexed"):
        mock_chat_instance.summarize_document()

def test_summarize_brief_flow(mock_chat_instance):
    """
    it('should generate a brief summary with page citations')
    """
    # Arrange
    mock_docs = [
        MockDoc("Introduction to the topic...", 0), 
        MockDoc("Conclusion and final thoughts...", 9)
    ]
    # Configure mock retriever
    mock_chat_instance.retriever.invoke.return_value = mock_docs
    
    # Configure mock LLM response
    mock_response = MagicMock()
    mock_response.content = "Brief summary with [Page 1] and [Page 10]."
    mock_chat_instance.llm.invoke.return_value = mock_response
    
    # Act
    result = mock_chat_instance.summarize_document(mode="brief")
    
    # Assert
    assert result["summary"] == "Brief summary with [Page 1] and [Page 10]."
    assert result["mode"] == "brief"
    assert "error" not in result
    
    # Verify Prompt Construction
    args, _ = mock_chat_instance.llm.invoke.call_args
    prompt_sent = args[0]
    
    # Check context injection
    assert "[Page 1] Introduction" in prompt_sent
    assert "[Page 10] Conclusion" in prompt_sent
    
    # Check System Prompt
    assert "Executive Summary" in prompt_sent
    assert "structured bullet points" in prompt_sent

def test_summarize_detailed_flow(mock_chat_instance):
    """
    it('should generate a detailed section-by-section summary when requested')
    """
    # Arrange
    mock_chat_instance.retriever.invoke.return_value = [MockDoc("Section 1 content", 0)]
    mock_response = MagicMock()
    mock_response.content = "Detailed output"
    mock_chat_instance.llm.invoke.return_value = mock_response
    
    # Act
    result = mock_chat_instance.summarize_document(mode="detailed")
    
    # Assert
    args, _ = mock_chat_instance.llm.invoke.call_args
    prompt_sent = args[0]
    
    assert "section-by-section" in prompt_sent
    assert "Markdown headings" in prompt_sent

def test_summarize_handles_llm_error(mock_chat_instance):
    """
    it('should handle downstream LLM errors gracefully')
    """
    # Arrange
    mock_chat_instance.retriever.invoke.return_value = [MockDoc("content", 0)]
    mock_chat_instance.llm.invoke.side_effect = Exception("Ollama connection failed")
    
    # Act
    result = mock_chat_instance.summarize_document()
    
    # Assert
    assert "error" in result
    assert "Ollama connection failed" in result["error"]
    assert "Failed to generate summary" in result["summary"]


# --- Integration Level Unit Test for Endpoint ---

@patch("ai_utils.get_pdf_chat_instance")
def test_ai_summarize_endpoint_success(mock_get_instance, client):
    """
    it('should return 200 and summary when called with valid payload')
    """
    # Arrange
    mock_chat = MagicMock()
    mock_chat.summarize_document.return_value = {
        "summary": "Result", 
        "mode": "brief",
        "model_used": "fake-model"
    }
    mock_get_instance.return_value = mock_chat
    
    payload = {"mode": "brief"}
    
    # Act
    response = client.post('/ai/summarize', 
                           data=json.dumps(payload),
                           content_type='application/json')
    
    # Assert
    assert response.status_code == 200
    data = response.json
    assert data["summary"] == "Result"
    mock_chat.summarize_document.assert_called_once_with(mode="brief")

@patch("ai_utils.get_pdf_chat_instance")
def test_ai_summarize_endpoint_error(mock_get_instance, client):
    """
    it('should return 500 when the backend logic fails')
    """
    # Arrange
    # Simulate an error that bubbles up (though summarize_document usually catches them, 
    # if get_pdf_chat_instance fails or something else happens)
    mock_get_instance.side_effect = Exception("System Failure")
    
    # Act
    response = client.post('/ai/summarize', 
                           data=json.dumps({"mode": "brief"}),
                           content_type='application/json')
    
    # Assert
    assert response.status_code == 500
    assert "System Failure" in response.json["error"]
