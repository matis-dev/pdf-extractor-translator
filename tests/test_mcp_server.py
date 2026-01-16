import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys
import os

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# Import from mcp_server. 
# Note: FastMCP tools are decorators. The underlying function might be accessible directly 
# or wrapped. FastMCP implementation usually returns the wrapped function or we mock FastMCP.
# For this test, we assume we can import the decorated functions. 
# If FastMCP replaces them with objects, we might need to inspect .fn or similar.
# Assuming standard python decorator behavior where it *might* wrap.
from mcp_server import compress_pdf, split_pdf, list_pdfs
from mcp_server_utils.schemas import CompressPdfInput, SplitPdfInput, ListPdfsInput

# Mock external dependencies
@pytest.fixture
def mock_subprocess():
    with patch("subprocess.run") as mock:
        yield mock

@pytest.fixture
def sample_pdf(tmp_path):
    # Create a dummy PDF in a temp dir.
    # We must ensure this dir is allowed by security.py.
    # security.py allows /tmp. tmp_path is usually in /tmp.
    p = tmp_path / "test.pdf"
    p.write_bytes(b"%PDF-1.4 test content")
    return str(p)

def test_compress_pdf_valid(mock_subprocess, sample_pdf):
    # Test compression command generation
    input_data = CompressPdfInput(pdf_path=sample_pdf, quality='ebook')
    
    # Check if tool is callable directly
    if hasattr(compress_pdf, 'fn'): # FastMCP internal?
        # If the decorator hides the function, we might fail here.
        # But commonly in lightweight frameworks, we can call it.
        pass
        
    result = compress_pdf(input_data)
    
    # Expect success message (or error if gs missing but we mocked subprocess)
    assert "Compressed PDF saved to" in result
    
    mock_subprocess.assert_called_once()
    args = mock_subprocess.call_args[0][0]
    assert "gs" in args[0]
    # Check simple string presence in list
    cmd_str = " ".join(str(x) for x in args)
    assert "/ebook" in cmd_str
    assert "test.pdf" in cmd_str

def test_split_pdf_logic(sample_pdf):
    # Mock PyPDF to avoid actual parsing of our dummy file
    with patch("mcp_server.PdfReader") as MockReader, \
         patch("mcp_server.PdfWriter") as MockWriter:
        
        mock_reader = MockReader.return_value
        # Mock 3 pages
        mock_reader.pages = [MagicMock(), MagicMock(), MagicMock()] 
        
        mock_writer = MockWriter.return_value
        
        # Split pages 1 to 2
        input_data = SplitPdfInput(pdf_path=sample_pdf, page_ranges="1-2")
        result = split_pdf(input_data)
        
        assert "Created 1 split files" in result
        
        # Verify range parsing
        # range 1-2 means pages 0, 1.
        # Writer should have added pages.
        assert mock_writer.add_page.call_count == 2

def test_list_pdfs(tmp_path):
    # Setup files
    d = tmp_path / "docs"
    d.mkdir()
    (d / "a.pdf").touch()
    (d / "ignore.txt").touch()
    
    input_data = ListPdfsInput(directory=str(d), recursive=False)
    result = list_pdfs(input_data)
    
    assert "a.pdf" in result
    assert "ignore.txt" not in result
