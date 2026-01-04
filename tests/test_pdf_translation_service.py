import pytest
from unittest.mock import MagicMock, patch
from pdf_translation_service import PDFTranslationService

@patch('pdf_translation_service.fitz.open')
@patch('pdf_translation_service.translate_text')
def test_translate_pdf_in_place(mock_translate, mock_open):
    # Setup Mocks
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_open.return_value = mock_doc
    mock_doc.__iter__.return_value = [mock_page]
    
    # Mock text extraction
    mock_page.get_text.return_value = {
        "blocks": [
            {
                "lines": [
                    {
                        "spans": [
                            {
                                "text": "Hello",
                                "bbox": (10, 10, 50, 20),
                                "origin": (10, 20),
                                "size": 12,
                                "color": 0
                            }
                        ]
                    }
                ]
            }
        ]
    }
    
    mock_translate.return_value = "Hola"
    
    service = PDFTranslationService()
    service.translate_pdf_in_place("input.pdf", "output.pdf", "en", "es")
    
    # Verify Translation called
    mock_translate.assert_called_with("Hello", "es", "en")
    
    # Verify Redaction (draw_rect)
    mock_page.draw_rect.assert_called()
    
    # Verify Insertion (insert_text)
    mock_page.insert_text.assert_called()
    args, kwargs = mock_page.insert_text.call_args
    assert kwargs['text'] == "Hola"
    assert kwargs['fontsize'] == 12
    
    # Verify Save
    mock_doc.save.assert_called_with("output.pdf")
