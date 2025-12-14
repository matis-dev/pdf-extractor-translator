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

@patch('argostranslate.package.get_available_packages')
@patch('argostranslate.package.install_from_path')
@patch('argostranslate.package.update_package_index')
def test_install_languages(mock_update, mock_install, mock_get_packages):
    """Test language installation logic."""
    # Create mock packages for all expected pairs
    expected_pairs = [
        ('en', 'es'), ('es', 'en'),
        ('en', 'fr'), ('fr', 'en'),
        ('en', 'de'), ('de', 'en'),
        ('en', 'pl'), ('pl', 'en'),
        ('en', 'pt'), ('pt', 'en'),
        ('en', 'it'), ('it', 'en'),
        ('en', 'nl'), ('nl', 'en'),
        ('en', 'ru'), ('ru', 'en')
    ]
    
    mock_pkgs = []
    for f, t in expected_pairs:
        p = MagicMock()
        p.from_code = f
        p.to_code = t
        p.download.return_value = f'/tmp/{f}_{t}'
        mock_pkgs.append(p)
        
    mock_get_packages.return_value = mock_pkgs
    
    install_languages()
    
    mock_update.assert_called_once()
    assert mock_install.call_count == len(expected_pairs)
