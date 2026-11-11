import asyncio
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from app.config import (
    BASE_DIR, DATA_DIR, DEFAULT_POLL_INTERVAL_SEC, DEFAULT_LINE_LENGTH_M,
    DEFAULT_BOAT_LENGTH_M, DEFAULT_TACKING_ANGLE
)
from app.drive_syncer import syncer
from app.parser import parse_csv_file, parse_csv_content
from app.tactical_engine import calculate_tactics

app = FastAPI(title="WindRegatta Pro Dashboard", version="1.0.0")

# Mount static and templates
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# App State
state = {
    'line_bearing': None, # e.g. 220.0
    'line_length_m': DEFAULT_LINE_LENGTH_M,
    'boat_length_m': DEFAULT_BOAT_LENGTH_M,
    'tack_angle': DEFAULT_TACKING_ANGLE,
    'time_window_min': None, # None means all
}

# Background worker for 30s auto-polling
background_sync_task = None

async def periodic_drive_sync():
    """Background task to poll Google drive every 30s."""
    # First immediate scan & sync
    try:
        syncer.scan_folder()
        syncer.sync_active()
    except Exception as e:
        print(f"Initial sync warning: {e}")
        
    while True:
        try:
            await asyncio.sleep(syncer.poll_interval)
            if syncer.auto_sync_enabled:
                syncer.sync_active()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Background sync error: {e}")

@app.on_event("startup")
async def on_startup():
    global background_sync_task
    # Make sure we have local sample if nothing else exists
    syncer.scan_folder()
    # Check if local SsLog.csv or another file exists, if not sync
    active_path = DATA_DIR / syncer.active_filename
    if not active_path.exists():
        syncer.sync_active()
    background_sync_task = asyncio.create_task(periodic_drive_sync())

@app.on_event("shutdown")
async def on_shutdown():
    global background_sync_task
    if background_sync_task:
        background_sync_task.cancel()

@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={})


@app.get("/api/tactics")
async def get_tactics(
    window_min: Optional[float] = Query(None),
    line_bearing: Optional[float] = Query(None),
    line_length: Optional[float] = Query(None),
    boat_length: Optional[float] = Query(None),
    tack_angle: Optional[float] = Query(None),
):
    """
    Returns tactical analysis computed from the active CSV file.
    """
    active_path = DATA_DIR / syncer.active_filename
    if not active_path.exists() and syncer.active_file_id:
        try:
            syncer.download_file(syncer.active_file_id, syncer.active_filename)
        except Exception:
            pass

    if not active_path.exists():
        # Try finding newest date csv in DATA_DIR
        csv_files = sorted(list(DATA_DIR.glob("*.csv")), reverse=True)
        if csv_files:
            active_path = csv_files[0]
            syncer.set_active_file(active_path.name)
        else:
            return JSONResponse({
                'has_data': False,
                'message': 'Nessun file CSV disponibile. In attesa del download da Google Drive...'
            })

    records = parse_csv_file(active_path)

    
    lb = line_bearing if line_bearing is not None else state['line_bearing']
    ll = line_length if line_length is not None else state['line_length_m']
    bl = boat_length if boat_length is not None else state['boat_length_m']
    ta = tack_angle if tack_angle is not None else state['tack_angle']
    wm = window_min if window_min is not None else state['time_window_min']

    tactics = calculate_tactics(
        records,
        line_bearing=lb,
        line_length_m=ll,
        boat_length_m=bl,
        tack_angle=ta,
        time_window_min=wm
    )
    
    tactics['active_file'] = syncer.active_filename
    tactics['sync_status'] = syncer.get_status()
    return JSONResponse(tactics)

@app.get("/api/files")
async def get_files():
    """
    Lists available files from Google Drive and local cache with row counts.
    """
    drive_files = syncer.available_files
    local_files = [f.name for f in DATA_DIR.glob("*.csv")]
    
    file_list = []
    seen = set()
    for df in drive_files:
        name = df['name']
        seen.add(name)
        cached_path = DATA_DIR / name
        rec_count = 0
        if cached_path.exists():
            records = parse_csv_file(cached_path)
            rec_count = len(records)
            
        file_list.append({
            'name': name,
            'id': df['id'],
            'is_live': df.get('is_live', False),
            'in_cache': cached_path.exists(),
            'is_active': (name == syncer.active_filename),
            'record_count': rec_count
        })
        
    for lf in sorted(local_files):
        if lf not in seen:
            cached_path = DATA_DIR / lf
            records = parse_csv_file(cached_path)
            file_list.append({
                'name': lf,
                'id': None,
                'is_live': (lf == "SsLog.csv"),
                'in_cache': True,
                'is_active': (lf == syncer.active_filename),
                'record_count': len(records)
            })
            
    return JSONResponse({
        'active_file': syncer.active_filename,
        'files': file_list
    })


@app.post("/api/select-file")
async def select_file(filename: str = Form(...)):
    """
    Switches active file to another CSV in Drive or local cache.
    """
    syncer.set_active_file(filename)
    target_path = DATA_DIR / filename
    if not target_path.exists() and syncer.active_file_id:
        syncer.sync_active()
    return JSONResponse({'success': True, 'active_file': syncer.active_filename})

@app.post("/api/sync/now")
async def sync_now():
    """
    Triggers an immediate scan and sync.
    """
    syncer.scan_folder()
    ok, msg = syncer.sync_active()
    return JSONResponse({'success': ok, 'message': msg, 'status': syncer.get_status()})

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Uploads a local CSV file directly to the dashboard.
    """
    try:
        content = await file.read()
        target_path = DATA_DIR / file.filename
        with open(target_path, "wb") as f:
            f.write(content)
        syncer.set_active_file(file.filename)
        return JSONResponse({'success': True, 'filename': file.filename})
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

@app.post("/api/settings")
async def update_settings(
    auto_sync: Optional[bool] = Form(None),
    interval: Optional[int] = Form(None),
    line_bearing: Optional[float] = Form(None),
    line_length: Optional[float] = Form(None),
    boat_length: Optional[float] = Form(None),
    tack_angle: Optional[float] = Form(None),
    window_min: Optional[float] = Form(None)
):
    if auto_sync is not None:
        syncer.auto_sync_enabled = auto_sync
    if interval is not None and interval >= 5:
        syncer.poll_interval = interval
    if line_bearing is not None:
        state['line_bearing'] = line_bearing if line_bearing >= 0 else None
    if line_length is not None:
        state['line_length_m'] = line_length
    if boat_length is not None:
        state['boat_length_m'] = boat_length
    if tack_angle is not None:
        state['tack_angle'] = tack_angle
    if window_min is not None:
        state['time_window_min'] = window_min if window_min > 0 else None

    return JSONResponse({'success': True, 'status': syncer.get_status(), 'state': state})
