
import pytest
import os
from reportlab.pdfgen import canvas
import uuid

@pytest.fixture(scope="session")
def visual_test_pdf_path():
    """Generates a consistent PDF for visual regression testing."""
    folder = "tests/samples"
    os.makedirs(folder, exist_ok=True)
    filename = "visual_regression_baseline.pdf"
    path = os.path.join(folder, filename)
    
    # Create if not exists to ensure consistency
    if not os.path.exists(path):
        c = canvas.Canvas(path)
        c.drawString(100, 750, "Visual Regression Baseline")
        c.drawString(100, 730, "This is a fixed State for VIS-002 -> VIS-004")
        c.rect(50, 50, 500, 700)
        c.showPage()
        c.save()
    
    return path

@pytest.fixture
def global_visual_masks():
    """Returns a list of CSS selectors to mask in screenshots."""
    return [
        ".timestamp",
        ".toast",
        "#processing-overlay",
        ".progress-bar", 
        "canvas#signature-canvas",
        ".file-name", # Filenames might vary in library view
        # Mask recent downloads which might change
        ".card-title:has-text('Recent Downloads') + .card-body"
    ]
