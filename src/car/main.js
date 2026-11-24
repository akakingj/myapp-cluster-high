'use strict';
/*
 * The cluster service: signals in, uniforms out.
 *
 * Free of the app framework on purpose. It takes a `host` that supplies the
 * three things only the head unit can give - signal subscriptions, settings
 * and a log - so the whole service runs against a fake host in the tests,
 * and the app shell (apps/mgu_styles/main.js) stays a thin adapter.
 *
 * It must never throw. On the car an unexpected exit makes BMW's handler wipe
 * the app's data, and a second one uninstalls it (kit/runtime/mgu.js).
 *
 * Node 8.
 */

var ClusterRenderMod = require('./cluster_render_client.js');
var Driver = require('./cluster.js');
var Vehicle = require('./vehicle.js');
var Atlas = require('./atlas.js');
var State = require('../engine/state.js');
var Theme = require('../theme/index.js');
var Centre = require('./centre.js');
var Engine = require('./engine.js');
var fs = require('fs');
var path = require('path');
var Feed = require('./feed.js');
var Message = require('./message.js');
var Smooth = require('./smooth.js');
var Presence = require('./presence.js');
var Panel = require('../geometry/panel.js');
var core = require('../shaders/core.js');
var parts = require('../shaders/parts.js');
var dialShaders = require('../shaders/dial.js');
var mShaders = require('../shaders/mcluster.js');
var tShaders = require('../shaders/tcluster.js');

var FRAME_MS = 16;            /* 60 Hz by default; settings.refreshHz picks 15-60 */
var IDLE_MS = 250;            /* while nothing is drawn */
var SETTLE_MS = 400;          /* settings changes, while someone scrolls through them */
/*
 * Where the readings the bus does not carry come from. The app has no setting for it: the engine unit only ("off").
 * The other modes stay for a host that names one (settings.beemFlash):
 *   auto  BeeM-Flash, on a head unit that has it; the engine unit on one
 *         that does not. A head unit "has it" while BeeM-Flash is feeding,
 *         while its folder is there (it has run since the head unit
 *         started), and for two weeks after it last fed: there the engine
 *         unit is never asked, feeding or not, so nothing of ours can get
 *         in the way of what BeeM-Flash does on the same link.
 *   on    BeeM-Flash only: nothing is ever asked of the engine unit
 *   off   the engine unit only: BeeM-Flash's feed is not even looked for
 */
var FEED_MODES = ['auto', 'on', 'off'];
var ENGINE_RUNS_RPM = 400;    /* the engine unit is asked only above this: never with the engine off */
/*
 * ... except stopped by auto start-stop: the car is still in drive readiness
 * then (VehicleCondition FAHREN), which no control unit is coded or flashed
 * in, and a gauge that fell back to dashes at every traffic light would be
 * no gauge. Only where the car reports that state, and for this long after
 * the engine last ran.
 */
var DRIVE_READINESS = 10;     /* statusConditionVehicle FAHREN (src/car/vehicle.js) */
var AUTO_STOP_MS = 180000;
var BEEM_KEPT_MS = 14 * 24 * 3600 * 1000;   /* how long a head unit counts as having BeeM-Flash after it last fed */
var BUS_BOOST_MS = 5000;      /* no boost from the Sport Display for this long: the engine unit's is used */

function feedModeOf(settings) {
    var m = settings ? settings.beemFlash : undefined;
    if (m === true) return 'on';
    if (m === false) return 'off';
    return FEED_MODES.indexOf(m) >= 0 ? m : 'off';
}

function shaders() {
    var out = {}, k, i;
    var sets = [core, parts, dialShaders, mShaders, tShaders];
    for (i = 0; i < sets.length; i++) {
        for (k in sets[i]) {
            if (Object.prototype.hasOwnProperty.call(sets[i], k)) out[k] = sets[i][k];
        }
    }
    return out;
}

/*
 * Whether the car is in a state to draw on. VehicleCondition (kit numbering):
 * off while parked or switching off (5 or lower, 12), and no new layout while
 * drive readiness is starting (8) - a target mapped while the KOMBI switches
 * on or off can drop the cluster's display service (idv7lol, kit Redline).
 * A car that sends no state falls back to a live engine-speed reading.
 */
