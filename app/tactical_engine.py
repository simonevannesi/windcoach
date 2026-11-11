import math
import numpy as np

def circular_mean(angles_deg):
    """Calculates circular mean for degree angles in [0, 360)."""
    if not angles_deg:
        return 0.0
    rads = np.radians(angles_deg)
    sin_sum = np.sum(np.sin(rads))
    cos_sum = np.sum(np.cos(rads))
    mean_rad = np.arctan2(sin_sum, cos_sum)
    mean_deg = np.degrees(mean_rad) % 360.0
    return float(mean_deg)

def angle_diff(a, b):
    """Shortest signed difference (a - b) in degrees: range [-180, 180]."""
    diff = (a - b + 180) % 360 - 180
    return float(diff)

def circular_std(angles_deg):
    """Calculates circular standard deviation in degrees."""
    if len(angles_deg) < 2:
        return 0.0
    rads = np.radians(angles_deg)
    sin_mean = np.mean(np.sin(rads))
    cos_mean = np.mean(np.cos(rads))
    r = np.sqrt(sin_mean**2 + cos_mean**2)
    if r < 1e-6:
        return 180.0
    std_rad = np.sqrt(max(0.0, -2.0 * np.log(min(1.0, r))))
    return float(min(180.0, np.degrees(std_rad)))

