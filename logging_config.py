
import os
import logging
import logging.handlers
from datetime import datetime

# Defines a logging setup that logs to both a file and the console.
# The file log rotates to prevent disk filling.

LOG_DIR = 'logs'
LOG_FILE = 'app.log'
MAX_BYTES = 5 * 1024 * 1024  # 5 MB
BACKUP_COUNT = 3 # Keep 3 old log files

def setup_logging(app=None):
    """Configures logging for the application."""
    
    # Ensure log directory exists
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)
        
    log_path = os.path.join(LOG_DIR, LOG_FILE)
    
    # Create a generic formatter
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)-8s %(name)-12s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File Handler (Rotating)
    file_handler = logging.handlers.RotatingFileHandler(
        log_path, 
        maxBytes=MAX_BYTES, 
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG) # File captures everything
    
    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO) # Console captures INFO and above
    
    # Root Logger Configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO) # Default level
    
    # Remove existing handlers to avoid duplicates on reload
    if root_logger.handlers:
        root_logger.handlers = []
        
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Specific logger adjustments
    logging.getLogger("werkzeug").setLevel(logging.WARNING) # Reduce Flask/Werkzeug spam
    
    if app:
        app.logger.addHandler(file_handler)
        app.logger.addHandler(console_handler)
        app.logger.setLevel(logging.INFO)
    
    logging.info("Logging initialized. Writing to %s", log_path)

def get_logger(name):
    """Returns a named logger."""
    return logging.getLogger(name)
