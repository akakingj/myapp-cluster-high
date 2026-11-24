'use strict';
/*
 * The battery's power a plug-in hybrid's eDrive Live app shares, for the
 * Power % gauge that stands in the rev counter's place (src/engine/state.js
 * power). eDrive Live writes it to /dev/shm/cluster-info, the folder Cluster
 * Layouts and Cluster Info read (their shared/providers.js has the format),
 * while an app there asks for it: a wanted-<app>.json of its own, written
 * at most once a second while wanted and removed as soon as it is not.
 *
 *   power.kw              the high-voltage battery's power (kW, - charging)
 *   power.outMax, .inMax  the battery's discharge and charge limits (kW)
 *
 * A file older than STALE_MS counts as gone. Read only otherwise; nothing
 * of the car's is asked. Never throws. Node 8.
 */
var fs = require('fs');
var path = require('path');

var DIR = '/dev/shm/cluster-info';
var STALE_MS = 3000;
var SCAN_MS = 250;

function known(v) { return typeof v === 'number' && isFinite(v); }

/* opts: { dir, app (the wanted file's name), log, now } */
function create(opts) {
    opts = opts || {};
    var dir = opts.dir || DIR;
    var log = opts.log || { info: function () {}, warn: function () {} };
    var nowFn = opts.now || Date.now;
    var own = path.join(dir, 'wanted-' + (opts.app || 'akakingj_cluster_id8') + '.json');
    var entries = {}, scannedAt = -Infinity, wantedAt = -Infinity, holding = false, warned = false, said = '';

    function scan(now) {
        if (now - scannedAt < SCAN_MS) return;
        scannedAt = now;
        var names = [], next = {};
        try { names = fs.readdirSync(dir); } catch (e) { entries = {}; return; }
        names.forEach(function (n) {
            if (!/\.json$/.test(n) || /^wanted(-[\w.-]+)?\.json$/.test(n)) return;   /* (what apps want: not a provider) */
            try {
                var j = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
                if (j && known(j.t) && Date.now() - j.t < STALE_MS && j.power) next[n] = j;
            } catch (e) { /* half written: the next scan */ }
        });
        entries = next;
        var list = Object.keys(next).sort().join(', ');
        if (list !== said) { said = list; log.info('providers: ' + (list || 'none sharing the battery\'s power')); }
    }
    function first(fn) {
        var ids = Object.keys(entries).sort(), i, v;
        for (i = 0; i < ids.length; i++) { v = fn(entries[ids[i]]); if (known(v)) return v; }
        return undefined;
    }
    function release() {
        if (!holding) return;
        holding = false;
        try { fs.unlinkSync(own); } catch (e) { /* gone */ }
    }
    function ask(now) {
        if (now - wantedAt < 1000) return;
        wantedAt = now;
        try {
            try { fs.mkdirSync(dir); fs.chmodSync(dir, parseInt('1777', 8)); } catch (e) { if (e.code !== 'EEXIST') throw e; }
            var tmp = own + '.' + process.pid + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify({ t: Date.now(), power: true }), { mode: parseInt('644', 8) });
            fs.renameSync(tmp, own);
            holding = true;
        } catch (e) { if (!warned) { warned = true; log.warn('providers: ' + (e && e.message || e)); } }
    }
    /* a leftover of ours from before (an app stopped mid-way) */
    holding = true; release();

    return {
        /*
         * Once a frame. wanted: a Power % gauge could show now (a plug-in
         * hybrid or an electric car, our layers up). Returns { kw, kwOut,
         * kwIn } (undefined where nobody shares them).
         */
        tick: function (wanted) {
            var now = nowFn();
            if (!wanted) { release(); entries = {}; return {}; }
            ask(now);
            scan(now);
            return {
                kw: first(function (e) { return e.power.kw; }),
                kwOut: first(function (e) { return e.power.outMax; }),
                kwIn: first(function (e) { return e.power.inMax; })
            };
        },
        release: release
    };
}

module.exports = { create: create, DIR: DIR, STALE_MS: STALE_MS };
