import re
from datetime import datetime
from pathlib import Path

def parse_coord(coord_str):
    """
    Parses latitude or longitude strings such as:
    39° 13.227' N, 009° 12.700' E, or 39 13.227' N
    Returns decimal degrees (float) or None.
    """
    if not coord_str:
        return None
    m = re.search(r"(\d+)[^\d\.]+(\d+\.?\d*)\s*['´`]?\s*([NSEWnsew])", coord_str)
    if not m:
        return None
    deg = float(m.group(1))
    minutes = float(m.group(2))
    hemi = m.group(3).upper()
    val = deg + minutes / 60.0
    if hemi in ['S', 'W']:
        val = -val
    return round(val, 6)

def parse_deg_mag(s):
    """
    Parses magnetic bearing strings like '330° M' or '357 M'.
    Returns float in [0, 360).
    """
    if not s:
        return None
    m = re.search(r"(\d+\.?\d*)", s)
    if m:
        return round(float(m.group(1)) % 360.0, 1)
    return None

def parse_speed(s):
    """
    Parses speed strings like '08.1' or '00.9' knots.
    """
    if not s:
        return None
    m = re.search(r"(\d+\.?\d*)", s)
    return round(float(m.group(1)), 1) if m else None

def parse_twa(s):
    """
    Parses True Wind Angle like '082° Port' or '014° Stbd'.
    Returns (angle, side) where side is 'Port' or 'Stbd'.
    """
    if not s:
        return None, None
    m = re.search(r"(\d+\.?\d*)\s*[^\d]*\s*(Port|Stbd)", s, re.IGNORECASE)
    if m:
        val = round(float(m.group(1)), 1)
        side = m.group(2).capitalize()
        return val, side
    # Try just number
    m2 = re.search(r"(\d+\.?\d*)", s)
    if m2:
        return round(float(m2.group(1)), 1), ""
    return None, None

def parse_csv_content(content_str):
    """
    Parses CSV text into a structured list of wind log records.
    """
    records = []
    seen_timestamps = set()
    
    for line in content_str.splitlines():
        line = line.strip()
        if not line or 'Date' in line or 'Latitude' in line:
            continue
            
        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 9:
            continue
            
        date_str = parts[0].replace("'", "").strip()
        time_str = parts[1].replace("'", "").replace('UTC', '').strip()
        lat_str = parts[2].replace("'", "").strip()
        lon_str = parts[3].replace("'", "").strip()
        sog_str = parts[4].replace("'", "").strip()
        cog_str = parts[5].replace("'", "").strip()
        tws_str = parts[6].replace("'", "").strip()
        twa_str = parts[7].replace("'", "").strip()
        twd_str = parts[8].replace("'", "").strip()
        comment = parts[9].replace("'", "").strip() if len(parts) > 9 else ""
        
        dt_key = f"{date_str} {time_str}"
        if dt_key in seen_timestamps:
            continue
        seen_timestamps.add(dt_key)
        
        dt = None
        for fmt in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
            try:
                dt = datetime.strptime(dt_key, fmt)
                break
            except Exception:
                pass
                
        lat = parse_coord(lat_str)
        lon = parse_coord(lon_str)
        sog = parse_speed(sog_str)
        cog = parse_deg_mag(cog_str)
        tws = parse_speed(tws_str)
        twa_val, twa_side = parse_twa(twa_str)
        twd = parse_deg_mag(twd_str)
        
        if twd is not None and tws is not None:
            records.append({
                'datetime': dt.isoformat() if dt else dt_key,
                'epoch': dt.timestamp() if dt else 0,
                'date': date_str,
                'time': time_str,
                'lat': lat,
                'lon': lon,
                'sog': sog,
                'cog': cog,
                'tws': tws,
                'twa': twa_val,
                'twa_side': twa_side,
                'twd': twd,
                'comment': comment
            })
            
    # Sort chronologically
    records.sort(key=lambda r: (r['epoch'], r['time']))
    return records

def parse_csv_file(filepath):
    """
    Reads file using latin1 / utf-8 and returns parsed records.
    """
    p = Path(filepath)
    if not p.exists():
        return []
        
    for enc in ('utf-8', 'latin1', 'cp1252'):
        try:
            with open(p, 'r', encoding=enc) as f:
                content = f.read()
            return parse_csv_content(content)
        except UnicodeDecodeError:
            continue
            
    with open(p, 'rb') as f:
        content = f.read().decode('latin1', errors='replace')
    return parse_csv_content(content)
