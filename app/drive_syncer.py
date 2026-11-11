import os
import re
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from app.config import DATA_DIR, DRIVE_FOLDER_ID, DRIVE_FOLDER_URL, DEFAULT_POLL_INTERVAL_SEC

logger = logging.getLogger("drive_syncer")
logging.basicConfig(level=logging.INFO)

class DriveSyncer:
    def __init__(self):
        self.folder_id = DRIVE_FOLDER_ID
        self.folder_url = DRIVE_FOLDER_URL
        self.active_filename = "SsLog.csv"
        self.active_file_id = None
        self.available_files = [] # list of dicts: {'name': ..., 'id': ..., 'is_live': ...}
        self.last_sync_time = None
        self.last_error = None
        self.is_syncing = False
        self.poll_interval = DEFAULT_POLL_INTERVAL_SEC
        self.last_content_len = 0
        self.new_rows_detected = 0
        self.auto_sync_enabled = True

    def scan_folder(self):
        """
        Scrapes public Google Drive folder page to discover all SsLog*.csv files and their IDs.
        """
        try:
            req = urllib.request.Request(
                self.folder_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
            
            # Find filenames
            filenames = sorted(list(set(re.findall(r'SsLog(?:[a-zA-Z0-9_\- ]*)\.csv', html))))
            
            file_map = {}
            for fn in filenames:
                pos = html.find(fn)
                if pos != -1:
                    snippet = html[max(0, pos - 450): min(len(html), pos + 450)]
                    ids = re.findall(r'\b1[a-zA-Z0-9_-]{32}\b', snippet)
                    valid_ids = [i for i in ids if not i.endswith('-16')]
                    if valid_ids:
                        file_map[fn] = valid_ids[0]

            
            # Build list
            results = []
            for fn, fid in file_map.items():
                is_live = (fn == "SsLog.csv")
                results.append({
                    'name': fn,
                    'id': fid,
                    'is_live': is_live
                })
            
            # Sort files by parsed date
            def parse_item_date(item):
                fn = item['name']
                # Check dd-mm-yyyy in filename
                m = re.search(r'(\d{2})-(\d{2})-(\d{4})', fn)
                if m:
                    try:
                        return datetime.strptime(f"{m.group(3)}-{m.group(2)}-{m.group(1)}", "%Y-%m-%d")
                    except Exception:
                        pass
                return datetime.min

            # Sort descending by date
            date_files = [f for f in results if f['name'] != 'SsLog.csv']
            date_files.sort(key=parse_item_date, reverse=True)
            
            # Put date_files sorted by date, and SsLog.csv
            ordered_files = []
            if "SsLog.csv" in file_map:
                ordered_files.append({'name': 'SsLog.csv', 'id': file_map['SsLog.csv'], 'is_live': True})
            ordered_files.extend(date_files)
            
            self.available_files = ordered_files

            # Auto-detect the MOST RECENT file:
            # First check if SsLog.csv exists and has actual data rows
            sslog_path = DATA_DIR / "SsLog.csv"
            sslog_has_data = False
            if sslog_path.exists():
                try:
                    with open(sslog_path, 'r', encoding='latin1', errors='ignore') as f:
                        lines = [line for line in f if line.strip() and not line.startswith("'Date")]
                        if len(lines) > 2:
                            sslog_has_data = True
                except Exception:
                    pass

            if sslog_has_data:
                self.active_filename = "SsLog.csv"
                self.active_file_id = file_map.get("SsLog.csv")
            elif date_files:
                # The file with the newest date
                self.active_filename = date_files[0]['name']
                self.active_file_id = date_files[0]['id']
            elif "SsLog.csv" in file_map:
                self.active_filename = "SsLog.csv"
                self.active_file_id = file_map["SsLog.csv"]

            logger.info(f"Discovered {len(results)} files. Auto-selected most recent: {self.active_filename}")
            return self.available_files
        except Exception as e:
            self.last_error = f"Errore scansione cartella Drive: {e}"
            logger.warning(self.last_error)
            return self.available_files

    def download_file(self, file_id, filename):
        """
        Downloads a CSV file from Google Drive and saves to DATA_DIR/filename.
        """

        urls = [
            f"https://drive.google.com/uc?export=download&id={file_id}",
            f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
        ]
        
        target_path = DATA_DIR / filename
        content = None
        last_exc = None
        
        for url in urls:
            try:
                req = urllib.request.Request(
                    url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content = resp.read()
                    if content and len(content) > 10:
                        break
            except Exception as e:
                last_exc = e
                continue
                
        if content is None:
            raise Exception(f"Impossibile scaricare file {filename}: {last_exc}")
            
        old_size = target_path.stat().st_size if target_path.exists() else 0
        with open(target_path, "wb") as f:
            f.write(content)
            
        new_size = len(content)
        self.last_sync_time = datetime.now().isoformat()
        self.last_error = None
        return new_size, (new_size - old_size)

    def sync_active(self):
        """
        Performs a sync of the current active file from Google Drive.
        """
        if self.is_syncing:
            return False, "Sync già in corso"
            
        self.is_syncing = True
        try:
            if not self.available_files or not self.active_file_id:
                self.scan_folder()
                
            if not self.active_file_id:
                raise Exception("ID del file attivo non trovato")
                
            size, size_diff = self.download_file(self.active_file_id, self.active_filename)
            self.last_content_len = size
            logger.info(f"Sync completato per {self.active_filename}: {size} bytes (diff: {size_diff})")
            return True, f"Aggiornato con successo ({size} bytes)"
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Errore sync: {e}")
            return False, str(e)
        finally:
            self.is_syncing = False

    def set_active_file(self, filename):
        """
        Selects a specific file to be analyzed / synced.
        """
        self.active_filename = filename
        for item in self.available_files:
            if item['name'] == filename:
                self.active_file_id = item['id']
                return True
        return False

    def get_status(self):
        return {
            'active_filename': self.active_filename,
            'active_file_id': self.active_file_id,
            'last_sync_time': self.last_sync_time,
            'last_error': self.last_error,
            'is_syncing': self.is_syncing,
            'poll_interval': self.poll_interval,
            'auto_sync_enabled': self.auto_sync_enabled,
            'available_files_count': len(self.available_files)
        }

# Global instance
syncer = DriveSyncer()
