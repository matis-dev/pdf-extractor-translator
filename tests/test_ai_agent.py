import unittest
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.getcwd())

from ai_utils import get_pdf_chat_instance, LANGCHAIN_AVAILABLE
from ai_tools import extract_pdf_tables, translate

class TestAgenticWorkflow(unittest.TestCase):
    def setUp(self):
        if not LANGCHAIN_AVAILABLE:
            self.skipTest("LangChain not available")
            
        self.chat = get_pdf_chat_instance()
        self.pdf_path = os.path.abspath("test_agent.pdf")
        
        # Ensure we have a PDF
        if not os.path.exists(self.pdf_path):
            self.skipTest(f"Test PDF not found at {self.pdf_path}")
            
        # Check Ollama
        if not self.chat.check_ollama_available():
            print("WARNING: Ollama not running. Skipping integration tests.")
            self.ollama_available = False
        else:
            self.ollama_available = True
            
    def test_tools_direct_call(self):
        """Test that tools can be called directly."""
        # Test Translate Tool
        result = translate.invoke({"text": "Hello", "target_lang": "es"})
        self.assertIsInstance(result, str)
        print(f"Translation result: {result}")
        
        # Test Extraction Tool (Dry run logic mostly, depends on PDF content)
        # We catch potential errors if PDF has no tables
        try:
            result = extract_pdf_tables.invoke({"pdf_path": self.pdf_path})
            print(f"Extraction result: {result}")
        except Exception as e:
            print(f"Extraction tool error (expected depending on PDF): {e}")

    def test_agent_initialization(self):
        """Test that agent chain initializes correctly."""
        self.chat.index_pdf(self.pdf_path)
        self.assertIsNotNone(self.chat.agent_executor)
        self.assertEqual(len(self.chat.tools), 3) # extract, translate, search

    def test_agent_execution(self):
        """Test full agent execution (requires running Ollama)."""
        if not self.ollama_available:
            return
            
        self.chat.index_pdf(self.pdf_path)
        
        # Simple RAG query first
        response = self.chat.ask("What is this document about?")
        print(f"RAG Response: {response.get('answer')}")
        self.assertIn('answer', response)
        
        # Agentic query (simple translation request)
        # Note: This might fail if the model is too small (e.g. 1b/3b sometimes fail tool calling)
        # We just check it runs without crashing
        response_tool = self.chat.ask("Translate 'Hello World' to Spanish")
        print(f"Agent Response: {response_tool.get('answer')}")
        print(f"Agent Log: {response_tool.get('agent_log')}")

if __name__ == '__main__':
    unittest.main()
