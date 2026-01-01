
import sys
import os
from unittest.mock import MagicMock

# Add project root and src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# Mock translation_utils before importing app/tasks
# We need to preserve the module object but replace functions
import translation_utils
translation_utils.install_languages = MagicMock()
translation_utils.translate_text = MagicMock(return_value="[Translated]")

from app import app

if __name__ == "__main__":
    # Use different port to avoid conflicts
    app.run(port=5001, debug=False, use_reloader=False)
