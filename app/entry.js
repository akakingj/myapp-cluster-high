'use strict';
/*
 * MGU Styles - the iDrive app (the Toro, M Sport, M Sport Plus and M Track
 * Mode styles).
 *
 * An adapter between the MGU App Kit (kit/runtime/mgu.js) and the cluster
 * service (service.js, built from src/car/main.js), and the app's own
 * page. The service runs in the background: the platform starts the app
 * by itself ("autostart"), so the cluster comes back at every start once
 * turned on.
 *
 * The page is the whole screen where the kit runs it (app.json: "hmi":
 * false, "fill": true - the GPU renderer, touch and the controller): its
 * own way out at the top left, and six tabs - CLUSTER (on / off, the
 * design, what shows in its middle) and one page of settings each for
 * GENERAL, TORO, M SPORT, M SPORT PLUS and M TRACK, so a style's own
 * adjustments are never mixed up with another's. Everywhere else (no renderer) the
 * CLUSTER tab is drawn in the HMI's own page, with the HMI's bar buttons
 * and its settings list, which offers only the style in use.
 *
 * This file is staged as main.js by tools/stage-app.js; the kit's builder
 * makes it the package's app.js. Node 8.
 */
const mgu = require('./kit/mgu');
const Sheet = require('./kit/sheet');
const Service = require('./service.js');
const MGeom = require('./mgeom.js');
const TGeom = require('./tgeom.js');
const Theme = require('./theme.js');

/*
 * How often each interface is re-read. Notifications carry most readings,
 * but a car that does not notify a field leaves it on the poll - so the
 * gear, the g sensor and boost need a fast one or the cluster runs behind
 * (a 3 s poll showed the gear two shifts late on the car).
 */
const POLL_MS = {
    'de.bmw.infotainment.vehicle.CDS': 300,              // rpm, temperatures
    'de.bmw.infotainment.vehicle.Vehicle2': 300,         // speed
    'de.bmw.infrastructure.VehicleInformation': 250,     // the engaged gear
    'de.bmw.infotainment.vehicle.CDS2': 400,             // lateral / long. g
    'de.bmw.infotainment.drivingexcitement.FES': 500,    // boost, drive mode
    'de.bmw.infrastructure.VehicleCondition': 1000,
    'de.bmw.infotainment.MDrive': 2000,
    'de.bmw.infotainment.KombiIF': 5000,                 // range, fuel, odo
    'de.bmw.infrastructure.EnvironmentalInformation': 15000
};
const DEFAULT_POLL_MS = 3000;

/* The app's current settings as one plain object. */
function settingsOf(settings, spec) {
    const out = {};
    (spec.settings || []).forEach((s) => { out[s.key] = settings.get(s.key); });
    return out;
}

/* What the service needs from the head unit, from the kit's background context. */
function hostFor(bg) {
    return {
        log: {
            info: (m) => bg.log.info(m),
            warn: (m) => bg.log.warn(m)
        },
        settings: () => settingsOf(bg.settings, bg.spec),
        dataDir: bg.dataDir,
        onSettingsChanged: (fn) => bg.settings.onChange(fn),
        /*
         * The car's diagnostic link, for the readings the bus does not carry
         * where BeeM-Flash is not supplying them (src/car/engine.js). It is
         * the kit's read-only one: anything but a read is refused before it
         * leaves the head unit. Made only when the service first needs it.
         */
        diag() {
            const { ReadOnlyDiag } = require('./kit/readonly-diag');
            const { DidReader } = require('./kit/dids');
            const link = new ReadOnlyDiag(bg.signals, bg.log);
            return { link, reader: new DidReader(link, { ecu: 0x12 }), ready: link.init() };
        },
        subscribe(signals, onValue) {
            Object.keys(signals).forEach((svc) => {
                const handlers = {};
                Object.keys(signals[svc]).forEach((field) => {
                    if (field.charAt(0) === '_') return;
                    handlers[field] = (v) => onValue(svc, field, v);
                });
                /* Notifications carry the readings; the poll only catches
                   any the head unit drops. */
                const pollMs = POLL_MS[svc] || DEFAULT_POLL_MS;
                Promise.resolve()
                    .then(() => bg.signals.watch(svc, '1', handlers, bg.log, { pollMs }))
                    .then((r) => { if (r && r.error) bg.log.warn('signals ' + svc + ': ' + r.error); })
                    .catch((e) => bg.log.warn('signals ' + svc + ': ' + e));
            });
        }
    };
}

/* ------------------------------------------------------------ the screen */

const INK = '#e8f0f6', DIM = '#8d9aa6', FAINT = '#55626e', RED = '#ff263d';
const CARD = '#121b25', FIELD = '#05090f';

function statusColour(status) {
    if (/^On the cluster/.test(status)) return '#3ddc84';
    if (/^Off/.test(status)) return DIM;
    return '#ffb020';
}

