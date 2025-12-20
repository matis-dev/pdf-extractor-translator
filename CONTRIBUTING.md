# Contributing to PDF Extractor & Translator

Thank you for your interest in contributing to this project! We welcome contributions from the community to help make this tool better for everyone.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)

## Code of Conduct
By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?
- **Reporting Bugs:** Create an issue with a clear description and steps to reproduce.
- **Suggesting Enhancements:** Open an issue to discuss new features.
- **Pull Requests:** Submit fixes or new features through PRs.

## Development Setup

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/your-username/pdf-extractor.git
   cd pdf-extractor
   ```

2. **Virtual Environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

4. **External Dependencies:**
   Ensure you have Redis, Tesseract OCR, and Pandoc installed as described in the [README](README.md).

5. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 --name redis-dev redis
   ```

## Running Tests

We use `pytest` for backend testing and `vitest` for frontend testing (if applicable).

### Backend Tests
```bash
python -m pytest
```

### Run specific test
```bash
python -m pytest tests/test_frontend.py -v
```

## Pull Request Process

1. Create a new branch for your work: `git checkout -b feature/amazing-feature`.
2. Ensure all tests pass.
3. Keep your PRs focused and small if possible.
4. Update the documentation if you've added new features or changed existing ones.

## Style Guidelines

- **Python:** Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/). Use descriptive variable names.
- **JavaScript:** Follow standard modern JS practices.
- **Commits:** Use clear, descriptive commit messages.

## Questions?
Feel free to open an issue for any questions or discussions.
