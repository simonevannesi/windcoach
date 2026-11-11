// WindCoach Pro - High Legibility Controller for Coach on RIB

class WindCoachApp {
    constructor() {
        this.charts = null;
        this.pollIntervalSec = 30;
        this.countdownSec = 30;
        this.countdownTimer = null;
        this.currentWindowMin = 15; // default to 15'
        
        this.init();
    }

    async init() {
        this.charts = new TacticalCharts();
        this.bindEvents();
        
        // Restore preferences
        const savedWindow = localStorage.getItem('windcoach_window');
        if (savedWindow) {
            this.currentWindowMin = parseFloat(savedWindow);
            this.updateWindowButtonsUI();
        }

        if (localStorage.getItem('windcoach_sunlight') === 'true') {
            document.body.classList.add('sunlight-mode');
        }

        // Initial fetch
        await this.loadAndSyncLatest();
        this.startCountdownLoop();
    }

    bindEvents() {
        // Sync now
        const btnSync = document.getElementById('btn-sync-now');
        if (btnSync) btnSync.addEventListener('click', () => this.syncNow());

        // Time window buttons (15', 30', 1h)
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentWindowMin = parseFloat(btn.dataset.min);
                localStorage.setItem('windcoach_window', this.currentWindowMin);
                this.updateWindowButtonsUI();
                this.fetchTactics();
            });
        });

        // Sunlight High Contrast Toggle
        const btnTheme = document.getElementById('btn-theme-toggle');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                document.body.classList.toggle('sunlight-mode');
                const isSunlight = document.body.classList.contains('sunlight-mode');
                localStorage.setItem('windcoach_sunlight', isSunlight);
            });
        }
    }

    updateWindowButtonsUI() {
        document.querySelectorAll('.time-btn').forEach(b => {
            const min = parseFloat(b.dataset.min);
            if (min === this.currentWindowMin) {
                b.className = "time-btn active py-2 rounded-lg font-black text-sm text-cyan-300 bg-slate-800 border border-cyan-500/40 text-center transition active:scale-95";
            } else {
                b.className = "time-btn py-2 rounded-lg font-black text-sm text-slate-400 hover:text-white bg-slate-950 border border-slate-800 text-center transition active:scale-95";
            }
        });
    }

    startCountdownLoop() {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownSec = this.pollIntervalSec;

        this.countdownTimer = setInterval(async () => {
            this.countdownSec--;
            if (this.countdownSec <= 0) {
                this.countdownSec = this.pollIntervalSec;
                await this.fetchTactics();
            }
            const badge = document.getElementById('countdown-badge');
            if (badge) badge.textContent = `${this.countdownSec}s`;
        }, 1000);
    }

    async loadAndSyncLatest() {
        try {
            await this.fetchTactics();
        } catch (e) {
            console.error("Initial load error:", e);
        }
    }

    async syncNow() {
        const btn = document.getElementById('btn-sync-now');
        if (btn) {
            btn.textContent = "...";
            btn.disabled = true;
        }

        try {
            await fetch('/api/sync/now', { method: 'POST' });
            await this.fetchTactics();
            this.countdownSec = this.pollIntervalSec;
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            if (btn) {
                btn.textContent = "SYNC";
                btn.disabled = false;
            }
        }
    }

    async fetchTactics() {
        try {
            const url = `/api/tactics?window_min=${this.currentWindowMin}`;
            const res = await fetch(url);
            const data = await res.json();
            this.renderDashboard(data);
        } catch (e) {
            console.error("Fetch tactics error:", e);
        }
    }

    renderDashboard(d) {
        if (!d || !d.has_data) {
            const lbl = document.getElementById('active-file-label');
            if (lbl) lbl.textContent = d.active_file || "Nessun dato";
            return;
        }

        // Header info
        const fileLbl = document.getElementById('active-file-label');
        if (fileLbl) fileLbl.textContent = d.active_file;

        const countBadge = document.getElementById('record-count-badge');
        if (countBadge) countBadge.textContent = `${d.count} r`;

        const timeBadge = document.getElementById('latest-time-badge');
        if (timeBadge) timeBadge.textContent = `${d.latest_time} UTC`;

        // ============================================================
        // 1. INTENSITÀ: IN CALO O AUMENTO E DI QUANTO
        // ============================================================
        const currTws = document.getElementById('curr-tws-val');
        if (currTws) currTws.textContent = d.curr_tws.toFixed(1);

        const twsBadge = document.getElementById('tws-trend-badge');
        if (twsBadge) {
            twsBadge.textContent = `${d.tws_trend_label} (${d.tws_trend_badge})`;
            if (d.tws_trend_status === 'rising') {
                twsBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
            } else if (d.tws_trend_status === 'falling') {
                twsBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40";
            } else {
                twsBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700";
            }
        }

        const twsAvg = document.getElementById('tws-avg-val');
        if (twsAvg) twsAvg.textContent = `${d.tws_avg.toFixed(1)} kn`;

        const twsMin = document.getElementById('tws-min-val');
        if (twsMin) twsMin.textContent = `${d.tws_min.toFixed(1)} kn`;

        const twsMax = document.getElementById('tws-max-val');
        if (twsMax) twsMax.textContent = `${d.tws_max.toFixed(1)} kn`;

        // ============================================================
        // 2. DIREZIONE: CAMBIO DIREZIONE E DI QUANTO
        // ============================================================
        const currTwd = document.getElementById('curr-twd-val');
        if (currTwd) currTwd.textContent = `${Math.round(d.curr_twd)}°`;

        const twdBadge = document.getElementById('twd-trend-badge');
        if (twdBadge) {
            twdBadge.textContent = `${d.twd_trend_label} (${d.twd_trend_badge})`;
            if (d.twd_trend_status === 'right') {
                twdBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
            } else if (d.twd_trend_status === 'left') {
                twdBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40";
            } else {
                twdBadge.className = "text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700";
            }
        }

        const meanTwd = document.getElementById('mean-twd-val');
        if (meanTwd) meanTwd.textContent = `${Math.round(d.mean_twd)}°`;

        const minMaxTwd = document.getElementById('min-max-twd-val');
        if (minMaxTwd) minMaxTwd.textContent = `${Math.round(d.max_sinistro)}° — ${Math.round(d.max_destro)}°`;

        const ampiezzaCono = document.getElementById('ampiezza-cono-val');
        if (ampiezzaCono) ampiezzaCono.textContent = `${Math.round(d.ampiezza_cono)}°`;

        // ============================================================
        // 3. OSCILLAZIONI: TEMPO MEDIO ED ENTITÀ
        // ============================================================
        const avgPhase = document.getElementById('avg-phase-val');
        if (avgPhase) avgPhase.textContent = `~ ${d.avg_phase_min.toFixed(1)} min`;

        const entitaMedia = document.getElementById('entita-media-val');
        if (entitaMedia) entitaMedia.textContent = `±${d.entita_media}°`;

        const statusPhase = document.getElementById('status-phase-text');
        if (statusPhase) statusPhase.textContent = `Stato: in fase ${d.curr_phase_side} da ${d.curr_phase_duration_min} min`;

        // Update Strip Chart
        if (this.charts) {
            this.charts.update(d);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new WindCoachApp();
});