/* A small drawing of the dial: the brief's sweep, ticks and stepped contour. */
function dialSketch(cv, cx, cy, r, accent) {
    const a0 = -178 + 17.2, a1 = -178 + 172;            /* degrees, the brief's sweep */
    const pt = (deg, rr) => [cx + rr * Math.cos(deg * Math.PI / 180), cy + rr * Math.sin(deg * Math.PI / 180)];
    for (let i = 0; i <= 80; i++) {
        const a = a0 + (a1 - a0) * i / 80;
        const major = i % 10 === 0;
        const p = pt(a, r), q = pt(a, r - (major ? 12 : 6));
        cv.line(p[0], p[1], q[0], q[1], major ? 2 : 1, i > 68 ? RED : (i < 46 ? INK : FAINT));
    }
    let prev = null;
    for (let i = 0; i <= 160; i++) {
        const t = i / 160, v = t * 8, f = v - Math.floor(v);
        const up = Math.max(0, Math.min(1, (f - 0.12) / 0.10)), dn = Math.max(0, Math.min(1, (f - 0.68) / 0.12));
        const p = pt(a0 + (a1 - a0) * t, r * 0.82 + r * 0.027 * (up - dn));
        if (prev) cv.line(prev[0], prev[1], p[0], p[1], 1.5, t > 0.84 ? RED : DIM);
        prev = p;
    }
    const n = pt(a0 + (a1 - a0) * 0.57, r * 0.84), m = pt(a0 + (a1 - a0) * 0.57, r);
    cv.line(n[0], n[1], m[0], m[1], 2.5, accent);
}

/* A small drawing of an M style: the two dials' rails, its middle (the M
   View's centre lines, or M Sport Plus's plate and stripes) and the
   readouts, from the same geometry the cluster is drawn with. */
function mSketch(cv, x, y, w, plus) {
    const s = w / MGeom.ART.w, D = MGeom.DIAL;
    const P = (px, py) => [x + px * s, y + py * s];
    const path = (pts, width, col) => {
        for (let i = 1; i < pts.length; i++) {
            const a = P(pts[i - 1][0], pts[i - 1][1]), b = P(pts[i][0], pts[i][1]);
            cv.line(a[0], a[1], b[0], b[1], width, col);
        }
    };
    const vertex = MGeom.cross(D.rimUp, D.rimLow), bend = MGeom.cross(D.conUp, D.conLow);
    const rim = [[MGeom.at(D.rimUp, D.rimTop), D.rimTop], vertex, [MGeom.at(D.rimLow, D.rimBottom), D.rimBottom]];
    const con = [[D.topX1, D.topY0], [MGeom.at(D.conUp, D.topY0), D.topY0], bend, [MGeom.at(D.conLow, D.conBottom), D.conBottom]];
    const flip = (pts) => pts.map((p) => [MGeom.mirror(p[0]), p[1]]);
    cv.roundRect(x, y, w, MGeom.ART.h * s, 8, '#05070d');
    path(rim, 5, '#8fc6ea'); path(con, 1.5, '#a8cbf0');
    path(flip(rim), 5, '#dc3840'); path(flip(con), 1.5, '#d65458');
    if (plus) {
        const L = MGeom.PLUS, C = L.PLATES.C.v, T = L.STRIPES;
        /* the rails meet in the middle; the centre plate, its two stripes */
        path([[D.tabLeft, D.railTop + 3], [L.RAILS.blueEnd, D.railTop + 3]], 3, '#62b4ea');
        path([[L.RAILS.redStart, D.railTop + 3], [MGeom.mirror(D.tabLeft), D.railTop + 3]], 3, '#d2343c');
        path(C.concat([C[0]]), 1.5, '#3a5f9c');
        const stripe = (b, col) => {
            const m = (b[0] + b[1]) / 2;
            path([[m - L.slope * (L.top + 12), L.top + 12], [m - L.slope * 330, 330]], (b[1] - b[0]) * s * 0.8, col);
        };
        stripe(T.blue, '#418af7');
        stripe(T.red, '#c73847');
    } else {
        path([[D.tabLeft, D.railTop + 3], [MGeom.DIAG.blueRailEnd, D.railTop + 3]], 3, '#62b4ea');
        path([[MGeom.DIAG.redRailStart, D.railTop + 3], [MGeom.mirror(D.tabLeft), D.railTop + 3]], 3, '#d2343c');
        path([MGeom.DIAG.cyan.p0, MGeom.DIAG.cyan.p1, MGeom.DIAG.cyan.p2], 1.5, '#b0d4f4');
        path([MGeom.DIAG.red.p0, MGeom.DIAG.red.p1], 1.5, '#e4485a');
    }
    cv.text('76', x + 520 * s, y + 296 * s, 50 * s * 1.5, INK, { literal: true });
    cv.text('6', x + 1284 * s, y + 296 * s, 50 * s * 1.5, INK, { literal: true });
}

/* A small drawing of M Track Mode: the wing with its bands and gauge rows,
   the plates and the gear between them, the leaning rev counter and the two
   ladders, from the same geometry the cluster is drawn with. */
