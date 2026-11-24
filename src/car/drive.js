'use strict';
/*
 * This drive's figures, as AK Cluster Layouts keeps them (its
 * layout_common.js driveSample), for the footers' places: the highest
 * boost (the engine running) and engine power; the 0-60 mph and 0-100 km/h
 * times, started on leaving a stop and stopped at each speed (given up after
 * 30 s), each running while it times; and the last upshift (one gear up) at
 * the highest rpm in the 0.6 s before it (under 2500 rpm: not counted).
 * Kept while the app runs. Never throws. Node 8.
 */

var KMH_60MPH = 96.56;

function known(v) { return typeof v === 'number' && isFinite(v); }

function create() {
    var s = { at: 0, boostPeak: null, powerPeak: null, armed: false, t0: 0, crossed60: false, last: { mph: null, kmh: null },
              recent: [], gear: null, shift: null };

    function run(now, x) {
        if (known(x.rpm)) {
            s.recent.push([now, x.rpm]);
            while (s.recent.length && now - s.recent[0][0] > 1200) s.recent.shift();
        }
        var g = x.gear;
        if (known(g) && g > 0 && known(s.gear) && s.gear > 0 && g === s.gear + 1) {
            var rpm = 0;
            s.recent.forEach(function (r) { if (now - r[0] < 600 && r[1] > rpm) rpm = r[1]; });
            if (rpm > 2500) s.shift = { from: s.gear, to: g, rpm: Math.round(rpm), at: now };
        }
        if (known(g)) s.gear = g;
        if (!known(x.speedKmh)) return;
        if (x.speedKmh < 1) { s.armed = true; s.t0 = 0; return; }
        if (s.armed && !s.t0) { s.t0 = now; s.crossed60 = false; }
        if (!s.t0) return;
        var t = (now - s.t0) / 1000;
        if (!s.crossed60 && x.speedKmh >= KMH_60MPH) { s.last.mph = t; s.crossed60 = true; }
        if (x.speedKmh >= 100) { s.last.kmh = t; s.t0 = 0; s.armed = false; }
        else if (t > 30) { s.t0 = 0; s.armed = false; }
    }

    /*
     * Once a frame. x: { speedKmh, rpm, gear (its number), boostBar, powerKw, engineOn }. Returns
     * { boostPeakBar, powerPeakKw, zero60S, zero100S (s: running while it times), lastShift { from, to, rpm } }.
     */
    function sample(now, x) {
        x = x || {};
        if (now - s.at >= 10) {
            s.at = now;
            if (x.engineOn !== false && known(x.boostBar) && (s.boostPeak === null || x.boostBar > s.boostPeak)) s.boostPeak = x.boostBar;
            if (known(x.powerKw) && (s.powerPeak === null || x.powerKw > s.powerPeak)) s.powerPeak = x.powerKw;
            try { run(now, x); } catch (e) { /* a figure missed, the next frame's */ }
        }
        var t = s.t0 ? (now - s.t0) / 1000 : null;
        return {
            boostPeakBar: s.boostPeak === null ? undefined : s.boostPeak,
            powerPeakKw: s.powerPeak === null ? undefined : s.powerPeak,
            zero60S: t !== null && !s.crossed60 ? t : s.last.mph === null ? undefined : s.last.mph,
            zero100S: t !== null ? t : s.last.kmh === null ? undefined : s.last.kmh,
            lastShift: s.shift ? { from: s.shift.from, to: s.shift.to, rpm: s.shift.rpm } : undefined
        };
    }

    return { sample: sample };
}

module.exports = { create: create };
