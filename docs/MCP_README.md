# PDF Extractor MCP Server

This MCP server exposes powerful PDF processing capabilities to AI assistants like Claude. It runs locally and securely on your machine.

## Features

- **Full Document Extraction**: Convert PDFs to editable Word (.docx) documents, preserving layout and images.
- **Table Extraction**: Automatically detect and extract tables to CSV files.
- **Offline Translation**: Translate text between 9 languages securely (no data leaves your machine).

## Installation

1.  **Dependencies**: Ensure the project dependencies and `pydantic` are installed.
    ```bash
    pip install -r requirements.txt
    ```

2.  **Tesseract OCR**: Required for image-based PDFs.
    - Linux: `sudo apt install tesseract-ocr`
    - macOS: `brew install tesseract`

## Configuration

### Claude Desktop

Add this configuration to your `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pdf-extractor": {
      "command": "python3",
      "args": ["/home/matis/Desktop/projects/pdf/mcp_server.py"],
      "env": {
        "TESSDATA_PREFIX": "/usr/share/tesseract-ocr/5/tessdata/"
      }
    }
  }
}
```

*Note: Update the `TESSDATA_PREFIX` if your Tesseract installation path differs.*

### LM Studio or Other Candidates

For other MCP clients, point the configuration to the `mcp_server.py` script.

## Security

- **Path Validation**: Operations are restricted to standard user directories (Documents, Downloads, Desktop) and the project directory.
- **Input Validation**: All inputs are strictly validated using Pydantic schemas.
- **Read-Only Translation**: The translation tool is a pure function and modifies no files.

## Troubleshooting

- **Import Errors**: Ensure you are running the script from the project root so that `mcp_server_utils` can be resolved.
- **Tesseract**: If extraction fails, check if `tesseract` is in your PATH.