function tSketch(cv, x, y, w) {
    const A = TGeom.ART, s = w / A.w;
    const P = (px, py) => [x + px * s, y + py * s];
    const path = (pts, width, col, closed) => {
        const q = closed ? pts.concat([pts[0]]) : pts;
        for (let i = 1; i < q.length; i++) {
            const a = P(q[i - 1][0], q[i - 1][1]), b = P(q[i][0], q[i][1]);
            cv.line(a[0], a[1], b[0], b[1], width, col);
        }
    };
    const lean = (u, y0, y1) => [[TGeom.slash(u, y0), y0], [TGeom.slash(u, y1), y1]];
    /* a leaning slab between two "/" lines, from one height to another */
    const slab = (u0, u1, y0, y1, col) => cv.quad([P(TGeom.slash(u0, y0), y0), P(TGeom.slash(u1, y0), y0),
                                                   P(TGeom.slash(u1, y1), y1), P(TGeom.slash(u0, y1), y1)], col);
    cv.roundRect(x, y, w, A.h * s, 8, '#05070d');
    /* two of the M bands, down the wing */
    const B = TGeom.BANDS, top = TGeom.BODY.top + 6;
    slab(B.light.u[0], B.light.u[1], top, 330, '#2f5fd0');
    slab(B.red.u[0], B.red.u[1], top, 330, '#8a3a72');
    /* the wing, the plates either side of the gear, the ribbon */
    path(TGeom.WING.v, 2, '#3a66c8', true);
    ['upper', 'lower', 'ribbon'].forEach((k) => path(TGeom.PLATES[k].v, 2, '#3a66c8', true));
    /* the four gauge rows */
    for (let i = 0; i < TGeom.ROWS.n; i++) {
        const yy = TGeom.rowTop(i) + 2;
        path([[TGeom.ROWS.xs, yy], [TGeom.ROWS.xe, yy]], 2.5, '#eef3f8');
    }
    /* the rev counter: the top line, the contour, the rail, the marker and the lit foot under it */
    const G = TGeom.TACH, yTop = (G.top.y0 + G.top.y1) / 2, ym = TGeom.revMarks()[3];
    path([[G.top.x0, yTop], [TGeom.slash(G.railR, yTop), yTop]], 1.5, '#e08092');
    path(lean(G.con, yTop, ym - 5), 1.5, '#e2a0aa');
    path(lean((G.railL + G.railR) / 2, yTop, ym - 5), Math.max(2, (G.railR - G.railL) * s), '#e64452');
    slab(G.con, G.railR, ym + 6, G.base.foot, '#e84048');
    path([[TGeom.contourX(ym), ym], [TGeom.railX(ym), ym]], 2, '#ffffff');
    /* oil and fuel */
    const S = TGeom.STRIP;
    [S.oil, S.fuel].forEach((at) => path(lean(at + 8, S.top, S.bottom), 3.5, '#9aa3b8'));
    cv.text('4', x + 764 * s, y + 287 * s, 80 * s * 1.42, INK, { literal: true });
    cv.text('76', x + 742 * s, y + 366 * s, 37 * s * 1.42, INK, { literal: true });
}

/* The Toro backgrounds' own marks behind the dial sketch. */
function toroBackdrop(cv, bgName, x0, y0, w, h, accent) {
    if (bgName === 'modern') {
        /* the side lattice: hexagons down both sides */
        const r = 22;
        for (let side = 0; side < 2; side++) {
            for (let row = 0; row < 7; row++) {
                for (let col = 0; col < 3; col++) {
                    const cx = side ? x0 + w - 40 - col * r * 1.75 : x0 + 40 + col * r * 1.75;
                    const cy = y0 + 40 + row * r * 1.55 + (col % 2) * r * 0.78;
                    if (cy > y0 + h - 20) continue;
                    for (let k = 0; k < 6; k++) {
                        const a0 = Math.PI / 3 * k + Math.PI / 6, a1 = a0 + Math.PI / 3;
                        cv.line(cx + r * 0.9 * Math.cos(a0), cy + r * 0.9 * Math.sin(a0),
                                cx + r * 0.9 * Math.cos(a1), cy + r * 0.9 * Math.sin(a1), 1, '#3a4654');
                    }
                    cv.circle(cx + r * 0.9 * Math.cos(Math.PI / 6), cy + r * 0.9 * Math.sin(Math.PI / 6), 2.5, accent);
                }
            }
        }
    } else if (bgName === 'revuelto') {
        /* the Revuelto's Y lights, sweeping in from both sides */
        for (let side = 0; side < 2; side++) {
            const sx = side ? -1 : 1, bx = side ? x0 + w - 30 : x0 + 30, my = y0 + h * 0.5;
            cv.line(bx, my, bx + sx * 120, my - 90, 3, accent);
            cv.line(bx, my, bx + sx * 120, my + 90, 3, accent);
            cv.line(bx + sx * 120, my - 90, bx + sx * 220, my - 100, 2, accent);
            cv.line(bx + sx * 120, my + 90, bx + sx * 220, my + 100, 2, accent);
        }
    } else {
        /* genuine: the Huracan's fine stipple */
        for (let i = 0; i < 140; i++) {
            const px = x0 + 20 + ((i * 97) % (w - 40)), py = y0 + 20 + ((i * 53) % (h - 40));
            cv.circle(px, py, 1, '#1d2731');
        }
    }
}

/*
 * The designs the arrows step through, in order. Each is a style and, for
 * Toro, its background; the colours and everything else stay as set.
 */