function carState(raw) {
    var c = raw.condition;
    if (typeof c === 'number') {
        if (c <= 5 || c === 12) return 'off';
        if (c === 8) return 'starting';
        return 'on';
    }
    return typeof raw.rpm === 'number' ? 'on' : 'off';
}

/*
 * The car's interior light as an accent. The light's own bytes carry its
 * brightness, and a dimmed colour would leave the cluster barely lit, so
 * only the hue is taken: the brightest channel is pulled up to full. A
 * light that is off (or all but off) leaves the accent alone.
 */
function ambientAccent(r, g, b) {
    if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') return null;
    var mx = Math.max(r, g, b);
    if (!(mx > 12)) return null;                 /* off, or too dark to read a hue from */
    return [r / mx, g / mx, b / mx];
}

/* Tank sizes, litres, only to turn the fuel level into a percentage. */
function profileTank(profile) {
    return profile.tankLitres || 60;
}

/*
 * host: {
 *   subscribe(signals, onValue)   onValue(service, field, value)
 *   settings()                    the current settings object
 *   onSettingsChanged(fn)         optional
 *   log                           { info, warn }
 *   dataDir                       optional: where the centre remembers what it moved
 *   diag()                        optional: the kit's read-only diagnostic link and DID reader,
 *                                 { reader, link, ready } (src/car/engine.js); made on first use
 * }
 * deps lets a test pass its own ClusterRender, clock and atlas.
 */
