#!/bin/bash

# PDF Extractor - Unified Start Script
# Usage: ./start.sh [--docker]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/venv"

# cd to project root for consistent paths
cd "$PROJECT_DIR"

# Function to check if a port is in use
check_port() {
    (echo >/dev/tcp/localhost/$1) &>/dev/null && return 0 || return 1
}

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ ! -z "$FLASK_PID" ]; then
        kill $FLASK_PID 2>/dev/null
    fi
    if [ ! -z "$CELERY_PID" ]; then
        kill $CELERY_PID 2>/dev/null
    fi
    echo "👋 Bye!"
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

# --- MODE SELECTION ---

if [[ "$1" == "--docker" ]]; then
    echo "🐳 Starting in Docker mode..."
    if command -v docker-compose &> /dev/null; then
        docker-compose up --build
    else
        docker compose up --build
    fi
    exit
fi

# --- LOCAL MODE ---
echo "🚀 Starting PDF Extractor (Local Mode)..."

# 1. Activate Virtual Environment
if [ -d "$VENV_DIR" ]; then
    echo "📦 Activating virtual environment..."
    source "$VENV_DIR/bin/activate"
else
    echo "⚠️  No virtual environment found at $VENV_DIR"
    echo "    Running with system python..."
fi

# 2. Check for Redis (for Full Mode)
HAS_REDIS=false
if check_port 6379; then
    echo "✅ Redis detected on port 6379."
    HAS_REDIS=true
else
    echo "ℹ️  Redis NOT found. Running in LITE mode (Synchronous processing)."
    echo "    For background processing, install/start Redis or use --docker."
fi

# 3. Check for Ollama (for AI)
if check_port 11434; then
    echo "✅ Ollama detected on port 11434 (AI features active)."
else
    echo "ℹ️  Ollama NOT found. AI Chat features will be disabled."
    echo "    To enable AI, install Ollama from https://ollama.com"
fi

# 4. Start Dependencies (if available)

if [ "$HAS_REDIS" = true ]; then
    echo "🔄 Starting Celery worker..."
    export PYTHONPATH=$PROJECT_DIR/src
    celery -A src.app.celery worker --loglevel=error &
    CELERY_PID=$!
    echo "   Worker PID: $CELERY_PID"
fi

# 5. Start Flask App
echo "🌐 Starting Web Server..."
export PYTHONPATH=$PROJECT_DIR/src
export FLASK_DEBUG=true
python src/app.py &
FLASK_PID=$!

echo "--------------------------------------------------------"
echo "✅ App is running at: http://127.0.0.1:5000"
echo "   (Press Ctrl+C to stop)"
echo "--------------------------------------------------------"

# Open browser after short delay
sleep 2
if command -v xdg-open &> /dev/null; then
    xdg-open http://127.0.0.1:5000
elif command -v open &> /dev/null; then
    open http://127.0.0.1:5000
fi

# Wait for process to finish
wait $FLASK_PID
cleanup