const DESIGNS = [
    { name: 'Toro', sub: 'Lamborghini Huracan, genuine', style: 'toro', background: 'genuine' },
    { name: 'Toro', sub: 'Lamborghini, modern hex lattice', style: 'toro', background: 'modern' },
    { name: 'Toro', sub: 'Lamborghini Revuelto', style: 'toro', background: 'revuelto' },
    { name: 'M Sport', sub: 'BMW M View, iDrive 8', style: 'track' },
    { name: 'M Sport Plus', sub: 'M stripes, a wide picture in the centre', style: 'mplus' },
    { name: 'M Track Mode', sub: 'BMW M\'s track view: four gauges, the gear, a leaning rev counter', style: 'mtrack' }
];
function designIndex(style, background) {
    const i = DESIGNS.findIndex((d) => d.style === style && (d.style !== 'toro' || d.background === background));
    return i < 0 ? 0 : i;
}

/* The page's tabs: the cluster itself, then a page of settings each. */
const TABS = [
    { id: 'cluster', label: 'CLUSTER' },
    { id: 'general', label: 'GENERAL' },
    { id: 'toro', label: 'TORO', style: 'toro' },
    { id: 'msport', label: 'M SPORT', style: 'track' },
    { id: 'mplus', label: 'M SPORT PLUS', style: 'mplus' },
    { id: 'mtrack', label: 'M TRACK', style: 'mtrack' }
];
const STYLE_NAME = { toro: 'Toro', track: 'M Sport', mplus: 'M Sport Plus', mtrack: 'M Track Mode' };
/* what a style's middle can show, as the short words the buttons carry */
const CENTRE_WORDS = { off: 'Closed', waze: 'Waze', map: 'BMW map', camera: 'Camera', turn: 'Turn card' };
/* M Track Mode's is its left wing, which holds its gauges until a picture is chosen */
const WING_WORDS = Object.assign({}, CENTRE_WORDS, { off: 'Gauges' });

const W = 1600;
const ROW_H = 60, ROW_GAP = 8;

function arrow(cv, cx, cy, r, dir, col) {
    cv.circle(cx, cy, r, '#1a2633');
    const t = r * 0.42;
    cv.line(cx - dir * t * 0.5, cy - t, cx + dir * t * 0.7, cy, 4, col);
    cv.line(cx + dir * t * 0.7, cy, cx - dir * t * 0.5, cy + t, 4, col);
}

/*
 * An install from before "BeeM-Flash readings" existed took its extra
 * readings from BeeM-Flash and asked the car nothing. It still does: its
 * saved settings have no such choice, so it is given "On: BeeM-Flash only"
 * rather than the choice a new install comes with (automatic, which asks
 * the engine unit on a head unit without BeeM-Flash). Nothing of the car's
 * is asked after an update unless its owner says so. A new install has no
 * saved settings yet, or - once anything was changed - all of them.
 */
function keepEarlierReadings(bg) {
    try {
        const saved = JSON.parse(require('fs').readFileSync(require('path').join(bg.dataDir, 'settings.json'), 'utf8'));
        if (saved && typeof saved === 'object' && Object.keys(saved).length && !('beemFlash' in saved)) {
            bg.settings.set('beemFlash', 'on');
            bg.log.info('readings: this install is from before the choice existed - kept to BeeM-Flash only (GENERAL > BeeM-Flash readings changes it)');
        }
    } catch (e) { /* no saved settings: a new install, as it comes */ }
}

