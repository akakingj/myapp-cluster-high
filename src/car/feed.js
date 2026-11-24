'use strict';
/*
 * Readings from another app on the head unit.
 *
 * BeeM-Flash (waliworld/BeeM-Flash) reads channels this cluster cannot:
 * oil pressure, timing, AFR, per-cylinder figures - things that come off
 * the engine unit over UDS rather than the bus. It writes its current
 * sample to one small file; we read it and let the matching channels drive
 * the gauges, so oil pressure stops reading dashes.
 *
 * The contract is the file read below (PATHS, read()). Nothing of BeeM-Flash
 * is needed here: a file that is missing, stale, truncated or malformed just
 * means no feed, and the cluster carries on with the car's own signals.
 *
 * AK Cluster ID8 runs with the feed off (src/car/main.js feedModeOf: the app
 * has no setting for it): its readings come from the engine unit
 * (src/car/engine.js), and this file is not looked for.
 *
 * Node 8.
 */

var fs = require('fs');
var path = require('path');

var PATHS = ['/dev/shm/beem-flash/cluster.json', '/run/beem-flash/cluster.json'];
var POLL_MS = 200;        /* the feed publishes at 5-10 Hz */
var STALE_MS = 2500;      /* older than this and we stop believing it */
var MAX_BYTES = 65536;

function num(v) { return typeof v === 'number' && isFinite(v) ? v : undefined; }

/* opts: { log, now, path } ; env BEEM_FEED overrides the path */
function create(opts) {
    opts = opts || {};
    var log = opts.log || { info: function () {}, warn: function () {} };
    var now = opts.now || Date.now;
    var paths = opts.path ? [opts.path]
        : process.env.BEEM_FEED ? [process.env.BEEM_FEED] : PATHS;

    var chan = {};        /* key -> { value, unit, label, min, max } */
    var at = 0;           /* when we last read a good sample */
    var timer = null;
    var stopped = false;
    var seen = false;
    var present = false, presentAt = -Infinity;

    function parse(txt) {
        var j = JSON.parse(txt);
        var list = j && j.channels;
        if (!list || typeof list.length !== 'number') return false;
        var next = {}, i, c;
        for (i = 0; i < list.length && i < 128; i++) {
            c = list[i];
            if (!c || typeof c.key !== 'string' || num(c.value) === undefined) continue;
            next[c.key] = {
                value: c.value,
                unit: typeof c.unit === 'string' ? c.unit : '',
                label: typeof c.label === 'string' ? c.label : c.key,
                min: num(c.min), max: num(c.max)
            };
        }
        chan = next;
        /* the sample's own stamp if it looks sane, else when we read it */
        var t = num(j.t);
        at = t && Math.abs(now() - t) < 60000 ? t : now();
        if (!seen) { seen = true; log.info('feed: BeeM-Flash connected (' + Object.keys(chan).length + ' channels)'); }
        return true;
    }

    function poll() {
        if (stopped) return;
        var i, any = false;
        for (i = 0; i < paths.length; i++) {
            try {
                var st = fs.statSync(paths[i]);
                any = true;
                if (!st.isFile() || st.size > MAX_BYTES) continue;
                if (now() - st.mtime.getTime() > STALE_MS) continue;
                if (parse(fs.readFileSync(paths[i], 'utf8'))) return;
            } catch (e) { /* no file, or half written: try the next */ }
        }
        /* BeeM-Flash removes the file on purpose (paused, a tool on its
           bridge, a flash running): the readings go at once, not 2.5 s later */
        if (!any) at = 0;
    }

    return {
        /* (may be started again after a stop: the setting can be turned back on) */
        start: function () {
            if (timer) return;
            stopped = false;
            timer = setInterval(poll, POLL_MS);
            if (timer.unref) timer.unref();
            poll();
        },
        /* stopped, nothing of it is live: no reading outlasts the feed being turned off */
        stop: function () {
            stopped = true;
            if (timer) clearInterval(timer);
            timer = null;
            chan = {}; at = 0;
        },
        running: function () { return !!timer; },
        /* live only while the last good sample is recent */
        live: function () { return at > 0 && now() - at < STALE_MS; },
        /* BeeM-Flash has fed at some time since this started (it is on this head unit) */
        seen: function () { return seen; },
        /*
         * BeeM-Flash's own folder is there: it has run since the head unit
         * started (the folder is in RAM, and BeeM-Flash makes it for its
         * feed), whether or not it is feeding now. Looked at no more than
         * once a second.
         */
        present: function () {
            var t = now();
            if (t - presentAt < 1000 && t >= presentAt) return present;
            presentAt = t;
            present = false;
            for (var i = 0; i < paths.length && !present; i++) {
                try { present = fs.statSync(path.dirname(paths[i])).isDirectory(); } catch (e) { /* not there */ }
            }
            return present;
        },
        value: function (key) {
            if (!this.live()) return undefined;
            var c = chan[key];
            return c ? c.value : undefined;
        },
        channels: function () { return this.live() ? chan : {}; },
        info: function () {
            if (!seen) return 'BeeM-Flash: not running';
            if (!this.live()) return 'BeeM-Flash: no recent reading';
            return 'BeeM-Flash: ' + Object.keys(chan).length + ' channels';
        }
    };
}

module.exports = { create: create, PATHS: PATHS, POLL_MS: POLL_MS, STALE_MS: STALE_MS };