def calculate_tactics(records, time_window_min=15, **kwargs):
    """
    Sober, high-legibility tactical wind engine for coach on RIB.
    Answers 3 core questions in selected interval (15m, 30m, 1h):
    1. Vento in calo o aumento e di quanto (TWS trend & delta)
    2. Cambio direzione e di quanto (TWD rotation & delta)
    3. Tempo medio tra oscillazioni ed entita (duration & amplitude)
    """
    if not records:
        return {
            'has_data': False,
            'message': 'Nessuna lettura registrata nel file selezionato.'
        }

    # Window sample filtering (assuming ~30s per record -> 2 samples/min)
    win_min = float(time_window_min) if time_window_min and float(time_window_min) > 0 else 15.0
    n_samples = max(4, int(win_min * 2))
    recs = records[-n_samples:] if len(records) > n_samples else records

    twds = [r['twd'] for r in recs]
    twss = [r['tws'] for r in recs]
    
    curr_record = recs[-1]
    curr_twd = curr_record['twd']
    curr_tws = curr_record['tws']
    
    mean_twd = circular_mean(twds)
    devs = [angle_diff(deg, mean_twd) for deg in twds]
    x = np.arange(len(recs))

    # ============================================================
    # 1. INTENSITÀ DEL VENTO (CALO / AUMENTO E DI QUANTO)
    # ============================================================
    tws_avg = round(float(np.mean(twss)), 1)
    tws_min = round(float(np.min(twss)), 1)
    tws_max = round(float(np.max(twss)), 1)

    if len(twss) >= 4:
        slope_s, _ = np.polyfit(x, twss, 1)
        tws_delta = round(float(slope_s * (len(twss) - 1)), 1)
        if tws_delta >= 0.7:
            tws_trend_status = "rising"
            tws_trend_label = "IN AUMENTO"
            tws_trend_badge = f"+{tws_delta} kn"
        elif tws_delta <= -0.7:
            tws_trend_status = "falling"
            tws_trend_label = "IN CALO"
            tws_trend_badge = f"{tws_delta} kn"
        else:
            tws_trend_status = "stable"
            tws_trend_label = "STABILE"
            tws_trend_badge = f"{tws_delta:+.1f} kn"
    else:
        tws_delta = 0.0
        tws_trend_status = "stable"
        tws_trend_label = "STABILE"
        tws_trend_badge = "0 kn"

    # ============================================================
    # 2. DIREZIONE DEL VENTO (CAMBIO DIREZIONE E DI QUANTO)
    # ============================================================
    min_dev = min(devs)
    max_dev = max(devs)
    max_sinistro = round((mean_twd + min_dev) % 360.0, 0)
    max_destro = round((mean_twd + max_dev) % 360.0, 0)
    ampiezza_cono = round(max_dev - min_dev, 0)

    curr_shift = angle_diff(curr_twd, mean_twd)
    curr_side = "DESTRA" if curr_shift > 0.8 else ("SINISTRA" if curr_shift < -0.8 else "ASSE MEDIO")

    if len(devs) >= 4:
        slope_d, _ = np.polyfit(x, devs, 1)
        twd_delta = round(float(slope_d * (len(devs) - 1)), 0)
        if twd_delta >= 3.0:
            twd_trend_status = "right"
            twd_trend_label = "ROTAZIONE A DESTRA"
            twd_trend_badge = f"+{int(abs(twd_delta))}°"
        elif twd_delta <= -3.0:
            twd_trend_status = "left"
            twd_trend_label = "ROTAZIONE A SINISTRA"
            twd_trend_badge = f"-{int(abs(twd_delta))}°"
        else:
            twd_trend_status = "stable"
            twd_trend_label = "DIREZIONE STABILE"
            twd_trend_badge = f"±{int(abs(twd_delta))}°"
    else:
        twd_delta = 0.0
        twd_trend_status = "stable"
        twd_trend_label = "DIREZIONE STABILE"
        twd_trend_badge = "0°"

    # ============================================================
    # 3. OSCILLAZIONI (TEMPO MEDIO TRA OSCILLAZIONI ED ENTITÀ)
    # ============================================================
    phases = []
    current_side_tag = 'DX' if devs[0] >= 0 else 'SX'
    current_count = 1
    for d in devs[1:]:
        side_tag = 'DX' if d >= 0 else 'SX'
        if side_tag == current_side_tag:
            current_count += 1
        else:
            phases.append((current_side_tag, current_count * 0.5)) # 0.5 min per sample
            current_side_tag = side_tag
            current_count = 1
    phases.append((current_side_tag, current_count * 0.5))

    durs = [dur for _, dur in phases]
    avg_phase_min = round(float(np.mean(durs)), 1) if durs else 0.0
    right_durs = [dur for s, dur in phases if s == 'DX']
    left_durs = [dur for s, dur in phases if s == 'SX']
    avg_right_min = round(float(np.mean(right_durs)), 1) if right_durs else 0.0
    avg_left_min = round(float(np.mean(left_durs)), 1) if left_durs else 0.0
    full_cycle_min = round(avg_right_min + avg_left_min, 1)

    entita_media = round(float(np.mean(np.abs(devs))), 0)
    curr_phase_side_text = "DESTRA" if phases[-1][0] == 'DX' else "SINISTRA"
    curr_phase_duration_min = round(phases[-1][1], 1)
    status_phase_text = f"In fase {curr_phase_side_text} da {curr_phase_duration_min} min"

    # Sampling for clean chart
    step = max(1, len(recs) // 120)
    sampled = recs[::step]
    if recs[-1] not in sampled:
        sampled.append(recs[-1])
        
    chart_data = {
        'labels': [r['time'] for r in sampled],
        'twd': [r['twd'] for r in sampled],
        'tws': [r['tws'] for r in sampled],
    }

    return {
        'has_data': True,
        'window_min': int(win_min),
        'count': len(recs),
        'total_file_records': len(records),
        'latest_time': curr_record['time'],
        'latest_date': curr_record.get('date', ''),

        # 1. Intensità
        'curr_tws': round(curr_tws, 1),
        'tws_avg': tws_avg,
        'tws_min': tws_min,
        'tws_max': tws_max,
        'tws_trend_label': tws_trend_label,
        'tws_trend_badge': tws_trend_badge,
        'tws_trend_status': tws_trend_status,
        'tws_delta': tws_delta,

        # 2. Direzione
        'curr_twd': round(curr_twd, 0),
        'mean_twd': round(mean_twd, 0),
        'twd_trend_label': twd_trend_label,
        'twd_trend_badge': twd_trend_badge,
        'twd_trend_status': twd_trend_status,
        'twd_delta': twd_delta,
        'curr_shift': round(curr_shift, 0),
        'curr_side': curr_side,
        'max_sinistro': max_sinistro,
        'max_destro': max_destro,
        'ampiezza_cono': ampiezza_cono,

        # 3. Oscillazioni
        'avg_phase_min': avg_phase_min,
        'full_cycle_min': full_cycle_min,
        'entita_media': int(entita_media),
        'curr_phase_side': curr_phase_side_text,
        'curr_phase_duration_min': curr_phase_duration_min,
        'status_phase_text': status_phase_text,

        # Chart
        'chart_data': chart_data
    }
