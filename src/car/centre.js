'use strict';
/*
 * What shows in the middle of a style: the phone's map, BMW's own map,
 * Turn View's camera, our own turn card, or nothing.
 *
 * The pictures are not ours and are not moved: the instrument cluster has
 * one map slot (416,120 1088x480 of the panel), under everything we draw,
 * and whatever holds it - BMW's navigation, Maps on cluster, Turn View -
 * is seen through the opening a style makes over it. So all there is to
 * decide here is when that opening is open, and to switch Turn View's
 * camera on and off.
 *
 *   waze    the phone's map (Maps on cluster: Waze, Apple or Google Maps
 *           from CarPlay / Android Auto). Open while that service says its
 *           map is on the cluster; closed, the style whole, while it is
 *           not - so a drive without the phone looks as it should.
 *   map     always open: BMW's own map view, or whatever else the cluster
 *           has in the slot (the phone's map takes it over by itself).
 *   camera  Turn View's camera: switched on, and open while it shows.
 *   turn    no opening: the next turn drawn as a card (M styles).
 *   off     closed.
 *
 * Maps on cluster (robertnisipeanu/idrive-apps, native/waze-on-cluster)
 *   Only read: its status file, once a second (state: showing, starting,
 *   frozen, idle, off, error; target; cluster 0/1). Earlier versions of
 *   this file asked it to draw in the panel instead
 *   ({"cmd":"start","target":"panel"}) and waited for it to say so; the
 *   service has no such command any more, so the opening waited for ever
 *   and the map never showed. A map an earlier version did move is sent
 *   back once, and then nothing is ever sent again.
 *
 * Turn View (IterioDev/car-apps, PolyForm Strict: used as installed,
 * nothing of it copied)
 *   On iDrive 7 its tool draws the front camera in the same slot. Its
 *   control socket pushes its state on connect: settings.enabled,
 *   status.camera, status.route and status.maneuver { kind, angle, side,
 *   exit, text }. The tool starts the Turn View app (which asks the camera
 *   ECU for the picture) only while NO client is connected, so we never
 *   stay connected: connect, read the first line, close. Turn View is off
 *   at every car start on iDrive 7; the "camera" centre switches it on,
 *   and off again when we leave, only if we switched it on - which also
 *   gives the slot back to the map.
 *
 * Never throws: every socket and file error ends in a status text.
 * Node 8.
 */

var fs = require('fs');
var net = require('net');
var path = require('path');

var PATHS = {
    wazeStatus: '/run/waze-on-cluster/status.json',
    wazeCtl: '/dev/shm/waze-on-cluster/ctl.sock',
    tvCtl: '/run/iteriodev-turnview/ctl.sock'
};
var POLL_MS = 1000;
var STALE_MS = 10000;        /* a status file older than this: the service isn't running */
var RETRY_MS = 5000;
var LINGER_MS = 800;
var READ_MS = 1500;          /* how long a Turn View poll waits for its first line */
var MANEUVER_MS = 5000;      /* a maneuver not confirmed for this long is dropped */
/* how long the opening takes to open and to shut: long enough to be seen
   as a fade (the first, 180 and 110 ms, read as a switch on the car) */
var OPEN_MS = 420, CLOSE_MS = 260;

var PREFS = ['waze', 'map', 'camera', 'turn', 'off'];

function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

/*
 * opts: { log, now, dataDir, paths: { wazeStatus, wazeCtl, tvCtl } }
 * env WAZE_STATUS, WAZE_CTL, TURNVIEW_CTL override the paths (car-sim).
 */
