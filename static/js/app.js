// WindCoach Pro - High Legibility Controller for Coach on RIB (Dual Mode: Cloud Static & Local Server)

class WindCoachApp {
    constructor() {
        this.charts = null;
        this.pollIntervalSec = 30;
        this.countdownSec = 30;
        this.countdownTimer = null;
        this.currentWindowMin = 15; // default 15'
        this.cachedRecords = [];
        this.activeFilename = "SsLog-31-10-2026.csv";
        this.activeFileId = "1vAQBu_E5CDc2Rnh9dgUrkn-hqbPz7GgT";
        this.isStaticMode = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';
        
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

        // Restore cached records if any
        try {
            const savedData = localStorage.getItem('windcoach_csv_cache');
            if (savedData && typeof TacticalWindClient !== 'undefined') {
                this.cachedRecords = TacticalWindClient.parseCSV(savedData);
                if (this.cachedRecords.length > 0) {
                    const tactics = TacticalWindClient.calculateTactics(this.cachedRecords, this.currentWindowMin);
                    tactics.active_file = localStorage.getItem('windcoach_active_file') || this.activeFilename;
                    this.renderDashboard(tactics);
                }
            }
        } catch (e) {
            console.warn("Could not load local cache", e);
        }

        // Initial fetch
        await this.loadAndSyncLatest();
        this.startCountdownLoop();
    }

    bindEvents() {
        // Sync now
        const btnSync = document.getElementById('btn-sync-now');
        if (btnSync) btnSync.addEventListener('click', () => this.syncNow());

        // File upload picker
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleLocalFileUpload(e));
        }

        const btnUpload = document.getElementById('btn-upload-file');
        if (btnUpload && fileInput) {
            btnUpload.addEventListener('click', () => fileInput.click());
        }

        // Time window buttons (5', 15', 30', 1h)
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentWindowMin = parseFloat(btn.dataset.min);
                localStorage.setItem('windcoach_window', this.currentWindowMin);
                this.updateWindowButtonsUI();
                this.recalculateOrFetch();
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
                await this.loadAndSyncLatest();
            }
            const badge = document.getElementById('countdown-badge');
            if (badge) badge.textContent = `${this.countdownSec}s`;
        }, 1000);
    }

    async recalculateOrFetch() {
        if (this.isStaticMode && this.cachedRecords.length > 0 && typeof TacticalWindClient !== 'undefined') {
            const tactics = TacticalWindClient.calculateTactics(this.cachedRecords, this.currentWindowMin);
            tactics.active_file = this.activeFilename;
            this.renderDashboard(tactics);
        } else {
            await this.loadAndSyncLatest();
        }
    }

    async loadAndSyncLatest() {
        if (this.isStaticMode) {
            await this.fetchStaticData();
        } else {
            await this.fetchTacticsServer();
        }
    }

    async syncNow() {
        const btn = document.getElementById('btn-sync-now');
        if (btn) {
            btn.textContent = "...";
            btn.disabled = true;
        }

        try {
            if (!this.isStaticMode) {
                await fetch('/api/sync/now', { method: 'POST' }).catch(() => {});
            }
            await this.loadAndSyncLatest();
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

    async fetchStaticData() {
        // Try reading known files index
        try {
            const fRes = await fetch('./data/files.json?_=' + Date.now());
            if (fRes.ok) {
                const fData = await fRes.json();
                if (fData.active) this.activeFilename = fData.active;
                if (fData.files && fData.files.length) {
                    const activeObj = fData.files.find(f => f.name === this.activeFilename);
                    if (activeObj && activeObj.id) this.activeFileId = activeObj.id;
                }
            }
        } catch (e) {}

        let csvText = null;

        // 1. Try Google Drive Direct Download (CORS enabled)
        if (this.activeFileId) {
            try {
                const driveUrl = `https://drive.usercontent.google.com/download?id=${this.activeFileId}&export=download`;
                const res = await fetch(driveUrl, { cache: 'no-cache' });
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.length > 50 && text.includes(',')) {
                        csvText = text;
                    }
                }
            } catch (e) {
                console.warn("Direct Drive download failed, falling back to local latest.csv", e);
            }
        }

        // 2. Fallback to repository latest.csv
        if (!csvText) {
            try {
                const localRes = await fetch('./data/latest.csv?_=' + Date.now());
                if (localRes.ok) {
                    csvText = await localRes.text();
                }
            } catch (e) {}
        }

        if (csvText && typeof TacticalWindClient !== 'undefined') {
            try {
                localStorage.setItem('windcoach_csv_cache', csvText);
                localStorage.setItem('windcoach_active_file', this.activeFilename);
            } catch (e) {}

            this.cachedRecords = TacticalWindClient.parseCSV(csvText);
            const tactics = TacticalWindClient.calculateTactics(this.cachedRecords, this.currentWindowMin);
            tactics.active_file = this.activeFilename;
            this.renderDashboard(tactics);
        }
    }

    async fetchTacticsServer() {
        try {
            const url = `/api/tactics?window_min=${this.currentWindowMin}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Server response not ok");
            const data = await res.json();
            this.renderDashboard(data);
        } catch (e) {
            // If server offline, switch to static mode
            this.isStaticMode = true;
            await this.fetchStaticData();
        }
    }

    handleLocalFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            if (text && typeof TacticalWindClient !== 'undefined') {
                this.activeFilename = file.name;
                this.cachedRecords = TacticalWindClient.parseCSV(text);
                try {
                    localStorage.setItem('windcoach_csv_cache', text);
                    localStorage.setItem('windcoach_active_file', file.name);
                } catch (err) {}
                const tactics = TacticalWindClient.calculateTactics(this.cachedRecords, this.currentWindowMin);
                tactics.active_file = file.name;
                this.renderDashboard(tactics);
            }
        };
        reader.readAsText(file);
    }

    renderDashboard(d) {
        if (!d || !d.has_data) {
            const lbl = document.getElementById('active-file-label');
            if (lbl) lbl.textContent = d.active_file || "In attesa dati...";
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