function start(host, deps) {
    deps = deps || {};
    var log = host.log || { info: function () {}, warn: function () {} };
    function now() { return deps.now ? deps.now() : Date.now(); }

    var loaded = deps.atlas && deps.atlasPixels ? null : Atlas.load();
    var atlas = deps.atlas || loaded.meta;
    var atlasPixels = deps.atlasPixels || loaded.pixels;

    var settings = {};
    var profile = null;
    var theme = null;
    var driver = null;
    var cr = deps.cr || new ClusterRenderMod.ClusterRender(deps.appId || 'wali_mgu_styles');
    /* taking turns with the AK Cluster apps (presence.js) */
    var presence = deps.presence || Presence.create({ app: deps.appId || 'wali_mgu_styles' });
    var reader = Vehicle.createReader({});
    var smoother = Smooth.create();
    /* how long one frame is, from the refresh rate setting */
    function frameMs() {
        var hz = theme && theme.settings && theme.settings.refreshHz;
        return hz ? Math.max(16, Math.round(1000 / hz)) : FRAME_MS;
    }
    var SHADERS = shaders();
    /* the Track theme's centre: Waze and Turn View, asked for, never held */
    var centre = deps.centre || Centre.create({ log: log, dataDir: host.dataDir });
    try { centre.start(); } catch (e) { log.warn('centre: ' + e); }
    /* readings another app on the head unit can supply (src/car/feed.js): started in
       configure(), and only in a mode other than "off" (feedModeOf: none, for this app) */
    var feed = deps.feed || Feed.create({ log: log, now: now });
    /* the same readings from the engine unit itself: where this app's come from */
    var engine = deps.engine || Engine.create({
        log: log, now: now,
        open: host.diag ? function () { return host.diag(); } : null
    });
    var needs = {};              /* what the style on the cluster shows of those readings */
    var feedSaid = null;
    var engineRanAt = -Infinity; /* when the engine was last seen running */
    /* when BeeM-Flash last fed on this head unit, kept across starts (readings.json) */
    var memoFile = host.dataDir ? path.join(host.dataDir, 'readings.json') : null;
    var beemFedAt = -Infinity, beemSavedAt = -Infinity;
    try {
        var memo = JSON.parse(fs.readFileSync(memoFile, 'utf8'));
        if (typeof memo.beemFedAt === 'number' && isFinite(memo.beemFedAt)) beemFedAt = beemSavedAt = memo.beemFedAt;
    } catch (e) { /* never, or no folder to keep it in */ }
    function noteBeemFed(t) {
        beemFedAt = t;
        /* written when first seen, then no more than once an hour */
        if (!memoFile || (t - beemSavedAt < 3600000 && t >= beemSavedAt)) return;
        beemSavedAt = t;
        try { fs.writeFileSync(memoFile, JSON.stringify({ beemFedAt: t })); } catch (e) { log.warn('readings: cannot save ' + memoFile); }
    }
    /* this head unit has BeeM-Flash: feeding now, its folder there, or fed within the last two weeks
       (a clock that has gone backwards counts as within) */
    function hasBeem(t) {
        if (t - beemFedAt < BEEM_KEPT_MS) return true;
        try { return !!(feed.present && feed.present()); } catch (e) { return false; }
    }

    /* when the cluster came up at this start, for the start-up message;
       a settings change rebuilds the layers but keeps it */
    var onAt = 0;
    var connected = false;
    var running = false;        /* our layers are up */
    var stopped = false;
    var timer = null, settleTimer = null;
    var status = 'Starting';

    /*
     * Every callback that runs outside frame() goes through this. The kit's
     * uncaughtException handler exits the process, and on the car an
     * unexpected exit is how an app loses its data or gets uninstalled.
     */
    function guard(name, fn) {
        return function () {
            try { return fn.apply(null, arguments); } catch (e) {
                log.warn(name + ': ' + (e && e.stack || e));
            }
        };
    }

    function setStatus(s) {
        if (s === status) return;
        status = s;
        log.info('status: ' + s);
    }

    /* "BeeM-Flash readings" off: its file is not looked for at all */
    function applyFeedMode() {
        var mode = feedModeOf(settings);
        try {
            if (mode === 'off') feed.stop(); else feed.start();
        } catch (e) { log.warn('feed: ' + e); }
        if (mode !== feedSaid) {
            feedSaid = mode;
            log.info('readings: ' + (mode === 'on' ? 'BeeM-Flash only' : mode === 'off' ? 'the engine unit only (BeeM-Flash off)'
                : 'BeeM-Flash where this head unit has it, else the engine unit'));
        }
    }

    /* Read the settings and build a theme and driver for them. */
    function configure(prev) {
        try {
            settings = host.settings() || {};
            applyFeedMode();
            /* your own start-up words come from a file (src/car/message.js) */
            if (settings.intro && settings.introMessage === 'custom') {
                var words = deps.message !== undefined ? deps.message
                    : Message.load({ dataDir: host.dataDir, log: log });
                settings = Object.assign({}, settings, { introText: words || null });
            }
            profile = Panel.profileFor(settings.profile || Panel.DEFAULT_PROFILE, settings);
            theme = Theme.build(atlas, profile.id, settings);
            driver = Driver.create({
                cr: cr, theme: theme, shaders: SHADERS,
                atlas: atlas, atlasPixels: atlasPixels, log: log, adopt: prev || null
            });
        } catch (e) {
            log.warn('configure: ' + (e && e.stack || e));
            driver = null;
        }
    }

    /* Settings changed: take the old layers down first - the renderer allows
       only 16 assets per client and refuses the rest silently - then rebuild. */
    function reconfigure() {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(guard('settings', function () {
            settleTimer = null;
            var wasRunning = running, prev = driver;
            running = false;
            configure(prev);
            log.info('settings applied');
            if (wasRunning && connected && driver && theme.settings.enabled) {
                /* the new driver takes the layers over where they stay the same, else builds its own (cluster.js adopt) */
                driver.ready();
                running = true;
            } else if (prev) {
                try { prev.stop(); } catch (e) { log.warn('stop: ' + e); }
            }
        }), SETTLE_MS);
    }

    try {
        host.subscribe(Vehicle.SIGNALS, guard('signal', function (service, field, value) {
            reader.receive(service, field, value, now());
        }));
    } catch (e) { log.warn('subscribe: ' + e); }
    if (host.onSettingsChanged) host.onSettingsChanged(guard('settings', reconfigure));

    cr.on('ready', guard('ready', function () {
        connected = true;
        log.info('cluster-render: connected');
        /* the client replays our layers itself; the atlas bytes are ours */
        if (running && driver) driver.ready();
    }));
    cr.on('disconnected', guard('disconnected', function () {
        connected = false;
        log.warn('cluster-render: lost, reconnecting');
    }));
    cr.on('budget', guard('budget', function (capKb, maxKb, reason) {
        log.info('cluster-render: budget ' + capKb + '/' + maxKb + ' KB/s (' + reason + ')');
    }));
    cr.on('layer', guard('layer', function (ref, st, reason) {
        if (st === 'error') log.warn('cluster-render: layer ' + ref + ' ' + reason);
    }));
    cr.on('refused', guard('refused', function (op, ref, reason) {
        log.warn('cluster-render refused ' + op + ' ' + ref + ': ' + reason);
    }));
    /* an EventEmitter with no 'error' listener throws the error */
    cr.on('error', guard('error', function (e) { log.warn('cluster-render: ' + e); }));

    function frame() {
        if (stopped) return;
        var began = Date.now();
        try {
            var mode = feedModeOf(settings);
            /* BeeM-Flash is feeding right now (never, with its readings turned off) */
            var feeding = mode !== 'off' && feed.live();
            if (feeding) noteBeemFed(now());
            /* anything the feed carries goes in before the frame is built */
            try {
                var op = feed.value('oilPressure');
                if (typeof op === 'number') reader.setOilPressureBar(op, now());
                /* BeeM-Flash's G, when it sends it, is as good as the bus's and fresher */
                var gl = feed.value('gLat'), gn = feed.value('gLong');
                if (typeof gl === 'number' && typeof gn === 'number') reader.setAccel(gl, gn, now());
                /* what the bus does not carry at all: the intake air (the
                   charge air where a car has no separate reading) and the
                   battery, for the M styles' footer */
                var iat = feed.value('iat');
                if (typeof iat !== 'number') iat = feed.value('chargeAirTemp');
                reader.setFeed('iatC', iat, now());
                reader.setFeed('batteryV', feed.value('battery'), now());

                /* the accent follows the interior light, repainted in place
                   so the cluster never has to be rebuilt for a colour */
                if (theme && theme.setAccent && theme.settings.accentFollowsAmbient) {
                    var rgb = ambientAccent(feed.value('ambientRed'),
                                            feed.value('ambientGreen'),
                                            feed.value('ambientBlue'));
                    if (rgb && theme.setAccent(rgb)) {
                        log.info('accent: following the interior light');
                    }
                }
            } catch (e) { log.warn('feed: ' + e); }
            /* and what the engine unit itself has said, where BeeM-Flash is not saying it */
            try {
                var ev = engine.values(now());
                if (!feeding) {
                    if (typeof ev.oilBar === 'number') reader.setOilPressureBar(ev.oilBar, now());
                    reader.setFeed('iatC', ev.iatC, now());
                    reader.setFeed('batteryV', ev.batteryV, now());
                }
                /* (the reader uses it only while the Sport Display sends no boost of its own) */
                reader.setBoostBar(ev.boostBar, now());
            } catch (e) { log.warn('engine: ' + e); }

            var raw = reader.raw(now(), profileTank(profile));
            if (theme) raw = smoother.apply(raw, now(), Smooth.TAU[theme.settings.smoothing] || 0, theme.glide);
            var car = carState(raw);
            var enabled = theme && theme.settings.enabled;
            /* AK Cluster Layouts on the cluster: this one steps aside while it is */
            var yielded = !!enabled && presence.othersShowing(now());

            var want = enabled && !yielded && connected && !!driver &&
                (car === 'on' || (car === 'starting' && running));

            if (car === 'off') onAt = 0;
            if (want && !running) {
                driver.ready();
                running = true;
                if (!onAt) onAt = now();
                log.info('cluster: on');
            } else if (!want && running) {
                driver.stop();
                running = false;
                log.info('cluster: off, handed back to BMW');
            }

            /* only while our layers are up does anything belong in the window */
            var hasCentre = !!(theme && theme.hasCentre);
            centre.want(running && hasCentre ? theme.settings.centre : 'off');

            /*
             * The engine unit is asked only with everything in its favour:
             * not with "BeeM-Flash only"; on automatic, not on a head unit
             * that has BeeM-Flash; never while BeeM-Flash feeds; only with
             * our layers up and the car on; and only with the engine
             * running (or stopped by auto start-stop, in drive readiness)
             * - never parked, never with the ignition on and the engine
             * off (src/car/engine.js). And only for what the style shows.
             */
            var shows = (theme && theme.shows) || {};
            needs = { oil: !!shows.oil, iat: !!shows.iat, volts: !!shows.volts,
                      boost: !!shows.boost && !reader.hasBusBoost(now(), BUS_BOOST_MS) };
            var runs = typeof raw.rpm === 'number' && raw.rpm >= ENGINE_RUNS_RPM;
            if (runs) engineRanAt = now();
            /* running, or stopped at a light with drive readiness still on */
            var engineOk = runs || (raw.condition === DRIVE_READINESS && now() - engineRanAt < AUTO_STOP_MS);
            try {
                engine.tick(now(), {
                    allowed: mode !== 'on' && !feeding && !(mode === 'auto' && hasBeem(now())) &&
                        running && car === 'on' && engineOk,
                    needs: needs,
                    /* "Engine: diesel": a diesel's engine unit is asked only the standard identifiers */
                    diesel: !!(theme && theme.settings.engine === 'diesel')
                });
            } catch (e) { log.warn('engine: ' + e); }

            if (running) {
                presence.mark(now());
                var st = State.present(raw, profile, theme.settings);
                if (hasCentre) st.centre = centre.state();
                st.sinceOn = onAt ? (now() - onAt) / 1000 : -1;
                st.now = now();
                driver.tick(st);
            }

            setStatus(!enabled ? 'Off - BMW original cluster'
                : yielded ? 'Waiting: AK Cluster Layouts is on the cluster'
                : !connected ? 'Waiting for cluster-render'
                : car === 'off' ? 'Waiting for the car to switch on'
                : car === 'starting' ? 'Car switching on'
                : running ? 'On the cluster' : 'Starting');
        } catch (e) {
            log.warn('frame: ' + (e && e.stack || e));
        }
        /* an even cadence: the frame's own work comes off the wait */
        var wait = running ? Math.max(4, frameMs() - (Date.now() - began)) : IDLE_MS;
        timer = setTimeout(frame, wait);
    }

    /* One line for the app's page: who is supplying the readings the bus does not carry. */
    function readingsText() {
        var mode = feedModeOf(settings);
        if (mode !== 'off' && feed.live()) return feed.info();              /* BeeM-Flash: N channels */
        if (mode === 'on' || (mode === 'auto' && hasBeem(now()))) return feed.info() + ' (engine unit not asked)';
        var i = engine.info(needs, now());
        var lead = mode === 'auto' ? 'No BeeM-Flash. Engine unit: ' : 'Engine unit: ';
        if (i.state === 'reading') return lead + i.have.join(', ') + (i.missing.length ? ' (no ' + i.missing.join(', ') + ')' : '');
        if (i.state === 'idle') return lead + 'nothing shown needs it';
        if (i.state === 'nolink') return lead + 'no diagnostic link';
        if (i.state === 'silent') return lead + 'no answer';
        if (i.state === 'asking') return lead + 'asking';
        return lead + 'read while the engine runs';
    }

    configure();
    if (!deps.cr) cr.connect();
    frame();

    return {
        stop: function () {
            stopped = true;
            if (timer) clearTimeout(timer);
            if (settleTimer) clearTimeout(settleTimer);
            try { if (driver) driver.stop(); } catch (e) { /* closing anyway */ }
            running = false;
            try { centre.stop(); } catch (e) { /* closing anyway */ }
            try { feed.stop(); } catch (e) { /* closing anyway */ }
            try { engine.stop(); } catch (e) { /* closing anyway */ }
            if (cr.close) cr.close();
        },
        /* where the extra readings are coming from, for the iDrive screen */
        feed: function () {
            try { return readingsText(); } catch (e) { return null; }
        },
        centre: function () {
            try { return centre.info(); } catch (e) { return null; }
        },
        status: function () { return status; },
        /* for tests */
        reader: reader,
        driver: function () { return driver; },
        theme: function () { return theme; },
        isRunning: function () { return running; }
    };
}

module.exports = { start: start, shaders: shaders, carState: carState,
                   ambientAccent: ambientAccent, FRAME_MS: FRAME_MS,
                   feedModeOf: feedModeOf, FEED_MODES: FEED_MODES,
                   ENGINE_RUNS_RPM: ENGINE_RUNS_RPM, BEEM_KEPT_MS: BEEM_KEPT_MS, AUTO_STOP_MS: AUTO_STOP_MS };