mgu.run({
    background(bg) {
        keepEarlierReadings(bg);
        /*
         * "Start at every startup" off: each start of the head unit begins
         * with BMW's own cluster, and Show on cluster brings ours up for
         * that drive only.
         */
        try {
            if (bg.settings.get('autoStart') === false && bg.settings.get('enabled') === true) {
                bg.settings.set('enabled', false);
                bg.log.info('start at every startup is off: BMW original until turned on');
            }
        } catch (e) { bg.log.warn('autoStart: ' + e); }
        try {
            const svc = Service.start(hostFor(bg), { appId: bg.spec.id });
            bg.log.info('cluster service started');
            return svc;
        } catch (e) {
            bg.log.error('cluster service did not start: ' + (e && e.stack || e));
            return null;
        }
    },

    start(ctx) {
        const { ui, settings, background } = ctx;
        const loop = ctx.loop('MAIN', 4, render);
        const items = ctx.spec.settings || [];
        let last = '';
        let tab = 'cluster';              /* the page showing */
        const scroll = {};                /* tab -> how far its list is scrolled, px */
        let focusKey = null;              /* the place the controller is on (the kit says) */
        let listBox = null;               /* the settings list as last drawn: { y, h, rows: [{ key, y }] } */
        let wasOwn = false;

        function choice(key) {
            const item = settings.item(key);
            const v = settings.get(key);
            const opt = item && item.options && item.options.find((o) => o[0] === String(v));
            return (opt ? opt[1] : String(v)) + (held(key) ? '  ·  Car profile' : '');
        }
        /* set by the Car profile app (the kit's Settings.held): shown with its value, changed there */
        const held = (key) => !!(settings.held && settings.held(key));
        const style = () => (STYLE_NAME[settings.get('style')] ? settings.get('style') : 'toro');
        /* BETA: how many px lower a style is drawn (0: as it comes) - what was asked, as far as the style goes */
        const lowered = (st) => Math.max(0, Math.min(Math.round(Number(settings.get('lower')) || 0), Theme.lowerMost(st || style())));
        /* the setting a style keeps what shows in its middle under, and what it may be */
        const centreKey = (st) => Theme.keyFor(st || style(), 'centre');
        const centreOptions = (st) => ((settings.item(centreKey(st)) || {}).options || []).map((o) => o[0]);
        const centreOf = (st) => {
            const v = settings.get(centreKey(st));
            return centreOptions(st).indexOf(v) >= 0 ? v : 'off';
        };
        /* a setting is offered on its tab whatever style is in use: its other conditions still hold */
        function offered(s) {
            if (!s || s.hidden) return false;
            const w = s.when || {};
            return Object.keys(w).every((k) => k === 'style' || [].concat(w[k]).indexOf(settings.get(k)) >= 0);
        }
        const rowsOf = (id) => items.filter((s) => s.tab === id && offered(s));

        function refresh() { last = ''; loop.kick(); }
        function show(id) {
            if (!TABS.some((t) => t.id === id)) return;
            tab = id;
            refresh();
        }
        function step(dir) {
            const i = designIndex(settings.get('style'), settings.get('background'));
            const d = DESIGNS[(i + dir + DESIGNS.length) % DESIGNS.length];
            settings.set('style', d.style);
            if (d.background) settings.set('background', d.background);
            refresh();
        }
        function toggleShown() { settings.set('enabled', settings.get('enabled') !== true); refresh(); }
        function nextCentre() {
            const opts = centreOptions(), i = opts.indexOf(centreOf());
            if (opts.length) settings.set(centreKey(), opts[(i + 1) % opts.length]);
            refresh();
        }
        function exit() { Promise.resolve(ui.close('MAIN')).catch(() => {}); }

        /* one setting's values, to pick from: the kit's own list (a sheet over the page) */
        function pick(s) {
            const sh = Sheet.listSheet(settings, s.label);
            const choose = sh.choose.bind(sh);
            sh.open = s;
            sh.sub = Math.max(0, (s.options || []).findIndex((o) => o[0] === String(settings.get(s.key))));
            sh.choose = () => { choose(); return 'close'; };
            sh.back = () => 'close';
            sh.onClose = refresh;
            return sh;
        }
        function press(s) {
            if (!s || held(s.key)) return;
            if (s.type === 'bool') settings.set(s.key, !settings.get(s.key));
            else if (!(ctx.sheet && ctx.sheet(pick(s)))) {
                /* no sheet here: step to the next value */
                const opts = (s.options || []).map((o) => o[0]), i = opts.indexOf(String(settings.get(s.key)));
                if (opts.length) settings.set(s.key, opts[(i + 1) % opts.length]);
            }
            refresh();
        }

        function render() {
            const status = background ? background.status()
                : 'The cluster service did not start - see Logs';
            const on = settings.get('enabled') === true;
            const st = style();
            const track = st === 'track' || st === 'mplus';      /* either M View style */
            const wing = st === 'mtrack';                        /* M Track Mode: its picture is in its left wing */
            const words = wing ? WING_WORDS : CENTRE_WORDS;
            const centre = background && background.centre ? background.centre() : null;
            const feed = background && background.feed ? background.feed() : null;

            const cv = ctx.canvas(W, 520);
            /* the kit runs the screen: the page is the whole display, with its own tabs and way out */
            const own = !!cv.own;
            const H = 520 + (own ? cv.extra || 0 : 0);
            if (own !== wasOwn) {
                wasOwn = own;
                /* their jobs are on the page there; elsewhere the HMI's bar has them */
                ['BTN_SHOW', 'BTN_DESIGN', 'BTN_CENTRE'].forEach((b) => { if (ctx.hideButton) ctx.hideButton(b, own); });
            }
            const page = own ? tab : 'cluster';
            const sig = JSON.stringify([status, on, centre, feed, settingsOf(settings, ctx.spec), own, H, page,
                scroll[page] || 0, focusKey]);
            if (sig === last) return;
            last = sig;

            const label = (s, x, y, size, c, o) => cv.text(s, x, y, size, c || INK, Object.assign({ literal: true }, o || {}));
            const fitLabel = (s, x, y, size, maxW, c, o) => {
                const w = cv.textWidth(String(s), size, { literal: true });
                label(String(s), x, y, w > maxW ? size * maxW / w : size, c, o);
            };
            cv.fillRect(0, 0, W, H, '#070b11');
            listBox = null;

            /*
             * Places a finger or the controller can press, gathered and handed to the kit at the end:
             * the bar's first, so the controller's knob runs way out, tabs, page - though the bar is
             * drawn last, over a list that has scrolled up under it (nothing here relies on clipping:
             * the head unit's software renderer has none).
             */
            const barPlaces = [], pagePlaces = [];
            const place = (list) => (x, y, w, h, run, key, r) => list.push([x, y, w, h, run, key, r]);
            const top = own ? 84 : 44;
            function drawBar() {
                if (!own) return;
                const tgt = place(barPlaces);
                cv.fillRect(0, 0, W, 72, '#070b11');
                cv.fillRect(0, 0, W, 70, '#0b1119');
                cv.fillRect(0, 70, W, 2, '#18222e');
                /* the way out (the HMI's back arrow is under the page) */
                cv.roundRect(14, 10, 92, 50, 25, CARD);
                cv.line(66, 23, 52, 35, 4, INK); cv.line(52, 35, 66, 47, 4, INK);
                tgt(14, 10, 92, 50, exit, 'exit', 25);
                /* the app's own name, as its manifest has it (a public release may carry another) */
                fitLabel(String(ctx.spec.title || 'MGU Styles').toUpperCase(), 124, 45, 26, 214, INK, { font: 'bold', spacing: 1.5 });
                let x = 352;
                TABS.forEach((t) => {
                    const tw = cv.textWidth(t.label, 21, { literal: true, font: 'bold', spacing: 1 }) + 44;
                    const sel = t.id === tab;
                    cv.roundRect(x, 12, tw, 46, 23, sel ? RED : CARD);
                    label(t.label, x + 22, 43, 21, sel ? '#ffffff' : (t.style && t.style === st ? INK : DIM), { font: 'bold', spacing: 1 });
                    /* the style in use carries a mark */
                    if (t.style && t.style === st) cv.circle(x + tw - 12, 22, 4, sel ? '#ffffff' : '#3ddc84');
                    tgt(x, 12, tw, 46, () => show(t.id), 'tab:' + t.id, 23);
                    x += tw + 10;
                });
                cv.circle(x + 26, 35, 8, statusColour(status));
                fitLabel(status, x + 44, 43, 20, W - 20 - (x + 44), DIM);
            }
            function done() {
                drawBar();
                barPlaces.concat(pagePlaces).forEach((q) => cv.target(q[0], q[1], q[2], q[3], q[4], q[5], q[6]));
                return ui.image('MAIN_GFX', cv);
            }
            const tgt = place(pagePlaces);
            const bottom = H - (own ? 14 : 6);
            const ch = bottom - top;

            if (page !== 'cluster') { drawSettings(cv, label, fitLabel, tgt, page, top, ch, st); return done(); }

            const auto = settings.get('autoStart') !== false;
            const di = designIndex(settings.get('style'), settings.get('background'));
            const D = DESIGNS[di];

            /* ---- left: what it is, and what it is doing ---- */
            cv.roundRect(16, top, 640, ch, 16, CARD);
            label(D.name.toUpperCase(), 44, top + 60, 48, INK);
            fitLabel(D.sub, 44, top + 94, 20, 580, DIM);
            let y = top + 114;
            if (own) {
                /* on / off: the one button that matters most */
                cv.roundRect(44, y, 584, 62, 31, on ? '#12301f' : FIELD);
                cv.strokeRoundRect(44, y, 584, 62, 31, 2, on ? '#3ddc84' : '#2a3846');
                cv.circle(80, y + 31, 9, statusColour(status));
                fitLabel(on ? 'ON THE CLUSTER  -  press to give BMW\'s back' : 'OFF  -  press to show it on the cluster',
                    104, y + 39, 22, 500, INK);
                tgt(44, y, 584, 62, toggleShown, 'show', 31);
            } else {
                cv.roundRect(44, y, 584, 62, 10, FIELD);
                cv.circle(74, y + 31, 9, statusColour(status));
                fitLabel(status, 96, y + 40, 24, 510, INK);
            }
            y += 100;
            const cw = centreOf();
            const rows = [
                [wing ? 'Left wing' : 'Centre', (words[cw] || cw) + (centre && centre.mode && cw !== 'off'
                    ? (centre.mode === 'map' || centre.mode === 'camera' ? ': open' : centre.mode === 'turn' ? ': turn card' : ': waiting') : '')],
                ['Phone map', centre ? centre.waze : '-'],
                ['Turn View', centre ? centre.turnView : '-'],
                track || wing ? ['Footer', [choice(Theme.keyFor(st, 'footL')), choice(Theme.keyFor(st, 'footM')), choice(Theme.keyFor(st, 'footR'))]
                            .map((t) => t.replace(/ \(.*$/, '')).join('  |  ')]
                      : ['Colour', choice('accent')],
                ['BMW strip', lowered(st) ? 'Hidden: the cluster ' + lowered(st) + ' px lower (BETA)' : choice('bottomExtra')],
                ['Readings', feed || '-']
            ];
            const rowStep = Math.min(40, (bottom - 64 - y) / (rows.length - 1));
            rows.forEach((r, i) => {
                label(r[0], 44, y + i * rowStep, 18, FAINT);
                fitLabel(r[1], 190, y + i * rowStep, 20, 440, INK);
            });
            label(!on ? 'Off: BMW\'s own cluster.'
                : auto ? 'On at every start.' : 'On for this drive; BMW\'s own at the next start.',
                  44, bottom - 22, 17, DIM);
            label("Warnings and BMW's gear letter always stay BMW's.", 260, bottom - 22, 17, FAINT);

            /* ---- right: the design, with arrows to step through them ---- */
            const rx = 672, rw = 912;
            cv.roundRect(rx, top, rw, ch, 16, CARD);
            const pills = own ? 96 : 0;                        /* the centre's buttons, under the sketch */
            const fy = top + 20, fh = ch - 96 - pills;
            cv.roundRect(rx + 102, fy, 708, fh, 12, FIELD);
            const accent = { arancio: '#ff6a1a', giallo: '#ffd117', rosso: '#ff2e1c', verde: '#2ee07a',
                             blu: '#3394ff', viola: '#b073ff', bianco: '#ebf2fb', magenta: '#ff2bd6' }[settings.get('accent')] || '#ff6a1a';
            const mid = rx + rw / 2;
            if (wing) {
                const tw = Math.min(684, (fh - 16) * TGeom.ART.w / TGeom.ART.h);
                tSketch(cv, mid - tw / 2, fy + (fh - tw * TGeom.ART.h / TGeom.ART.w) / 2, tw);
            } else if (track) {
                const mw = Math.min(684, (fh - 16) * MGeom.ART.w / MGeom.ART.h);
                mSketch(cv, mid - mw / 2, fy + (fh - mw * MGeom.ART.h / MGeom.ART.w) / 2, mw, st === 'mplus');
            } else {
                /* the dial's arc stands on a centre just above the field's foot, all of it inside */
                const r = Math.min(300, fh - 60);
                toroBackdrop(cv, D.background, rx + 102, fy, 708, fh, accent);
                dialSketch(cv, mid, fy + fh - 22, r, accent);
                label('4', mid - 24 * r / 300, fy + fh - 78 * r / 300, 96 * r / 300, RED);
            }
            const ay = fy + fh / 2;
            arrow(cv, rx + 52, ay, 30, -1, INK);
            arrow(cv, rx + rw - 52, ay, 30, 1, INK);
            if (own) {
                tgt(rx + 14, ay - 38, 76, 76, () => step(-1), 'prev', 38);
                tgt(rx + rw - 90, ay - 38, 76, 76, () => step(1), 'next', 38);
            }
            /* which design, and where it is in the list */
            const name = D.name + '  ' + (di + 1) + ' / ' + DESIGNS.length;
            label(name, mid, fy + fh + 58, 22, INK, { align: 'center' });
            DESIGNS.forEach((d, i) => cv.circle(mid - (DESIGNS.length - 1) * 11 + i * 22, fy + fh + 26, 4.5,
                i === di ? accent : '#2a3846'));

            /* what shows in this style's middle: one press each */
            if (own) {
                const opts = centreOptions();
                const py = bottom - 66, gap = 10, pw = (rw - 44 - 150 - gap * (opts.length - 1)) / Math.max(1, opts.length);
                label(wing ? 'WING' : 'CENTRE', rx + 22, py + 33, 18, FAINT, { font: 'bold', spacing: 1 });
                opts.forEach((v, i) => {
                    const px = rx + 22 + 128 + i * (pw + gap), sel = v === cw;
                    cv.roundRect(px, py, pw, 50, 25, sel ? RED : FIELD);
                    if (!sel) cv.strokeRoundRect(px, py, pw, 50, 25, 1.5, '#2a3846');
                    fitLabel(words[v] || v, px + pw / 2, py + 33, 21, pw - 28, sel ? '#ffffff' : INK, { align: 'center', font: 'bold' });
                    tgt(px, py, pw, 50, () => { settings.set(centreKey(), v); refresh(); }, 'centre:' + v, 25);
                });
            }
            return done();
        }

        /* A page of settings: the rows of one tab, each a place to press. */
        function drawSettings(cv, label, fitLabel, tgt, id, top, ch, st) {
            const t = TABS.find((q) => q.id === id);
            const rows = rowsOf(id);
            const inUse = !t.style || t.style === st;
            const y0 = top + 62, vh = ch - 62 + 14;             /* the list runs to the screen's foot */
            const total = rows.length * (ROW_H + ROW_GAP) - ROW_GAP + 14;
            const max = Math.max(0, total - vh);
            scroll[id] = Math.max(0, Math.min(max, scroll[id] || 0));
            const sy = scroll[id];
            listBox = { id, y: y0, h: vh, max, rows: [] };
            rows.forEach((s, i) => {
                const y = y0 + i * (ROW_H + ROW_GAP) - sy;
                listBox.rows.push({ key: s.key, y, s });
                if (y + ROW_H < y0 || y > y0 + vh) return;
                const x = 16, w = W - 32 - (max ? 16 : 0);
                cv.roundRect(x, y, w, ROW_H, 14, CARD);
                const cy = y + ROW_H / 2;
                let right = x + w - 26;
                if (s.type === 'bool') {
                    const onV = !!settings.get(s.key);
                    cv.roundRect(right - 76, cy - 19, 76, 38, 19, onV ? RED : '#2a3846');
                    cv.circle(onV ? right - 19 : right - 57, cy, 14, '#ffffff');
                    right -= 100;
                } else {
                    /* (no arrow where the Car profile sets it: nothing to pick here) */
                    if (!held(s.key)) { cv.line(right - 9, cy - 9, right, cy, 3, DIM); cv.line(right, cy, right - 9, cy + 9, 3, DIM); right -= 30; }
                    const v = choice(s.key);
                    const vw = Math.min(700, cv.textWidth(v, 22, { literal: true }));
                    fitLabel(v, right - vw, cy + 8, 22, 700, DIM);
                    right -= vw + 24;
                }
                fitLabel(s.label, x + 26, cy + 9, 24, right - (x + 26), INK);
            });
            if (max) {
                const bh = Math.max(40, vh * vh / total), by = y0 + (vh - bh) * (sy / max);
                cv.roundRect(W - 22, by, 6, bh, 3, '#3a4654');
            }
            /* over the rows that have scrolled up: the page's own line - whose settings these are, and
               the way to that style (the bar is drawn over the rest, last) */
            cv.fillRect(0, 0, W, y0 - 4, '#070b11');
            fitLabel(t.style ? STYLE_NAME[t.style] + (inUse ? ': the style on the cluster now.' : ': its own settings, kept for when it is chosen.')
                             : 'For every style: the car, units, the limiter, BMW\'s strip, extras.',
                     30, top + 32, 21, t.style && !inUse ? 1180 : 1500, inUse ? INK : DIM);
            if (t.style && !inUse) {
                cv.roundRect(W - 330, top + 2, 304, 46, 23, FIELD);
                cv.strokeRoundRect(W - 330, top + 2, 304, 46, 23, 1.5, '#3ddc84');
                label('USE THIS STYLE', W - 178, top + 33, 20, INK, { align: 'center', font: 'bold', spacing: 1 });
                tgt(W - 330, top + 2, 304, 46, () => { settings.set('style', t.style); refresh(); }, 'use:' + t.style, 23);
            }
            /* every row is a place for the controller, in view or not (one out of view is brought in when
               the controller reaches it: onPageFocus). Those out of view stand well clear of the page, in
               their order, so a finger cannot find them and a push up or down still lands on the next. */
            rows.forEach((s, i) => {
                const y = y0 + i * (ROW_H + ROW_GAP) - sy;
                const inView = y >= y0 - 1 && y + ROW_H <= y0 + vh + 1;
                const ty = inView ? y : (y < y0 ? y - 4000 : y + 4000);
                tgt(16, ty, W - 32 - (max ? 16 : 0), ROW_H, () => press(s), 'set:' + s.key, 14);
            });
        }

        /* the controller reached a row out of view: bring it in */
        function reveal(key) {
            if (!listBox || !key || key.indexOf('set:') !== 0) return;
            const row = listBox.rows.find((r) => 'set:' + r.key === key);
            if (!row) return;
            let sy = scroll[listBox.id] || 0;
            if (row.y < listBox.y) sy -= listBox.y - row.y;
            else if (row.y + ROW_H > listBox.y + listBox.h) sy += row.y + ROW_H - (listBox.y + listBox.h);
            scroll[listBox.id] = Math.max(0, Math.min(listBox.max, sy));
        }

        settings.onChange(refresh);
        ctx.onLayout(refresh);
        ui.onVisible((name) => { if (name === 'MAIN') refresh(); });

        /* the HMI's bar, where the kit does not run the screen */
        ui.onClick('BTN_SHOW', toggleShown);
        ui.onClick('BTN_DESIGN', () => step(1));
        ui.onClick('BTN_CENTRE', nextCentre);

        /* where the kit runs the screen: the controller and the finger */
        if (ctx.onPageFocus) ctx.onPageFocus((key) => { focusKey = key || null; reveal(focusKey); refresh(); });
        /* pushed left with nothing further left: a settings page goes back to CLUSTER, CLUSTER leaves the app */
        if (ctx.onBack) ctx.onBack((edge) => { if (edge && tab !== 'cluster') { show('cluster'); if (ctx.focus) ctx.focus('tab:cluster'); return true; } return false; });
        /* a finger on a settings list: a drag scrolls it, a tap presses the row under it */
        if (ctx.onTouch) {
            let drag = null;
            ctx.onTouch((phase, x, y) => {
                if (phase === 1) {
                    drag = null;
                    if (tab === 'cluster' || !listBox || y < listBox.y || y > listBox.y + listBox.h) return false;
                    drag = { x, y0: y, last: y, moved: false };
                    return true;
                }
                if (!drag) return false;
                if (phase === 2) {
                    if (Math.abs(y - drag.y0) > 12) drag.moved = true;
                    if (drag.moved && listBox) {
                        scroll[listBox.id] = Math.max(0, Math.min(listBox.max, (scroll[listBox.id] || 0) + drag.last - y));
                        refresh();
                    }
                    drag.last = y;
                } else if (phase === 3) {
                    const d = drag;
                    drag = null;
                    if (!d.moved && listBox) {
                        const row = listBox.rows.find((r) => d.y0 >= r.y && d.y0 < r.y + ROW_H);
                        if (row) press(row.s);
                    }
                }
                return true;
            });
        }
        refresh();
    }
});
