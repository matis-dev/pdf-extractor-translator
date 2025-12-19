from pathlib import Path
import os

# Define allowed directories for file operations
# This prevents the LLM from accessing system files or other sensitive areas
ALLOWED_DIRECTORIES = [
    Path.home() / "Documents",
    Path.home() / "Downloads",
    Path.home() / "Desktop",
    Path("/tmp"),
]

# Ensure we also include the project directory for testing purposes
PROJECT_DIR = Path("/home/matis/Desktop/projects/pdf")
if PROJECT_DIR not in ALLOWED_DIRECTORIES:
    ALLOWED_DIRECTORIES.append(PROJECT_DIR)

def validate_path(path_str: str, check_exists: bool = True) -> Path:
    """
    Validate that a path is within the allowed directories.
    
    Args:
        path_str: The path string to validate.
        check_exists: Whether to check if the path exists (default True).
        
    Returns:
        The resolved Path object if valid.
        
    Raises:
        ValueError: If the path is outside allowed directories or doesn't exist (when check_exists=True).
    """
    try:
        path = Path(path_str).resolve()
        
        # Check if path exists if required
        if check_exists and not path.exists():
            raise ValueError(f"Path does not exist: {path_str}")
            
        # Security check: Ensure path is within allowed directories
        is_allowed = False
        for allowed_dir in ALLOWED_DIRECTORIES:
            # We use is_relative_to for Python 3.9+
            # For older python we might need string comparison
            try:
                if path.is_relative_to(allowed_dir):
                    is_allowed = True
                    break
            except AttributeError:
                # Fallback for Python < 3.9
                if str(path).startswith(str(allowed_dir)):
                    is_allowed = True
                    break
                    
        if not is_allowed:
            allowed_list = "\n".join([str(d) for d in ALLOWED_DIRECTORIES])
            raise ValueError(f"Security Alert: Path {path} is not in an allowed directory.\nAllowed:\n{allowed_list}")
            
        return path
    except Exception as e:
        raise ValueError(f"Invalid path {path_str}: {str(e)}")
