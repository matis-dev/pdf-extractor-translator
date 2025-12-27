
from unittest.mock import patch, MagicMock
import pytest
import language_manager

@patch('requests.head')
@patch('argostranslate.package.get_available_packages')
@patch('argostranslate.package.update_package_index')
def test_get_available_languages(mock_update, mock_get_packages, mock_head):
    # Setup mock packages
    pkg1 = MagicMock()
    pkg1.from_code = 'en'
    pkg1.to_code = 'es'
    pkg1.from_name = 'English'
    pkg1.to_name = 'Spanish'
    pkg1.package_version = '1.0'
    pkg1.argos_version = '1.0'
    pkg1.links = ['http://example.com/pkg']
    
    mock_get_packages.return_value = [pkg1]
    
    # Mock requests response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {'content-length': '1024'}
    mock_head.return_value = mock_resp
    
    langs = language_manager.get_available_languages()
    
    assert len(langs) == 1
    assert langs[0]['from_code'] == 'en'
    assert langs[0]['size_bytes'] == 1024
    mock_update.assert_called_once()
    mock_head.assert_called()


@patch('argostranslate.package.get_installed_packages')
def test_get_installed_languages(mock_get_installed):
    pkg1 = MagicMock()
    pkg1.from_code = 'en'
    pkg1.to_code = 'es'
    pkg1.from_name = 'English'
    pkg1.to_name = 'Spanish'
    pkg1.package_version = '1.0'
    
    mock_get_installed.return_value = [pkg1]
    
    langs = language_manager.get_installed_languages()
    
    assert len(langs) == 1
    assert langs[0]['from_code'] == 'en'

@patch('argostranslate.package.get_available_packages')
@patch('argostranslate.package.install_from_path')
@patch('argostranslate.package.update_package_index')
def test_install_language_success(mock_update, mock_install, mock_get_packages):
    pkg1 = MagicMock()
    pkg1.from_code = 'en'
    pkg1.to_code = 'es'
    pkg1.download.return_value = '/tmp/path'
    
    mock_get_packages.return_value = [pkg1]
    
    success, msg = language_manager.install_language('en', 'es')
    
    assert success is True
    assert "Installed" in msg
    mock_install.assert_called_with('/tmp/path')

@patch('argostranslate.package.get_available_packages')
def test_install_language_not_found(mock_get_packages):
    mock_get_packages.return_value = []
    
    success, msg = language_manager.install_language('en', 'xx')
    
    assert success is False
    assert "Package not found" in msg