function create(opts) {
    opts = opts || {};
    var log = opts.log || { info: function () {}, warn: function () {} };
    var now = opts.now || Date.now;
    var p = opts.paths || {};
    var paths = {
        wazeStatus: process.env.WAZE_STATUS || p.wazeStatus || PATHS.wazeStatus,
        wazeCtl: process.env.WAZE_CTL || p.wazeCtl || PATHS.wazeCtl,
        tvCtl: process.env.TURNVIEW_CTL || p.tvCtl || PATHS.tvCtl
    };
    var memoFile = opts.dataDir ? path.join(opts.dataDir, 'centre.json') : null;
    var memo = { wazeMoved: false, tvEnabled: false };
    try {
        var m = JSON.parse(fs.readFileSync(memoFile, 'utf8'));
        memo.wazeMoved = m.wazeMoved === true;
        memo.tvEnabled = m.tvEnabled === true;
    } catch (e) { /* first run */ }

    function saveMemo() {
        if (!memoFile) return;
        try { fs.writeFileSync(memoFile, JSON.stringify(memo)); } catch (e) {
            log.warn('centre: cannot save ' + memoFile + ' (' + e.message + ')');
        }
    }

    var pref = 'off';            /* what the theme asks for right now */
    var timer = null;
    var stopped = false;
    var ticks = 0;

    /* ------------------------------------------------- the phone's map */
    var waze = { st: null, sending: false };

    function wazeWanted() { return pref === 'waze'; }
    /* the service says its map is on the cluster (or about to be) */
    function wazeLive() {
        var s = waze.st;
        if (!s || s.cluster === false) return false;
        if (s.target && s.target !== 'map' && s.target !== 'panel') return false;      /* shown somewhere else */
        return s.state === 'showing' || s.state === 'frozen' || s.state === 'starting';
    }
    function wazeUp() { return wazeWanted() && wazeLive(); }

    function pollWaze() {
        fs.stat(paths.wazeStatus, function (err, st) {
            if (stopped) return;
            if (err || now() - st.mtime.getTime() > STALE_MS) { waze.st = null; return; }
            fs.readFile(paths.wazeStatus, 'utf8', function (e, txt) {
                var s = null;
                try {
                    if (!e) {
                        var j = JSON.parse(txt);
                        s = { state: String(j.state || ''), target: j.target == null ? null : String(j.target),
                              reason: typeof j.reason === 'string' ? j.reason.slice(0, 60) : '',
                              /* (absent in older versions: then the map is for the cluster) */
                              cluster: !(j.cluster === 0 || j.cluster === false || j.cluster === '0') };
                    }
                } catch (x) { s = null; }
                waze.st = s;
                giveBack();
            });
        });
    }

    /*
     * A map an earlier version of ours moved into the panel goes back to
     * its own slot: asked once (a service that still knows the command
     * moves it; one that does not never moved it), then forgotten.
     */
    function giveBack(cb) {
        if (!memo.wazeMoved || waze.sending) { if (cb) cb(); return; }
        var s = waze.st;
        if (!s || s.target !== 'panel') {
            if (s) { memo.wazeMoved = false; saveMemo(); }       /* it is where it belongs */
            if (cb) cb();
            return;
        }
        memo.wazeMoved = false;
        saveMemo();
        sendWaze('map', cb);
    }

    function sendWaze(target, cb) {
        waze.sending = true;
        var done = false, sock;
        function finish(problem) {
            if (done) return;
            done = true;
            clearTimeout(t);
            try { sock.destroy(); } catch (e) { /* closed */ }
            waze.sending = false;
            log.info('centre: the phone\'s map given back to its own slot' + (problem ? ' (' + problem + ')' : ''));
            if (cb) cb();
        }
        var t = setTimeout(function () { finish(null); }, LINGER_MS + 1000);
        try { sock = net.connect(paths.wazeCtl); } catch (e) { return finish(e.code || e.message); }
        sock.on('error', function (e) { finish(e.code || e.message); });
        sock.on('close', function () { finish(null); });
        sock.on('connect', function () {
            sock.write(JSON.stringify({ cmd: 'start', target: target }) + '\n');
            setTimeout(function () { try { sock.end(); } catch (e) { /* closed */ } }, LINGER_MS);
        });
    }

    function wazeText() {
        var s = waze.st;
        if (!s) return 'Maps on cluster is not running';
        if (s.state === 'unsupported') return 'Maps on cluster: car not supported';
        if (s.state === 'off' || !s.cluster) return 'Cluster map is switched off in Maps on cluster';
        if (s.target && s.target !== 'map' && s.target !== 'panel') return 'Phone map is shown by another app';
        if (s.state === 'showing') return 'Phone map on the cluster';
        if (s.state === 'frozen') return 'Phone map frozen, waiting for the phone';
        if (s.state === 'starting') return 'Phone map starting' + (s.reason ? ' (' + s.reason + ')' : '');
        if (s.state === 'error') return 'Maps on cluster: ' + (s.reason || 'error');
        return 'No map from the phone yet';
    }

    /* ------------------------------------------------------- Turn View */
    var tv = { st: null, at: 0, busy: false, problem: null, nextSet: 0 };

    function tvWanted() { return pref === 'camera' || pref === 'turn' || pref === 'waze'; }

    /* Connect, take the state the tool pushes on connect, close. Optionally
       send one request first. */
    function tvTalk(request, cb) {
        if (tv.busy) return;
        tv.busy = true;
        var buf = '', done = false, sock;
        function finish(problem, state) {
            if (done) return;
            done = true;
            clearTimeout(t);
            try { sock.destroy(); } catch (e) { /* closed */ }
            tv.busy = false;
            tv.problem = problem || null;
            if (state) { tv.st = state; tv.at = now(); }
            else if (problem) tv.st = null;
            if (cb) cb(!problem);
        }
        var t = setTimeout(function () { finish('no answer'); }, READ_MS);
        try { sock = net.connect(paths.tvCtl); } catch (e) { return finish(e.code || e.message); }
        sock.setEncoding('utf8');
        sock.on('error', function (e) { finish(e.code || e.message); });
        sock.on('close', function () { finish(tv.st && now() - tv.at < READ_MS ? null : 'closed'); });
        sock.on('connect', function () {
            if (request) sock.write(JSON.stringify(request) + '\n');
        });
        sock.on('data', function (d) {
            buf += d;
            if (buf.length > 65536) return finish('too long');
            var n;
            while ((n = buf.indexOf('\n')) >= 0) {
                var line = buf.slice(0, n);
                buf = buf.slice(n + 1);
                var m = null;
                try { m = JSON.parse(line); } catch (e) { continue; }
                /* after a request, wait for the state that answers it */
                if (m && m.state && (!request || !request.settings ||
                        (m.state.settings && m.state.settings.enabled === request.settings.enabled))) {
                    return finish(null, m.state);
                }
            }
        });
    }

    function tvEnabled() { return !!(tv.st && tv.st.settings && tv.st.settings.enabled); }
    function tvStatus() { return (tv.st && tv.st.status) || {}; }
    function cameraUp() {
        return pref === 'camera' && tvEnabled() && tvStatus().camera === 'decoding' && now() - tv.at < STALE_MS;
    }

    function pollTv() {
        var wantOn = pref === 'camera';
        tvTalk(null, function (ok) {
            if (!ok || stopped || now() < tv.nextSet) return;
            if (wantOn && !tvEnabled()) setTv(true);
            else if (!wantOn && memo.tvEnabled && tvEnabled()) setTv(false);
            else if (!wantOn && memo.tvEnabled && !tvEnabled()) { memo.tvEnabled = false; saveMemo(); }
        });
    }

    function setTv(on) {
        tv.nextSet = now() + RETRY_MS;
        tvTalk({ op: 'set', settings: { enabled: on } }, function (ok) {
            if (!ok) return;
            memo.tvEnabled = on;
            saveMemo();
            log.info('centre: Turn View switched ' + (on ? 'on' : 'off'));
        });
    }

    function maneuver() {
        if (!tv.st || now() - tv.at > MANEUVER_MS) return null;
        var s = tvStatus();
        var m = s.maneuver;
        if (!m || !m.kind || m.kind === 'ignored' || s.route === 'none') return null;
        return {
            kind: String(m.kind),
            angle: typeof m.angle === 'number' ? m.angle : 0,
            side: m.side < 0 ? -1 : 1,
            exit: typeof m.exit === 'number' ? m.exit : 0,
            text: typeof m.text === 'string' ? m.text.slice(0, 16) : ''
        };
    }

    function tvText() {
        if (tv.problem) return 'Turn View not running';
        if (!tv.st) return 'Turn View: checking';
        var s = tvStatus();
        if (pref === 'camera') {
            if (!tvEnabled()) return 'Switching Turn View on';
            if (s.camera === 'decoding') return 'Turn View camera showing';
            if (s.camera === 'waiting') return 'Waiting for the camera';
            return 'Turn View camera: ' + (s.camera || 'off');
        }
        return s.route === 'active' ? 'Route active' : 'No route';
    }

    /* ---------------------------------------------- the centre's mode */
    var shown = 'neutral';       /* what is in the window now */
    var phase = 'idle';          /* idle | closing | opening */
    var phaseAt = 0;
    var open = 0;                /* 0..1, eased, what the theme's window uses */

    function targetMode() {
        if (pref === 'map') return 'map';                   /* always: whatever the cluster has there */
        if (pref === 'waze' && wazeUp()) return 'map';
        if (pref === 'camera' && cameraUp()) return 'camera';
        if (pref !== 'off' && maneuver()) return 'turn';
        return 'neutral';
    }
    function isVideo(m) { return m === 'map' || m === 'camera'; }

    /* One step of the fades; called every frame by state(). */
    function step(t) {
        var want = targetMode();
        if (phase === 'idle') {
            if (want !== shown) {
                if (isVideo(shown) && open > 0) { phase = 'closing'; phaseAt = t; }
                else { shown = want; if (isVideo(shown)) { phase = 'opening'; phaseAt = t; } }
            }
        }
        if (phase === 'closing') {
            open = 1 - smooth((t - phaseAt) / CLOSE_MS);
            if (open <= 0) {
                open = 0;
                shown = want;
                phase = isVideo(shown) ? 'opening' : 'idle';
                phaseAt = t;
            }
        } else if (phase === 'opening') {
            if (want !== shown) { phase = 'closing'; phaseAt = t - CLOSE_MS * (1 - open); }
            else {
                open = smooth((t - phaseAt) / OPEN_MS);
                if (open >= 1) { open = 1; phase = 'idle'; }
            }
        } else {
            open = isVideo(shown) ? 1 : 0;
        }
    }

    function poll() {
        if (stopped) return;
        try {
            pollWaze();
            /* Turn View logs every connection: every 2 s is plenty for a turn */
            ticks++;
            if ((tvWanted() || memo.tvEnabled) && (ticks % 2 === 1 || pref === 'camera')) pollTv();
        } catch (e) { log.warn('centre: ' + e.message); }
    }

    return {
        PREFS: PREFS,
        start: function () {
            if (timer) return;
            timer = setInterval(poll, POLL_MS);
            poll();
        },
        /* 'waze' | 'map' | 'camera' | 'turn' | 'off': only while our layers
           are up; anything else closes the opening and gives the camera back. */
        want: function (p) {
            p = PREFS.indexOf(p) >= 0 ? p : 'off';
            if (p === pref) return;
            pref = p;
            tv.nextSet = 0;
            poll();
        },
        state: function () {
            var t = now();
            step(t);
            return { mode: shown, open: open, maneuver: maneuver() };
        },
        info: function () {
            return { waze: wazeText(), turnView: tvText(), wazeUp: wazeUp(), cameraUp: cameraUp(),
                     wazeLive: wazeLive(), want: pref, mode: targetMode() };
        },
        /* Close up: the camera off again if we switched it on, and a map an
           earlier version moved put back. cb once both were asked (best effort). */
        stop: function (cb) {
            stopped = true;
            if (timer) clearInterval(timer);
            timer = null;
            pref = 'off';
            var pending = 0;
            function one() { if (--pending <= 0 && cb) cb(); }
            if (memo.wazeMoved && waze.st && waze.st.target === 'panel') {
                pending++; waze.sending = false; giveBack(one);
            }
            if (memo.tvEnabled && tvEnabled()) {
                pending++; tv.busy = false;
                tvTalk({ op: 'set', settings: { enabled: false } }, function (ok) {
                    if (ok) { memo.tvEnabled = false; saveMemo(); }
                    one();
                });
            }
            if (!pending && cb) cb();
        }
    };
}

module.exports = { create: create, PATHS: PATHS, PREFS: PREFS, OPEN_MS: OPEN_MS, CLOSE_MS: CLOSE_MS };
