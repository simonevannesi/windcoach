// WindCoach Pro - Client-side Tactical Wind Engine (100% Browser Execution)

class TacticalWindClient {
    static parseCSV(text) {
        if (!text) return [];
        const lines = text.split(/\r?\n/);
        const records = [];

        for (const line of lines) {
            const raw = line.trim();
            if (!raw || raw.startsWith("'Date") || raw.startsWith("Date")) continue;
            
            const parts = raw.split(',').map(p => p.trim().replace(/^'/, ''));
            if (parts.length < 9) continue;

            const dateStr = parts[0];
            const timeStr = parts[1];
            const sogStr = parts[4];
            const twsStr = parts[6];
            const twdStr = parts[8];

            const tws = parseFloat(twsStr);
            let twd = parseFloat(twdStr.replace(/[^0-9.]/g, ''));

            if (!isNaN(tws) && !isNaN(twd) && tws >= 0) {
                twd = ((twd % 360) + 360) % 360;
                records.push({
                    date: dateStr,
                    time: timeStr.replace(' UTC', ''),
                    sog: parseFloat(sogStr) || 0.0,
                    tws: tws,
                    twd: twd
                });
            }
        }
        return records;
    }

    static circularMean(anglesDeg) {
        if (!anglesDeg || anglesDeg.length === 0) return 0.0;
        let sinSum = 0;
        let cosSum = 0;
        for (const deg of anglesDeg) {
            const rad = deg * Math.PI / 180.0;
            sinSum += Math.sin(rad);
            cosSum += Math.cos(rad);
        }
        const meanRad = Math.atan2(sinSum, cosSum);
        let meanDeg = meanRad * 180.0 / Math.PI;
        return ((meanDeg % 360.0) + 360.0) % 360.0;
    }

    static angleDiff(a, b) {
        let diff = (a - b + 180.0) % 360.0;
        if (diff < 0) diff += 360.0;
        return diff - 180.0;
    }

    static linearRegressionSlope(yVals) {
        const n = yVals.length;
        if (n < 2) return 0;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += yVals[i];
            sumXY += i * yVals[i];
            sumXX += i * i;
        }
        const denom = (n * sumXX - sumX * sumX);
        if (denom === 0) return 0;
        return (n * sumXY - sumX * sumY) / denom;
    }

    static calculateTactics(records, timeWindowMin = 15) {
        if (!records || records.length === 0) {
            return { has_data: false, message: 'Nessuna lettura registrata nel file selezionato.' };
        }

        const winMin = parseFloat(timeWindowMin) || 15.0;
        const nSamples = Math.max(4, Math.round(winMin * 2));
        const recs = records.length > nSamples ? records.slice(-nSamples) : records;

        const twds = recs.map(r => r.twd);
        const twss = recs.map(r => r.tws);

        const currRec = recs[recs.length - 1];
        const currTws = currRec.tws;
        const currTwd = currRec.twd;

        const meanTwd = this.circularMean(twds);
        const devs = twds.map(deg => this.angleDiff(deg, meanTwd));

        // 1. INTENSITÀ
        const twsAvg = twss.reduce((a, b) => a + b, 0) / twss.length;
        const twsMin = Math.min(...twss);
        const twsMax = Math.max(...twss);

        let twsDelta = 0;
        let twsTrendStatus = "stable";
        let twsTrendLabel = "STABILE";
        let twsTrendBadge = "0 kn";

        if (twss.length >= 4) {
            const slopeS = this.linearRegressionSlope(twss);
            twsDelta = Math.round(slopeS * (twss.length - 1) * 10) / 10;
            if (twsDelta >= 0.7) {
                twsTrendStatus = "rising";
                twsTrendLabel = "IN AUMENTO";
                twsTrendBadge = `+${twsDelta.toFixed(1)} kn`;
            } else if (twsDelta <= -0.7) {
                twsTrendStatus = "falling";
                twsTrendLabel = "IN CALO";
                twsTrendBadge = `${twsDelta.toFixed(1)} kn`;
            } else {
                twsTrendStatus = "stable";
                twsTrendLabel = "STABILE";
                twsTrendBadge = `${twsDelta >= 0 ? '+' : ''}${twsDelta.toFixed(1)} kn`;
            }
        }

        // 2. DIREZIONE
        const minDev = Math.min(...devs);
        const maxDev = Math.max(...devs);
        const maxSinistro = Math.round(((meanTwd + minDev) % 360.0 + 360.0) % 360.0);
        const maxDestro = Math.round(((meanTwd + maxDev) % 360.0 + 360.0) % 360.0);
        const ampiezzaCono = Math.round(maxDev - minDev);

        let twdDelta = 0;
        let twdTrendStatus = "stable";
        let twdTrendLabel = "DIREZIONE STABILE";
        let twdTrendBadge = "±0°";

        if (devs.length >= 4) {
            const slopeD = this.linearRegressionSlope(devs);
            twdDelta = Math.round(slopeD * (devs.length - 1));
            if (twdDelta >= 3) {
                twdTrendStatus = "right";
                twdTrendLabel = "ROTAZIONE A DESTRA";
                twdTrendBadge = `+${Math.abs(twdDelta)}°`;
            } else if (twdDelta <= -3) {
                twdTrendStatus = "left";
                twdTrendLabel = "ROTAZIONE A SINISTRA";
                twdTrendBadge = `-${Math.abs(twdDelta)}°`;
            } else {
                twdTrendStatus = "stable";
                twdTrendLabel = "DIREZIONE STABILE";
                twdTrendBadge = `±${Math.abs(twdDelta)}°`;
            }
        }

        // 3. OSCILLAZIONI
        const phases = [];
        let currSideTag = devs[0] >= 0 ? 'DX' : 'SX';
        let currCount = 1;

        for (let i = 1; i < devs.length; i++) {
            const tag = devs[i] >= 0 ? 'DX' : 'SX';
            if (tag === currSideTag) {
                currCount++;
            } else {
                phases.push({ side: currSideTag, durMin: currCount * 0.5 });
                currSideTag = tag;
                currCount = 1;
            }
        }
        phases.push({ side: currSideTag, durMin: currCount * 0.5 });

        const durs = phases.map(p => p.durMin);
        const avgPhaseMin = durs.length ? (durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
        const entitaMedia = Math.round(devs.map(Math.abs).reduce((a, b) => a + b, 0) / devs.length);

        const lastPhase = phases[phases.length - 1];
        const currPhaseSideText = lastPhase.side === 'DX' ? 'DESTRA' : 'SINISTRA';
        const currPhaseDurMin = Math.round(lastPhase.durMin * 10) / 10;
        const statusPhaseText = `Stato: in fase ${currPhaseSideText} da ${currPhaseDurMin} min`;

        // Chart sampling
        const step = Math.max(1, Math.floor(recs.length / 120));
        const sampled = recs.filter((_, idx) => idx % step === 0);
        if (sampled[sampled.length - 1] !== recs[recs.length - 1]) {
            sampled.push(recs[recs.length - 1]);
        }

        return {
            has_data: true,
            window_min: Math.round(winMin),
            count: recs.length,
            total_file_records: records.length,
            latest_time: currRec.time,
            latest_date: currRec.date,

            // 1. Intensità
            curr_tws: Math.round(currTws * 10) / 10,
            tws_avg: Math.round(twsAvg * 10) / 10,
            tws_min: Math.round(twsMin * 10) / 10,
            tws_max: Math.round(twsMax * 10) / 10,
            tws_trend_label: twsTrendLabel,
            tws_trend_badge: twsTrendBadge,
            tws_trend_status: twsTrendStatus,
            tws_delta: twsDelta,

            // 2. Direzione
            curr_twd: Math.round(currTwd),
            mean_twd: Math.round(meanTwd),
            twd_trend_label: twdTrendLabel,
            twd_trend_badge: twdTrendBadge,
            twd_trend_status: twdTrendStatus,
            twd_delta: twdDelta,
            max_sinistro: maxSinistro,
            max_destro: maxDestro,
            ampiezza_cono: ampiezzaCono,

            // 3. Oscillazioni
            avg_phase_min: Math.round(avgPhaseMin * 10) / 10,
            entita_media: entitaMedia,
            curr_phase_side: currPhaseSideText,
            curr_phase_duration_min: currPhaseDurMin,
            status_phase_text: statusPhaseText,

            // Chart
            chart_data: {
                labels: sampled.map(r => r.time),
                twd: sampled.map(r => r.twd),
                tws: sampled.map(r => r.tws)
            }
        };
    }
}

if (typeof module !== 'undefined') {
    module.exports = TacticalWindClient;
}
