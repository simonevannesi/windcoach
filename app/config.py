import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DRIVE_FOLDER_ID = "12Sn5_2YPEmH2ZzxTXy9Fcy8M6MZGi8Qr"
DRIVE_FOLDER_URL = f"https://drive.google.com/drive/folders/{DRIVE_FOLDER_ID}"

# Default parameters
DEFAULT_POLL_INTERVAL_SEC = 30
DEFAULT_TACKING_ANGLE = 84.0      # typical upwind tacking angle (e.g. 80-86 deg)
DEFAULT_LINE_LENGTH_M = 150.0     # starting line length in meters
DEFAULT_BOAT_LENGTH_M = 10.0      # boat length for tactical conversion (es. 10m / J70/Melges/ORC)
DEFAULT_SHIFT_ALERT_THRESHOLD = 5.0 # degrees of shift to trigger alert
