# Use Python 3.10 slim as base to keep image size check
FROM python:3.10-slim

# Install system dependencies
# - pandoc: for ODT conversion
# - git: for installing dependencies from git if needed
# - tesseract-ocr: for OCR support (if used by Docling/pdfplumber)
# - libgl1: for opencv if needed
RUN apt-get update && apt-get install -y \
    pandoc \
    git \
    tesseract-ocr \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
# Use --no-cache-dir to keep image smaller
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn gevent

# Copy application code
COPY . .

# Pre-install translation models to bake them into the image
RUN python translation_utils.py || echo "Warning: Failed to install translation models during build. They will be installed on first use if needed."

# Create necessary directories
RUN mkdir -p uploads outputs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py

# Expose port
EXPOSE 5000

# Install Argos Translate languages on build or entrypoint?
# Doing it in Python script on startup is safer for cache, 
# but we can try to pre-warm it here if we want faster startup.
# For now, let the app handle it on first run or use a startup script.

# Default command
CMD ["gunicorn", "-k", "gevent", "--workers", "1", "--timeout", "300", "--bind", "0.0.0.0:5000", "app:app"]
