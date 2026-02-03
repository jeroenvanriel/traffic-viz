import sys
from pathlib import Path
import webbrowser
import threading
import time

def resource_path(relative_path: str) -> Path:
    """
    Locate resources depending on context:
    - Bundled executable: files in PyInstaller bundle
    - Development: relative to project root
    """
    if getattr(sys, "frozen", False):
        # running as PyInstaller executable
        return Path(sys._MEIPASS) / relative_path
    else:
        # development mode
        return Path(__file__).parents[2] / relative_path

def get_scene_root() -> Path:
    """
    Determine the scene root folder depending on context:
    - Bundled executable: same folder as the executable
    - Development: relative to project root (scenes/)
    """
    if getattr(sys, "frozen", False):
        # running as PyInstaller executable
        return Path(sys.executable).parent
    else:
        # development mode
        return Path(__file__).parents[2] / "scenes"

def open_browser_later(url, delay=1.0):
    """Open the browser after a small delay."""
    def _open():
        time.sleep(delay)
        webbrowser.open(url)
    threading.Thread(target=_open).start()
