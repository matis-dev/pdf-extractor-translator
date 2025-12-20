# Changelog

All notable changes to PDF Content Extractor & Translator are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- PDF/A compliance conversion
- Batch translation for multiple documents
- OCR quality enhancement
- Custom font upload for annotations
- Language auto-detection

---

## [1.0.0] - 2025-12-15

### 🎉 Initial Release

The first stable release of PDF Content Extractor & Translator, featuring a complete suite of privacy-focused PDF tools.

### Added

#### Core Extraction
- **Full Document Extraction** — Convert PDFs to Word (.docx) with structure preservation
- **Table Extraction to CSV** — Automatically detect and export tables
- **Table Extraction to Word** — Export tables in document format
- **ODT Export** — OpenDocument Text format support

#### Translation
- **Offline Translation** — 9 languages supported via Argos Translate
  - English, Spanish, French, German, Italian, Portuguese, Polish, Russian, Dutch, Chinese
- **No API Keys Required** — Fully local translation processing

#### PDF Editor
- **Text Annotations** — Add text anywhere on PDF pages
- **Highlight Tool** — Mark important sections
- **Redaction Tool** — Permanently remove sensitive content
- **Shape Annotations** — Rectangle, ellipse, line, arrow tools
- **Digital Signatures** — Draw, type, or upload signature images
- **Sticky Notes** — Add comment annotations

#### Page Operations
- **Insert Pages** — Add blank pages or pages from other PDFs
- **Delete Pages** — Remove unwanted pages
- **Rotate Pages** — 90° clockwise/counter-clockwise rotation
- **Reorder Pages** — Drag-and-drop page reorganization

#### PDF Tools
- **Merge PDFs** — Combine multiple documents into one
- **Split PDF** — Extract page ranges into separate files
- **Compress PDF** — Reduce file size via Ghostscript
- **Compare PDFs** — Visual diff between document versions
- **Repair PDF** — Attempt to fix corrupted files
- **PDF to JPG** — Export pages as images
- **Watermark** — Add text watermarks to all pages

#### AI Features
- **Local AI Chat** — Q&A about PDFs via Ollama
- **Document Indexing** — RAG-based retrieval with ChromaDB
- **ReAct Agent** — Agentic workflow with tool calling
- **Multi-Model Support** — Switch between installed Ollama models

#### User Interface
- **Dark Mode** — System-aware theme toggle
- **Ribbon Toolbar** — Office-style tabbed interface
- **Thumbnail Sidebar** — Page navigation with previews
- **Command Palette** — Keyboard-driven command access (Ctrl+K)
- **Batch Operations** — Multi-select actions on home page
- **Bug Reporter** — Built-in issue reporting with logs

#### Infrastructure
- **Docker Support** — One-command deployment
- **Celery Workers** — Background task processing
- **Redis Queue** — Reliable task management
- **Structured Logging** — Rotating log files with levels

#### Integrations
- **MCP Server** — Model Context Protocol for AI assistants
- **CLI Scripts** — Command-line extraction tools

### Security
- All processing happens locally — no cloud uploads
- Path traversal prevention via `secure_filename()`
- Input validation on all API endpoints

---

## [0.9.0] - 2025-11-01

### Added
- Beta release for internal testing
- Core extraction functionality
- Basic annotation tools
- Initial translation support

### Known Issues
- Large PDFs (>100 pages) may timeout
- Some table layouts not detected correctly

---

## [0.8.0] - 2025-09-15

### Added
- Alpha release
- PDF viewing and navigation
- Basic page operations

### Changed
- Migrated from pdfminer to Docling for extraction

---

## Version History Summary

| Version | Date       | Highlights                                  |
| ------- | ---------- | ------------------------------------------- |
| 1.0.0   | 2025-12-15 | First stable release with all core features |
| 0.9.0   | 2025-11-01 | Beta with extraction and translation        |
| 0.8.0   | 2025-09-15 | Alpha with PDF viewing                      |

---

## Upgrade Notes

### Upgrading to 1.0.0

1. **Docker Users:**
   ```bash
   docker-compose pull
   docker-compose up --build
   ```

2. **Manual Installation:**
   ```bash
   git pull origin main
   pip install -r requirements.txt
   ```

3. **Breaking Changes:** None from 0.9.x

---

## Links

- [Full Documentation](docs/TECHNICAL_DOCUMENTATION.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

---

*For feature requests and bug reports, please use [GitHub Issues](https://github.com/matis-dev/pdf-extractor-translator/issues).*
