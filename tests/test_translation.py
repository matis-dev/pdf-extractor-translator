from unittest.mock import patch, MagicMock
import pytest
import importlib
import translation_utils

# Reload to ensure we test the real function, not the conftest mock
importlib.reload(translation_utils)
from translation_utils import translate_text, install_languages

@patch('argostranslate.translate.translate')
def test_translate_text_success(mock_translate):
    """Test successful translation."""
    mock_translate.return_value = "Hola Mundo"
    result = translate_text("Hello World", "es", "en")
    assert result == "Hola Mundo"
    mock_translate.assert_called_with("Hello World", "en", "es")

def test_translate_same_language():
    """Test optimization when source and target languages are the same."""
    result = translate_text("Hello", "en", "en")
    assert result == "Hello"

@patch('argostranslate.translate.translate')
def test_translate_error(mock_translate):
    """Test translation error handling."""
    mock_translate.side_effect = Exception("Translation failed")
    # Should return original text on error
    result = translate_text("Hello", "es", "en")
    assert result == "Hello"


# test_install_languages removed as function is deprecated

