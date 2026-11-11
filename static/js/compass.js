// WindCoach Pro - Simplified Tactical Compass (Wind & Cone only)

class TacticalCompass {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.size = 280;
        this.center = this.size / 2;
        this.radius = 110;
        this.initSVG();
    }

    initSVG() {
        if (!this.container) return;
        this.container.innerHTML = `
            <svg id="svg-tactical-compass" viewBox="0 0 ${this.size} ${this.size}" class="w-full h-full select-none">
                <defs>
                    <linearGradient id="grad-wind-needle" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#22d3ee" />
                        <stop offset="100%" stop-color="#0284c7" />
                    </linearGradient>
                    <filter id="glow-wind-needle" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#06b6d4" flood-opacity="0.7"/>
                    </filter>
                </defs>

                <!-- Base Dial -->
                <circle cx="${this.center}" cy="${this.center}" r="${this.radius + 14}" fill="#0f172a" stroke="#334155" stroke-width="2" />
                <circle cx="${this.center}" cy="${this.center}" r="${this.radius}" fill="#090d16" stroke="#1e293b" stroke-width="1.5" />

                <!-- Graduations -->
                <g id="compass-ticks"></g>

                <!-- Oscillation Cone / Sector Arc (Cyan translucent) -->
                <path id="compass-oscillation-arc" d="" fill="rgba(6, 182, 212, 0.2)" stroke="#06b6d4" stroke-width="2" stroke-dasharray="3 2" />

                <!-- Mean Wind Axis (Dashed Centerline) -->
                <line id="compass-axis-line" x1="${this.center}" y1="${this.center}" x2="${this.center}" y2="30" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 3" />

                <!-- Center Bullseye -->
                <circle cx="${this.center}" cy="${this.center}" r="3" fill="#64748b" />
                <circle cx="${this.center}" cy="${this.center}" r="${this.radius * 0.45}" fill="none" stroke="#1e293b" stroke-dasharray="2 2" />

                <!-- Current TWD Needle (points from outside towards center) -->
                <g id="compass-needle" transform="rotate(0 ${this.center} ${this.center})">
                    <polygon points="${this.center},${this.center - this.radius + 6} ${this.center - 7},${this.center - this.radius - 10} ${this.center + 7},${this.center - this.radius - 10}" fill="url(#grad-wind-needle)" filter="url(#glow-wind-needle)" />
                    <line x1="${this.center}" y1="${this.center - this.radius - 10}" x2="${this.center}" y2="${this.center - this.radius - 20}" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" />
                    <!-- Needle degree label -->
                    <rect x="${this.center - 18}" y="${this.center - this.radius - 38}" width="36" height="15" rx="3" fill="#0369a1" stroke="#38bdf8" stroke-width="1" />
                    <text id="compass-needle-val" x="${this.center}" y="${this.center - this.radius - 27}" font-size="10" font-weight="bold" font-family="monospace" fill="#ffffff" text-anchor="middle">000°</text>
                </g>
            </svg>
        `;
        this.renderTicks();
    }

    renderTicks() {
        const group = document.getElementById("compass-ticks");
        if (!group) return;

        let html = '';
        for (let deg = 0; deg < 360; deg += 10) {
            const rad = (deg - 90) * Math.PI / 180;
            const isCardinal = (deg % 90 === 0);
            const isMajor = (deg % 30 === 0);
            const tickLen = isCardinal ? 9 : (isMajor ? 6 : 3.5);
            const strokeColor = isCardinal ? '#38bdf8' : (isMajor ? '#94a3b8' : '#475569');
            const strokeWidth = isCardinal ? 2 : (isMajor ? 1.5 : 1);

            const x1 = this.center + Math.cos(rad) * (this.radius - tickLen);
            const y1 = this.center + Math.sin(rad) * (this.radius - tickLen);
            const x2 = this.center + Math.cos(rad) * this.radius;
            const y2 = this.center + Math.sin(rad) * this.radius;

            html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;

            if (isCardinal || isMajor) {
                const textR = this.radius - 17;
                const tx = this.center + Math.cos(rad) * textR;
                const ty = this.center + Math.sin(rad) * textR + 3.5;
                let label = deg.toString().padStart(3, '0');
                let color = "#94a3b8";
                let weight = "normal";

                if (deg === 0) { label = 'N'; color = '#38bdf8'; weight = 'bold'; }
                else if (deg === 90) { label = 'E'; color = '#38bdf8'; weight = 'bold'; }
                else if (deg === 180) { label = 'S'; color = '#38bdf8'; weight = 'bold'; }
                else if (deg === 270) { label = 'W'; color = '#38bdf8'; weight = 'bold'; }

                html += `<text x="${tx}" y="${ty}" font-size="8.5" font-weight="${weight}" fill="${color}" text-anchor="middle" font-family="sans-serif">${label}</text>`;
            }
        }
        group.innerHTML = html;
    }

    polarToCartesian(angleDeg, r) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return {
            x: this.center + Math.cos(rad) * r,
            y: this.center + Math.sin(rad) * r
        };
    }

    describeArc(startAngle, endAngle, radius) {
        let diff = (endAngle - startAngle + 360) % 360;
        if (diff === 0) diff = 360;

        const start = this.polarToCartesian(startAngle, radius);
        const end = this.polarToCartesian(endAngle, radius);
        const largeArcFlag = diff <= 180 ? "0" : "1";

        return [
            `M ${this.center} ${this.center}`,
            `L ${start.x} ${start.y}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
            "Z"
        ].join(" ");
    }

    update(d) {
        if (!d || !d.has_data) return;

        const currTwd = d.curr_twd || 0;
        const meanTwd = d.mean_twd || 0;
        const minTwd = d.max_sinistro !== undefined ? d.max_sinistro : ((meanTwd - 15 + 360) % 360);
        const maxTwd = d.max_destro !== undefined ? d.max_destro : ((meanTwd + 15) % 360);

        // Update needle rotation
        const needle = document.getElementById("compass-needle");
        if (needle) {
            needle.setAttribute("transform", `rotate(${currTwd} ${this.center} ${this.center})`);
            const label = document.getElementById("compass-needle-val");
            if (label) label.textContent = `${Math.round(currTwd)}°`;
        }

        // Update oscillation sector arc (from left to right)
        const arc = document.getElementById("compass-oscillation-arc");
        if (arc) {
            const arcPath = this.describeArc(minTwd, maxTwd, this.radius);
            arc.setAttribute("d", arcPath);
        }

        // Update Mean Axis line
        const axisLine = document.getElementById("compass-axis-line");
        if (axisLine) {
            const p = this.polarToCartesian(meanTwd, this.radius - 5);
            axisLine.setAttribute("x2", p.x);
            axisLine.setAttribute("y2", p.y);
        }
    }
}
