#!/bin/bash
# A script to start the PDF Extractor web application.

# Navigate to the directory where the app.py script is located.
# IMPORTANT: You may need to change this path if you move the project directory.
cd "$(dirname "$0")"

# Optional: If you are using a virtual environment, activate it here.
# For example:
# source .venv/bin/activate

# Run the Flask application.
# The '&' runs the server in the background.
echo "Starting the PDF Extractor web application..."
python app.py &

# Give the server a moment to start up.
sleep 2

# Open the web application in the default browser.
echo "Opening the application in your browser..."
xdg-open http://127.0.0.1:5000

echo "Application is running. You can close this terminal."
