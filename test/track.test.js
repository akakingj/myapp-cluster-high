'use strict';
/*
 * The M style (BMW M View, rebuilt from docs/ref/m-view-reference.jpg)
 * against the car's limits and its own geometry: the bottom strip, the
 * factory telltales, the shader budget, the window the hosted map shows
 * through, and that a tick, its numeral and the marker agree.
 *
 * How closely it matches the photograph is measured by tools/m-compare.py
 * (it needs Python; these tests do not).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/geometry/panel.js');
const Themes = require('../src/theme/index.js');
const Track = require('../src/theme/track.js');
const State = require('../src/engine/state.js');
const Sim = require('../preview/sim.js');
const Text = require('../src/engine/text.js');
const atlas = require('../assets/fonts/atlas.json');
const mShaders = require('../src/shaders/mcluster.js');
const allShaders = Object.assign({}, require('../src/shaders/core.js'), require('../src/shaders/parts.js'),
    require('../src/shaders/dial.js'), mShaders);
const M = require('../src/theme/mgeom.js');
const Vehicle = require('../src/car/vehicle.js');

const PROFILE = Panel.profile('x3m40i');
const build = (cfg) => Themes.build(atlas, (cfg && cfg.profile) || 'x3m40i', Object.assign({ style: 'track' }, cfg));
const layer = (t, id) => t.layers.find((L) => L.id === id);
/* a presented state, with anything in `over` laid on top */
/* (a speed given here is the one shown: its held digits, speedText, come from the raw reading) */
const state = (t, raw, over) => {
    const s = Object.assign(State.present(raw || {}, t.profile, t.settings), over);
    if (over && 'speed' in over && !('speedText' in over)) delete s.speedText;
    return s;
};

const TURNS = [
    { kind: 'intersection', angle: 90, side: -1, exit: 0, text: '0.3 mi' },
    { kind: 'intersection', angle: 135, side: 1, exit: 0, text: '1500 ft' },
    { kind: 'intersection', angle: 180, side: -1, exit: 0, text: '0.1 mi' },
    { kind: 'roundabout', angle: 90, side: 1, exit: 3, text: '12.5 km' },
    { kind: 'branch', angle: 30, side: 1, exit: 0, text: '800 m' },
    { kind: 'destination', angle: 0, side: 1, exit: 0, text: '200 yd' },
    { kind: 'tunnel', angle: 0, side: 1, exit: 0, text: '1 mi' }
];
const CENTRES = [{ mode: 'neutral', open: 0, maneuver: null }, { mode: 'map', open: 1, maneuver: null },
    { mode: 'camera', open: 0.5, maneuver: null }].concat(TURNS.map((m) => ({ mode: 'turn', open: 0, maneuver: m })));

/* ---- reading a text layer back: which characters, and where ---- */
const GLYPH_AT = new Map();
for (const [face, f] of Object.entries(atlas.faces)) {
    for (const [ch, g] of Object.entries(f.glyphs)) if (g.tw) GLYPH_AT.set(g.u + ',' + g.v, { face, ch });
}
const isNum = (L) => L.shader === 'mnum' || L.shader === 'mnum6';     /* a scale's numerals (mnum6: a diesel's rev scale) */
const isText = (L) => L.shader === 'text' || isNum(L);
const countOf = (L, u) => (isNum(L) ? u.u_cfg[0] : u.u_count);
/* the glyph boxes of a text layer, in panel pixels */
function quads(L, u) {
    const out = [];
    for (let g = 0; g < countOf(L, u); g++) {
        const [x, y, w, h] = u.u_quad.slice(g * 4, g * 4 + 4);
        out.push({ x: L.x + x, y: L.y + y, w, h });
    }
    return out;
}
function read(L, u) {
    if (!u) return null;
    let s = '';
    for (let g = 0; g < countOf(L, u); g++) {
        const hit = GLYPH_AT.get(Math.round(u.u_g[g * 4] * atlas.size) + ',' + Math.round(u.u_g[g * 4 + 1] * atlas.size));
        s += hit ? hit.ch : '?';
    }
    return s;
}
const says = (t, id, st) => read(layer(t, id), layer(t, id).uniforms(st, 0));
const hits = (r, z) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y;
/* both M styles: the M View, and the same dials round the other middle */
const M_STYLES = ['track', 'mplus'];
/*
 * A scale layer's glyph boxes with the marker level with each numeral in
 * turn - every numeral at its largest - by the shader's own sums: the tick
 * from the glyph's height, the size about the numeral's anchor.
 */
function grownQuads(L, u) {
    const out = [], s = 1 + u.u_grow;
    for (let g = 0; g < u.u_cfg[0]; g++) {
        const [x, y, w, h] = u.u_quad.slice(g * 4, g * 4 + 4);
        const k = Math.floor((M.SCALE.y0 - (u.u_art[1] + (y + h / 2) / u.u_art[2])) / M.SCALE.dy + 0.5);
        const ax = u.u_ax[g * 4], ay = u.u_ax[g * 4 + 1];
        out.push({ x: L.x + ax + (x - ax) * s, y: L.y + ay + (y - ay) * s, w: w * s, h: h * s, k });
    }
    return out;
}
/* everything a text layer can put ink on in a state: its glyphs, and for a scale its numerals grown */
const inkOf = (L, u) => (isNum(L) ? quads(L, u).concat(grownQuads(L, u)) : quads(L, u));

/* ------------------------------------------------------------ the registry */

test('the registry picks the style, Toro by default', () => {
    assert.strictEqual(Themes.build(atlas, 'x3m40i', {}).id, 'toro');
    assert.strictEqual(Themes.build(atlas, 'x3m40i', { style: 'nonsense' }).id, 'toro');
    assert.strictEqual(build().id, 'track');
    assert.strictEqual(build().name, 'M Sport', 'the M View keeps the id saved settings already hold');
    assert.ok(build().hasCentre);
    const plus = build({ style: 'mplus' });
    assert.deepStrictEqual([plus.id, plus.name, plus.hasCentre], ['mplus', 'M Sport Plus', true]);
    assert.deepStrictEqual(Object.keys(Themes.THEMES), ['toro', 'track', 'mplus', 'mtrack']);
});

/* ---------------------------------------------------- the artboard's fit */

test('the reference frame is fitted uniformly, its axis on the panel\'s centre, all of it above the strip', () => {
    const A = M.ART;
    assert.deepStrictEqual([A.w, A.h], [1726, 612], 'the reference frame\'s own size');
    /* one scale both ways: px and py differ only by their origin */
    assert.strictEqual(M.px(100) - M.px(0), M.py(100) - M.py(0));
    assert.ok(Math.abs(M.px(M.AX) - Panel.PANEL_WIDTH / 2) < 0.05, 'the dials mirror about x = 960');
    assert.ok(M.px(0) >= 0 && M.px(A.w) <= Panel.PANEL_WIDTH);
    assert.ok(M.py(0) >= 0 && M.py(A.h) <= Panel.BOTTOM_CUT, 'the whole frame is above the car\'s strip');
    /* layers sit on whole pixels and cover what they were asked to */
    const b = M.box(10.2, 20.7, 30.1, 40.9);
    assert.ok(Number.isInteger(b.x) && Number.isInteger(b.y) && Number.isInteger(b.w) && Number.isInteger(b.h));
    assert.ok(b.x <= M.px(10.2) && b.x + b.w >= M.px(30.1) && b.y <= M.py(20.7) && b.y + b.h >= M.py(40.9));
});

test('one fit carries the whole design to a target: the comparison\'s 1:1 artboard, or any other size', () => {
    const panel = build({ mFixture: true });
    const boxes = (t) => t.layers.map((L) => [L.id, L.x, L.y, L.w, L.h]);
    const before = boxes(panel);
    try {
        /* the artboard itself: what tools/m-compare.py measures against the photograph */
        M.setFit({ s: 1, ox: 0, oy: 0 });
        assert.deepStrictEqual([M.px(0), M.py(0), M.px(1726), M.py(612)], [0, 0, 1726, 612]);
        const native = build({ mFixture: true });
        const st = state(native, { speedKmh: 0 });
        for (const L of native.layers.filter((x) => x.shader !== 'flash' && !x.belowCut)) {
            assert.ok(L.x >= 0 && L.y >= 0 && L.x + L.w <= 1726 && L.y + L.h <= 612, L.id + ' is on the artboard');
        }
        /* a shader is told its place in artboard units, one pixel to the unit */
        const dial = layer(native, 'speedDial');
        assert.deepStrictEqual(dial.uniforms(st).u_art, [dial.x, dial.y, 1]);
        /* the speed's "0" is 51.6 units tall there, as in the photograph */
        const zero = quads(layer(native, 'speed'), layer(native, 'speed').uniforms(st, 0))[0];
        const ink = atlas.faces.mw.glyphs['0'];
        assert.ok(Math.abs(0.70 * zero.h / ink.h - 51.6) < 0.01, 'the figure\'s height follows the fit');

        /* twice the size: every layer twice as far out and twice as big (to the pixel grid) */
        M.setFit({ s: 2, ox: 10, oy: 20 });
        const big = build({ mFixture: true });
        for (const [i, L] of big.layers.entries()) {
            const N = native.layers[i];
            if (N.id === 'back' || N.id === 'flash') continue;          /* these cover the panel, whatever the fit */
            assert.strictEqual(L.id, N.id);
            assert.ok(Math.abs(L.x - (10 + 2 * N.x)) <= 2 && Math.abs(L.y - (20 + 2 * N.y)) <= 2, L.id + ' moved with the fit');
            assert.ok(Math.abs(L.w - 2 * N.w) <= 3 && Math.abs(L.h - 2 * N.h) <= 3, L.id + ' grew with the fit');
        }
        assert.strictEqual(layer(big, 'speedDial').uniforms(state(big, {})).u_art[2], 2);
    } finally {
        M.setFit();
    }
    /* and the car's fit is back, exactly */
    assert.deepStrictEqual([M.ART.s, M.ART.ox, M.ART.oy], [M.PANEL_FIT.s, M.PANEL_FIT.ox, M.PANEL_FIT.oy]);
    assert.deepStrictEqual(boxes(build({ mFixture: true })), before);
});

/* ------------------------------------------------- the outline compiler */

/* the generated GLSL of one outline, as a JavaScript function of [x, y] */
function outline(pts, radii, closed) {
    const N = '(-?[\\d.e-]+)';
    const js = mShaders.chain('f', pts, radii, closed)
        .replace(/^float f\(vec2 p\) \{/, '')
        .replace(/\}\s*$/, '')
        .replace(new RegExp('dot\\(p - vec2\\(' + N + ', ' + N + '\\), vec2\\(' + N + ', ' + N + '\\)\\)', 'g'),
            '((p[0] - ($1)) * ($3) + (p[1] - ($2)) * ($4))')
        .replace(new RegExp('q = p - vec2\\(' + N + ', ' + N + '\\);', 'g'), 'q = [p[0] - ($1), p[1] - ($2)];')
        .replace(new RegExp('dot\\(q, vec2\\(' + N + ', ' + N + '\\)\\)', 'g'), '(q[0] * ($1) + q[1] * ($2))')
        .replace(/length\(q\)/g, 'Math.hypot(q[0], q[1])')
        .replace(/\bmax\(/g, 'Math.max(')
        .replace('float d =', 'var d =')
        .replace('vec2 q;', 'var q;');
    assert.ok(!/vec2|float|dot\(/.test(js), 'everything in the outline was understood:\n' + js);
    return new Function('p', js);
}

test('an outline\'s distance: negative inside, the corners rounded by their own radius', () => {
    /* a 100 x 60 box, clockwise with y down; two corners rounded */
    const f = outline([[0, 0], [100, 0], [100, 60], [0, 60]], [10, 0, 20, 0], true);
    const near = (a, b, why) => assert.ok(Math.abs(a - b) < 0.01, `${why}: ${a} != ${b}`);
    near(f([50, 30]), -30, 'the middle');
    near(f([110, 30]), 10, 'right of it');
    near(f([50, -7]), 7, 'above it');
    near(f([100, 0]), 0, 'a sharp corner is on the outline');
    near(f([0, 0]), 10 * (Math.SQRT2 - 1), 'a rounded corner is cut away');
    near(f([10 - 10 / Math.SQRT2, 10 - 10 / Math.SQRT2]), 0, 'on the arc');
    near(f([100, 60]), 20 * (Math.SQRT2 - 1), 'the larger radius cuts further');
    near(f([5, 5]), Math.hypot(5, 5) - 10, 'inside, by the arc');
    /* an open chain: its first and last edges run on for ever */
    const g = outline([[0, 100], [0, 0], [100, 0]], [0, 25, 0], false);
    near(g([50, 5000]), -50, 'far down the first edge');
    near(g([5000, 40]), -40, 'far along the last');
    near(g([0, 0]), 25 * (Math.SQRT2 - 1), 'its one corner is rounded');
});

test('every plate is a clockwise convex slab, and its corners are rounded as measured', () => {
    for (const [id, P] of Object.entries(M.PLATES)) {
        const f = outline(P.v, P.r, true), k = P.v.length;
        const cx = P.v.reduce((a, v) => a + v[0], 0) / k, cy = P.v.reduce((a, v) => a + v[1], 0) / k;
        assert.ok(f([cx, cy]) < -20, `${id}: its middle is inside`);
        assert.ok(M.convexDist(P.v, cx, cy) < -20, `${id} is listed clockwise`);
        for (let i = 0; i < k; i++) {
            const a = P.v[(i + k - 1) % k], b = P.v[i], c = P.v[(i + 1) % k];
            /* convex: each corner turns the same way */
            const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
            assert.ok(turn > 0, `${id}: corner ${i} is convex`);
            /* at the corner itself the outline stands off by r (1 / sin(half the angle) - 1) */
            const u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]];
            const cos = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]));
            const want = P.r[i] * (1 / Math.sin(Math.acos(cos) / 2) - 1);
            assert.ok(Math.abs(f(b) - want) < 0.05, `${id} corner ${i}: ${f(b)} != ${want}`);
        }
        /* its light: a brightness the shader can show, falling gently */
        assert.ok(P.g[2] > 40 && P.g[2] < 118 && Math.abs(P.g[3]) < 1 && Math.abs(P.g[4]) < 1, `${id} light`);
    }
    /* the shaders are written from these same numbers */
    for (const id of ['LU1', 'LU2', 'LL1', 'LL2']) {
        assert.ok(mShaders.mplatesL.includes(mShaders.chain('pl' + id, M.PLATES[id].v, M.PLATES[id].r, true)), id);
    }
    for (const id of ['RU1', 'RU2', 'RL1', 'RL2']) {
        assert.ok(mShaders.mplatesR.includes(mShaders.chain('pl' + id, M.PLATES[id].v, M.PLATES[id].r, true)), id);
    }
});

/* -------------------------------------------------------- the map's window */

test('the window is a V: the black field and the two plates in it, thinned on a curve with no corner', () => {
    const W = M.WINDOW;
    /* a V: clockwise, level top and foot, wide above and narrow below, about the dials' axis */
    assert.strictEqual(W.poly.length, 4);
    const [tl, tr, br, bl] = W.poly;
    assert.ok(Math.abs(tl[1] - tr[1]) < 0.5 && Math.abs(bl[1] - br[1]) < 0.5, 'level top and foot');
    assert.ok(tr[0] - tl[0] > 600 && br[0] - bl[0] < 260, 'wide above, narrow below');
    assert.ok(tr[0] - tl[0] > 2.5 * (br[0] - bl[0]), 'a V, not a box');
    assert.ok(Math.abs((tl[0] + tr[0]) / 2 - M.AX) < 14 && Math.abs((bl[0] + br[0]) / 2 - M.AX) < 14, 'about the axis');
    assert.ok(br[1] - tl[1] > 360, 'the full height of the plates');
    /* down from the top edge, far from its sides: the curve, level at both ends */
    for (const d of [-5, 0, W.inset, W.inset + W.feather / 4, W.inset + W.feather / 2, W.inset + W.feather, 80]) {
        const want = M.smoother((d - W.inset) / W.feather);
        assert.ok(Math.abs(Track.revealAt(M.AX, tl[1] + d) - want) < 1e-9, `${d} in from the top: ${want}`);
    }
    assert.strictEqual(Track.revealAt(M.AX, tl[1] + W.inset + W.feather / 2), 0.5, 'half-way through the fade');
    assert.ok(W.feather >= 36, 'a wide fade, not a line');
    assert.strictEqual(Track.revealAt(M.AX, 200), 1, 'wide open in the middle');
    assert.strictEqual(Track.revealAt(M.AX, 400), 1, 'and down between the lower plates');
    /* far more of the picture than the black field alone gave (the first window: about 62,000 square units) */
    let area = 0;
    for (let y = 100; y < 490; y += 2) for (let x = 520; x < 1260; x += 2) area += Track.revealAt(x, y) * 4;
    assert.ok(area > 110000, 'the open area: ' + Math.round(area));

    /* the two plates that stand in it thin out with the glass; no other plate is touched */
    assert.deepStrictEqual(W.plates, ['LL2', 'RL2']);
    const centroid = (v) => [v.reduce((n, q) => n + q[0], 0) / v.length, v.reduce((n, q) => n + q[1], 0) / v.length];
    W.plates.forEach((id) => {
        const c = centroid(M.PLATES[id].v);
        assert.ok(Track.revealAt(c[0], c[1]) > 0.9, `${id} is in the window`);
    });
    let onOthers = 0, shown = 0;
    for (let y = 60; y < 560; y += 3) {
        for (let x = 250; x < 1560; x += 3) {
            const r = Track.revealAt(x, y);
            if (r > 0) shown++;
            const plate = Object.keys(M.PLATES).find((id) => M.roundDist(M.PLATES[id].v, M.PLATES[id].r, x, y) < 0);
            if (plate && W.plates.indexOf(plate) < 0) {
                onOthers++;
                assert.ok(r < 0.02, `the picture shows on ${plate} at ${x}, ${y}: ${r}`);
            }
        }
    }
    assert.ok(onOthers > 5000 && shown > 8000, 'the plates and the window were both sampled');

    /* the shaders work it out from the same outline and numbers: the glass, and both plate groups */
    const win = mShaders.chain('win', W.poly, W.r, true);
    for (const id of ['mback', 'mplatesL', 'mplatesR']) {
        const src = mShaders[id];
        assert.ok(src.includes(win), id + ': the outline');
        assert.ok(src.includes('float smoother(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }'), id);
        assert.ok(src.includes(`return smoother(clamp((-win(p) - ${W.inset}.0) / ${W.feather}.0, 0.0, 1.0));`), id);
    }
    assert.ok(mShaders.mback.includes('if (u_open > 0.001) a = 1.0 - u_open * reveal(p);'));
    assert.ok(mShaders.mplatesL.includes('if (u_open > 0.001) a *= 1.0 - u_open * reveal(p);'));
    assert.ok(mShaders.mplatesR.includes('if (u_open > 0.001) a *= 1.0 - u_open * reveal(p);'));
});

test('the window lies inside BMW\'s map window, where Waze and the camera land', () => {
    const w = build().window, m = Track.MAP_WINDOW;
    assert.ok(w.x >= m.x && w.y >= m.y && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h,
        JSON.stringify(w) + ' not inside ' + JSON.stringify(m));
    /* and it is the window's own bounds, on the panel */
    const b = M.windowBox();
    assert.ok(w.x <= M.px(b.x0) && w.x + w.w >= M.px(b.x1) && w.y <= M.py(b.y0) && w.y + w.h >= M.py(b.y1));
});

test('the back glass sits above the hosted picture, and it and the window\'s plates open together', () => {
    const t = build();
    const back = layer(t, 'back');
    assert.ok(back.z >= 1);
    assert.ok(t.layers.every((L) => L.z >= back.z), 'nothing of ours is under the glass');
    assert.deepStrictEqual([back.x, back.y, back.w], [0, 0, Panel.PANEL_WIDTH], 'it covers the panel');
    for (const id of ['back', 'platesL', 'platesR']) {
        const open = (centre) => layer(t, id).uniforms(state(t, {}, { centre })).u_open;
        assert.strictEqual(open(CENTRES[0]), 0, id + ': shut with nothing to show');
        assert.strictEqual(open(CENTRES[1]), 1, id + ': open on the map');
        assert.strictEqual(open(CENTRES[2]), 0.5, id + ': as far as the camera has faded in');
        assert.strictEqual(open(CENTRES[3]), 0, id + ': our own turn card keeps it shut');
        assert.strictEqual(layer(t, id).uniforms(state(t, {})).u_open, 0, id + ': shut when the centre says nothing');
    }
    /* only the glass and the plates that stand in a window have one in them */
    for (const [id, src] of Object.entries(mShaders)) {
        assert.strictEqual(/u_open/.test(src), ['mback', 'mplatesL', 'mplatesR', 'mpback', 'mpcentre', 'mpsideR',
            /* ... and the same with the larger window, where the plate above the speed is in it too */
            'mbackWide', 'mplatesLWide', 'mplatesRWide', 'mpbackWide', 'mpcentreWide', 'mpsideRWide', 'mpsideLWide',
            /* ... and M Sport Plus's fullest, where everything in the middle thins by one field */
            'mpbackMost', 'mpcentreMost', 'mpsideRMost', 'mpsideLMost',
            /* ... and M Sport's centre lines where a picture shows (either window) */
            'mdiagFade', 'mdiagFadeWide',
            /* ... and the widest window: one glass for both styles, and every plate and M Sport's lines, which go as it opens */
            'mbackFull', 'mplatesLFull', 'mplatesRFull', 'mdiagFadeFull', 'mpsideLFull', 'mpcentreFull', 'mpsideRFull'].includes(id), id);
    }
});

test('M Sport\'s centre lines thin out with the window where a picture shows, unless kept', () => {
    const lines = (cfg) => layer(build(cfg), 'centreLines');
    /* a closed centre and a turn card draw the lines as they always were: no window in them */
    for (const cfg of [{}, { centre: 'off' }, { centre: 'turn' }, { centre: 'waze', mLines: 'keep' },
        { centre: 'map', centreSize: 'more', mLines: 'keep' }]) {
        const L = lines(cfg), t = build(cfg);
        assert.strictEqual(L.shader, 'mdiag', JSON.stringify(cfg));
        for (const centre of CENTRES) {
            assert.ok(!('u_open' in L.uniforms(state(t, {}, { centre }))), JSON.stringify(cfg) + ': told nothing of the window');
        }
    }
    assert.ok(!/u_open|reveal\(/.test(mShaders.mdiag), 'the lines as they come have no window in them');
    /* with a picture to show they follow the glass: shut, open, half-way, shut for our own turn card */
    for (const centre of ['waze', 'map', 'camera']) {
        for (const size of ['standard', 'more']) {
            const cfg = { centre, centreSize: size }, t = build(cfg), L = layer(t, 'centreLines');
            assert.strictEqual(L.shader, size === 'more' ? 'mdiagFadeWide' : 'mdiagFade', JSON.stringify(cfg));
            assert.strictEqual(t.settings.mLines, 'fade');
            const open = (c) => L.uniforms(state(t, {}, { centre: c })).u_open;
            assert.deepStrictEqual([open(CENTRES[0]), open(CENTRES[1]), open(CENTRES[2]), open(CENTRES[3])], [0, 1, 0.5, 0]);
            assert.strictEqual(L.uniforms(state(t, {})).u_open, 0, 'shut when the centre says nothing');
            /* and it is told exactly what the glass and the plates are */
            for (const c of CENTRES) {
                assert.strictEqual(open(c), layer(t, 'back').uniforms(state(t, {}, { centre: c })).u_open);
            }
        }
    }
    /* anything but "keep" fades (a saved setting from before the choice has none) */
    assert.strictEqual(lines({ centre: 'waze', mLines: 'nonsense' }).shader, 'mdiagFade');
    /* the same strokes, the same colours, in the same place: only the window is added */
    const body = (src) => src.slice(src.indexOf('void main()')).replace("  if (u_open > 0.001) c.a *= 1.0 - u_open * reveal(p);\n", '');
    assert.strictEqual(body(mShaders.mdiagFade), body(mShaders.mdiag));
    assert.strictEqual(body(mShaders.mdiagFadeWide), body(mShaders.mdiag));
    assert.ok(mShaders.mdiagFade.includes('if (u_open > 0.001) c.a *= 1.0 - u_open * reveal(p);'));
    /* each fades in its own window: the glass's own outline, word for word */
    const win = (src) => src.slice(src.indexOf('float win(vec2 p)'), src.indexOf('void main()'));
    assert.strictEqual(win(mShaders.mdiagFade), win(mShaders.mback).replace(/uniform[^\n]*\n/g, ''));
    assert.strictEqual(win(mShaders.mdiagFadeWide), win(mShaders.mbackWide).replace(/uniform[^\n]*\n/g, ''));
    assert.ok(/win2\(/.test(mShaders.mdiagFadeWide) && !/win2\(/.test(mShaders.mdiagFade));
    const a = lines({ centre: 'waze' }), b = lines({});
    assert.deepStrictEqual([a.x, a.y, a.w, a.h, a.z], [b.x, b.y, b.w, b.h, b.z]);
    const ua = a.uniforms(state(build({ centre: 'waze' }), {})), ub = b.uniforms(state(build(), {}));
    assert.deepStrictEqual([ua.u_cyan, ua.u_red, ua.u_art], [ub.u_cyan, ub.u_red, ub.u_art]);

    /*
     * What that takes away, the window wide open: nearly all of the cyan
     * line and most of the red one - everything of them that crossed the
     * picture - while their feet, under the window, still run into the rails.
     */
    const D = M.DIAG;
    const along = (p, q, f) => Array.from({ length: 401 }, (_, i) => f(p[0] + (q[0] - p[0]) * i / 400, p[1] + (q[1] - p[1]) * i / 400));
    const share = (r, test2) => r.filter(test2).length / r.length;
    for (const [name, f, cyanGone, redGone] of [['standard', M.revealAt, 0.85, 0.6], ['more', M.revealMoreAt, 0.95, 0.7]]) {
        const cyan = along(D.cyan.p0, D.cyan.p1, f), red = along(D.red.p0, D.red.p1, f), back = along(D.cyan.p1, D.cyan.p2, f);
        assert.ok(share(cyan, (v) => v > 0.95) > cyanGone, name + ': the cyan line is gone from the picture');
        assert.ok(share(red, (v) => v > 0.95) > redGone, name + ': the red line is gone from the picture');
        assert.ok(cyan[0] > 0.9, name + ': the cyan line\'s top end, well inside the window, goes with it');
        /* the feet: the cyan line's return stroke and the red line's last stretch, down to the rails */
        assert.ok(share(back, (v) => v < 0.05) > 0.97, name + ': the cyan line\'s return stroke stays');
        assert.ok(red[400] === 0 && back[400] === 0, name + ': both still meet their rails');
        assert.ok(share(red, (v) => v < 0.02) > 0.15, name + ': the red line\'s foot stays');
    }
    /* M Sport Plus has no such lines, whatever is asked */
    assert.strictEqual(layer(build({ style: 'mplus', centre: 'waze' }), 'centreLines'), undefined);
});

test('no readout stands where the picture shows', () => {
    for (const units of ['imperial', 'metric']) {
        const t = build({ units, mFixture: true, clock12: true });
        const st = state(t, { rpm: 3000, speedKmh: 330, gear: 'M8', fuelPct: 40, oilTempC: 100, rangeKm: 999,
                              ambientC: -22.5, clock: { h: 23, m: 59 } }, { centre: CENTRES[1] });
        for (const L of t.layers.filter(isText)) {
            const u = L.uniforms(st, 0);
            if (!u) continue;
            for (const q of quads(L, u)) {
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h],
                                      [q.x + q.w / 2, q.y + q.h / 2]]) {
                    const ax = (x - M.ART.ox) / M.ART.s, ay = (y - M.ART.oy) / M.ART.s;
                    assert.strictEqual(Track.revealAt(ax, ay), 0, `${L.id} over the map at ${Math.round(x)}, ${Math.round(y)}`);
                }
            }
        }
    }
});

/* ---------------------------------------------------------- the car's rules */

test('M: nothing below the cut, nothing off the panel, nothing under a factory box', () => {
    /* what the car lays over us is decoration's to lose, never a reading's */
    const DECOR = /^(back|plates[LCR]|centreLines|flash|snow\d)$/;
    for (const style of M_STYLES) for (const id of Object.keys(Panel.PROFILES)) {
        const zones = Panel.keepClear(id).filter((z) => z.id !== 'bottomStrip');
        const t = build({ style, profile: id, mFixture: true, holiday: true, clock12: true, mPop: 'on' });
        const st = state(t, { rpm: 3000, speedKmh: 330, gear: 'M8', driveMode: 'SPORT_PLUS', fuelPct: 40, oilTempC: 100,
                              rangeKm: 999, ambientC: -22.5, clock: { h: 23, m: 59 } });
        for (const L of t.layers) {
            if (L.belowCut) assert.strictEqual(L.id, 'back', 'only the glass may be asked below the cut');
            else assert.ok(L.y + L.h <= Panel.BOTTOM_CUT, `${id}/${L.id} reaches ${L.y + L.h}`);
            assert.ok(L.x >= 0 && L.y >= 0 && L.x + L.w <= Panel.PANEL_WIDTH, `${id}/${L.id} off the panel`);
            assert.ok(Number.isInteger(L.x) && Number.isInteger(L.y) && Number.isInteger(L.w) && Number.isInteger(L.h),
                `${id}/${L.id} on whole pixels`);
            if (DECOR.test(L.id)) continue;
            /* a text layer is judged by its glyphs, anything else by its box */
            let ink = [L];
            if (isText(L)) { const u = L.uniforms(st, 0); ink = u ? inkOf(L, u) : []; }
            for (const z of zones) {
                /*
                 * The rev dial's layer is wide because it carries the level
                 * line across its top; down at the M box there is only the
                 * dial's rail, far to the right of it (checked below).
                 */
                if (z.id === 'mBoxB' && L.id === 'revDial') continue;
                assert.ok(!ink.some((r) => hits(r, z)), `${style}/${id}/${L.id} under ${z.name}`);
            }
        }
    }
    /* the rev dial at the heights of the right-hand M box: its innermost
       ink there is the fine contour, the mirror of the speed dial's */
    const z = Panel.PROFILES.mCarS58.extraZones.find((b) => b.id === 'mBoxB');
    for (let y = z.y; y <= z.y + z.h; y += 2) {
        const ay = (y - M.ART.oy) / M.ART.s;
        const inner = M.px(M.mirror(M.contourX(ay) + M.DIAL.conW));
        assert.ok(inner > z.x + z.w + 40, `the rev dial at y ${y} starts at ${Math.round(inner)}`);
    }
});

test('no glyph is hidden behind the cut corners of the glass', () => {
    for (const style of M_STYLES) for (const units of ['imperial', 'metric']) {
        const t = build({ style, units, mFixture: true, clock12: true, mPop: 'on' });
        const st = state(t, { rpm: 3000, speedKmh: 330, gear: 'M8', fuelPct: 40, oilTempC: 100, rangeKm: 999,
                              ambientC: -22.5, clock: { h: 23, m: 59 } });
        for (const L of t.layers.filter(isText)) {
            const u = L.uniforms(st, 0);
            for (const q of (u ? inkOf(L, u) : [])) {
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]) {
                    assert.ok(!Panel.inCutCorner(x, y), `${style}/${L.id} (${units}) in a cut corner`);
                }
            }
        }
    }
});

test('M shaders fit the budget and avoid what the head unit refuses', () => {
    assert.deepStrictEqual(Object.keys(mShaders).sort(),
        ['mback', 'mbackFull', 'mbackWide', 'mbadge', 'mdiag', 'mdiagFade', 'mdiagFadeFull', 'mdiagFadeWide', 'mfoot', 'mgauge', 'mgauge10', 'mgauge6', 'mgauge7', 'mgauge9',
         'mnum', 'mnum10', 'mnum6', 'mnum7', 'mnum9', 'mpback', 'mpbackMost',
         'mpbackWide', 'mpcentre', 'mpcentreFull',
         'mpcentreMost', 'mpcentreWide', 'mplatesL', 'mplatesLFull', 'mplatesLWide', 'mplatesR', 'mplatesRFull', 'mplatesRWide', 'mprails', 'mpsideL',
         'mpsideLFull', 'mpsideLMost', 'mpsideLWide', 'mpsideR', 'mpsideRFull', 'mpsideRMost', 'mpsideRWide', 'mrails', 'mstrip', 'tturn'],
        'shaders only: the outline compiler is not listed with them');
    for (const [id, src] of Object.entries(mShaders)) {
        let vectors = 3;                      /* u_size, u_time, u_keep from the prelude */
        for (const m of src.matchAll(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)(\[(\d+)\])?/g)) {
            vectors += m[4] ? Number(m[4]) : 1;
        }
        assert.ok(vectors <= 48, `${id}: ${vectors} vectors`);
        assert.ok(!/\bbreak\b/.test(src), `${id} uses break`);
        for (const r of ['u_mvp', 'u_mv', 'u_m', 'u_v', 'u_p', 'u_normal']) {
            assert.ok(!new RegExp(`uniform\\s+\\w+\\s+${r}\\b`).test(src), `${id} declares ${r}`);
        }
    }
});

test('with everything switched on the M styles stay inside the layer budget', () => {
    for (const style of M_STYLES) {
        const t = build({ style, mFixture: true, holiday: true, revFlash: 'both', intro: true, clock12: true });
        assert.ok(t.layers.length <= 64, `${style}: ${t.layers.length} layers`);
        assert.strictEqual(new Set(t.layers.map((L) => L.id)).size, t.layers.length, 'no two layers share a name');
    }
});

test('every M layer is given exactly the uniforms its shader declares', () => {
    const BUILT_IN = ['u_size', 'u_time', 'u_keep', 'u_atlas', 'u_atlasSize'];
    for (const cfg of [{ mFixture: true, revFlash: 'both', clock12: true }, { mPanel: 'mode', units: 'metric', clock12: true },
                       { style: 'mplus', mFixture: true, revFlash: 'both', clock12: true },
                       { style: 'mplus', mPanel: 'mode', units: 'metric', clock12: true, mPop: 'off' },
                       { centreSize: 'more', mFixture: true, clock12: true },
                       { style: 'mplus', centreSize: 'more', mFixture: true, clock12: true },
                       { style: 'mplus', centreSize: 'most', mFixture: true, clock12: true },
                       { centreSize: 'full', mFixture: true, clock12: true }, { centreSize: 'full', mLines: 'keep', clock12: true },
                       { style: 'mplus', centreSize: 'full', mFixture: true, clock12: true }]) {
        const t = build(cfg);
        const st = state(t, { rpm: 7100, speedKmh: 120, gear: 'D', driveMode: 'SPORT', fuelPct: 40, oilTempC: 100,
                              rangeKm: 207, ambientC: 12.5, clock: { h: 12, m: 4 } }, { centre: CENTRES[3] });
        for (const L of t.layers) {
            const src = allShaders[L.shader];
            assert.ok(src, `${L.id}: no shader called ${L.shader}`);
            const u = L.uniforms(st, 0);
            assert.ok(u, L.id + ' shows in this state');
            const declared = [...src.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1])
                .filter((k) => !BUILT_IN.includes(k)).sort();
            assert.deepStrictEqual(Object.keys(u).sort(), declared, `${L.id} (${L.shader})`);
        }
    }
});

test('every uniform is sent in the shape its shader declares (floats, vectors, and arrays only of vec4)', () => {
    /*
     * The car's driver and the preview both type a value by its length:
     * one number a float, 2 / 3 / 4 a vector, anything longer an array of
     * vec4. A float array would arrive as nothing at all.
     */
    const want = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
    for (const cfg of [{ style: 'toro' }, { style: 'toro', holiday: true, intro: true, background: 'modern' },
                       { mFixture: true, revFlash: 'both', clock12: true }, { style: 'mplus', revFlash: 'both', clock12: true }]) {
        const t = Themes.build(atlas, 'x3m40i', Object.assign({ style: 'track' }, cfg));
        const st = state(t, { rpm: 7100, speedKmh: 120, gear: 'D', driveMode: 'SPORT', fuelPct: 40, oilTempC: 100, oilPressBar: 4,
                              rangeKm: 207, ambientC: 12.5, clock: { h: 12, m: 4 }, gLat: 0.2, gLon: 0.1 },
                         { centre: CENTRES[3], sinceOn: 3, now: 5000 });
        for (const L of t.layers) {
            const src = allShaders[L.shader], u = L.uniforms ? L.uniforms(st, 0) : null;
            if (!src || !u) continue;
            for (const [name, v] of Object.entries(u)) {
                const m = src.match(new RegExp('uniform\\s+(\\w+)\\s+' + name + '(?:\\[(\\d+)\\])?\\s*;'));
                if (!m) continue;                                   /* declared-or-not is another test's business */
                const len = typeof v === 'number' || typeof v === 'boolean' ? 1 : v.length;
                if (m[2]) {
                    assert.strictEqual(m[1], 'vec4', `${cfg.style || 'track'}/${L.id}.${name}: an array must be of vec4`);
                    assert.strictEqual(len, 4 * Number(m[2]), `${L.id}.${name}: ${len} numbers for vec4[${m[2]}]`);
                } else {
                    assert.strictEqual(len, want[m[1]], `${cfg.style || 'track'}/${L.id}.${name}: ${len} numbers for a ${m[1]}`);
                }
            }
        }
    }
    /* and no shader of ours declares an array of anything else */
    for (const [id, src] of Object.entries(allShaders)) {
        for (const m of src.matchAll(/uniform\s+(\w+)\s+\w+\[\d+\]/g)) assert.strictEqual(m[1], 'vec4', id + ' declares an array of ' + m[1]);
    }
});

test('every M layer gives finite uniforms and keeps its glyphs inside, in every centre mode', () => {
    const bad = new Set();
    for (const style of M_STYLES) for (const units of ['imperial', 'metric']) {
        for (const mPanel of ['4wd', 'mode']) {
            /* the numerals grow in M Sport Plus by default; here in M Sport too, with the driving-mode panel */
            const t = build({ style, units, mPanel, mFixture: true, clock12: mPanel === 'mode', mPop: mPanel === 'mode' ? 'on' : 'auto' });
            const sim = Sim.create(PROFILE);
            for (let i = 0; i < 1200; i++) {
                sim.step(1 / 60);
                if (i % 151) continue;
                const st = State.present(sim.raw(), PROFILE, t.settings);
                for (const centre of CENTRES) {
                    for (const gear of ['P', 'R', 'N', 'D', '1', '8', 'M8', 'S5']) {
                        for (const speed of [0, 99, 100, 330]) {
                            const s2 = Object.assign({}, st, { gear, speed, centre, modeLabel: 'SPORT PLUS' });
                            for (const L of t.layers) {
                                const u = L.uniforms ? L.uniforms(s2, 0) : null;
                                if (!u) continue;
                                for (const [k, v] of Object.entries(u)) {
                                    for (const n of (typeof v === 'number' ? [v] : v)) {
                                        if (!Number.isFinite(n)) bad.add(`${L.id}.${k} = ${n}`);
                                    }
                                }
                                if (!isText(L)) continue;
                                assert.ok(countOf(L, u) <= Text.MAX_GLYPHS);
                                for (const q of inkOf(L, u)) {
                                    if (q.x >= L.x - 1 && q.y >= L.y - 1 && q.x + q.w <= L.x + L.w + 1 &&
                                        q.y + q.h <= L.y + L.h + 1) continue;
                                    bad.add(`${style}/${L.id} (${units}, gear ${gear}, speed ${speed}): glyph outside ${L.w}x${L.h}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    assert.deepStrictEqual([...bad].sort(), []);
});

/* ---------------------------------------------------------------- the dials */

test('one value mapping: the scale is linear in height, and uneven where the car\'s is', () => {
    /* ticks stand a fixed step apart, the first at the foot */
    for (let k = 0; k < M.SCALE.n; k++) assert.ok(Math.abs(M.tickY(k) - M.tickY(k + 1) - M.SCALE.dy) < 1e-9);
    assert.strictEqual(M.tickY(0), M.SCALE.y0);
    for (const units of ['imperial', 'metric']) {
        const s = M.SPEED_SCALE[units];
        assert.strictEqual(s.length, M.SCALE.n + 1);
        s.forEach((v, k) => assert.strictEqual(M.speedTicks(v, units), k, `${v} is tick ${k}`));
        for (let v = 0; v < s[8] + 40; v += 0.5) {
            const a = M.speedTicks(v, units), b = M.speedTicks(v + 0.5, units);
            assert.ok(b >= a && b <= 8 && a >= 0, 'never falls back, never leaves the scale');
        }
    }
    assert.strictEqual(M.speedTicks(130, 'imperial'), 6.5, 'half-way between 120 and 140');
    assert.strictEqual(M.speedTicks(200, 'metric'), 6.5, 'half-way between 180 and 220');
    assert.deepStrictEqual([M.SPEED_SCALE.metric[8], M.SPEED_SCALE.imperial[8]], [260, 160], 'to 260 km/h, 160 mph: as Cluster Layouts');
    assert.strictEqual(M.speedTicks(-3, 'metric'), 0);
    assert.strictEqual(M.speedTicks(undefined, 'metric'), 0);
    assert.strictEqual(M.rpmTicks(4000), 4);
    assert.strictEqual(M.rpmTicks(9500), 8);
    assert.strictEqual(M.rpmTicks(undefined), 0);

    const t = build(), L = layer(t, 'speedDial'), R = layer(t, 'revDial');
    const val = (D, o) => D.uniforms(state(t, {}, o)).u_val;
    assert.strictEqual(val(L, { speed: 0 }), 0);
    assert.strictEqual(val(L, { speed: 80 }), 4, '80 mph is the fifth of nine numerals');
    assert.strictEqual(val(L, { speed: 160 }), 8);
    assert.strictEqual(val(L, { speed: 400 }), 8, 'held at the top, never wraps');
    assert.strictEqual(val(R, { rpm: 4000 }), 4);
    assert.strictEqual(val(layer(build({ units: 'metric' }), 'speedDial'), { speed: 200 }), 6.5);
    /* the rev dial is the speed dial through a mirror */
    assert.strictEqual(L.uniforms(state(t, {})).u_side, 0);
    assert.strictEqual(R.uniforms(state(t, {})).u_side, 1);
    assert.ok(Math.abs((L.x + R.x + R.w) / 2 - 960) <= 1 && Math.abs((L.x + L.w + R.x) / 2 - 960) <= 1);
    assert.deepStrictEqual([L.y, L.h], [R.y, R.h]);
});

test('each numeral stands at its own tick, and the two beside the value light up', () => {
    for (const units of ['imperial', 'metric']) {
        const t = build({ units });
        const st = state(t, {});
        const seen = { speed: [], rev: [] };
        for (const [id, which] of [['speedScaleA', 'speed'], ['speedScaleB', 'speed'], ['revScale', 'rev']]) {
            const L = layer(t, id), u = L.uniforms(st, 0);
            const str = read(L, u), q = quads(L, u);
            /* the tick each glyph belongs to: the shader's own sum */
            const ticks = q.map((g) => Math.floor((M.SCALE.y0 - ((g.y + g.h / 2) - M.ART.oy) / M.ART.s) / M.SCALE.dy + 0.5));
            assert.ok(Math.abs(u.u_art[1] + (q[0].y - L.y + q[0].h / 2) / u.u_art[2] -
                ((q[0].y + q[0].h / 2) - M.ART.oy) / M.ART.s) < 1e-9, 'u_art carries the layer to the artboard');
            const by = {};
            ticks.forEach((k, i) => { by[k] = (by[k] || '') + str[i]; });
            for (const [k, s] of Object.entries(by)) seen[which][k] = s;
            /* level with the tick: the figure's middle is on the tick's height */
            const size = q[0].h / atlas.faces.mw.glyphs['0'].h;
            for (const [i, g] of q.entries()) {
                const m = atlas.faces.mw.glyphs[str[i]];
                const base = g.y - m.by * size;                       /* the baseline */
                const mid = base - 0.35 * size;                       /* half a figure up */
                assert.ok(Math.abs(mid - M.py(M.tickY(ticks[i]))) < 0.75, `${id} "${str[i]}" is level with tick ${ticks[i]}`);
            }
        }
        assert.deepStrictEqual(seen.speed, M.SPEED_SCALE[units].map(String), units + ' speed numerals, foot to top');
        assert.deepStrictEqual(seen.rev, ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
    }
    /* what lights: the numerals either side of the value (the shader's rule) */
    assert.match(mShaders.mnum, /float k = floor\(\(Y0 - gy\) \/ DY \+ 0\.5\);/);
    assert.match(mShaders.mnum, /float lit = smoothstep\(0\.0, 0\.25, 1\.0 - abs\(k - u_cfg\.z\)\);/);
    const t = build();
    assert.strictEqual(layer(t, 'speedScaleB').uniforms(state(t, {}, { speed: 76 })).u_cfg[2], 3.8,
        '76 mph: "60" and "80" light, as on the car');
    assert.strictEqual(layer(t, 'speedScaleA').uniforms(state(t, {}, { speed: 76 })).u_cfg[2], 3.8);
    assert.strictEqual(layer(t, 'revScale').uniforms(state(t, {}, { rpm: 738 })).u_cfg[2], 0.738);
});

test('the scale\'s numerals hug the rail: speed outside on the left, revs outside on the right', () => {
    for (const units of ['imperial', 'metric']) {
        const t = build({ units }), st = state(t, {});
        for (const id of ['speedScaleA', 'speedScaleB']) {
            const L = layer(t, id), u = L.uniforms(st, 0);
            for (const q of quads(L, u)) {
                const ay = ((q.y + q.h / 2) - M.ART.oy) / M.ART.s;
                assert.ok(q.x + q.w < M.px(M.rimOuterX(ay)) + 6, `${id}: left of the rim`);
            }
        }
        const R = layer(t, 'revScale');
        for (const q of quads(R, R.uniforms(st, 0))) {
            const ay = ((q.y + q.h / 2) - M.ART.oy) / M.ART.s;
            assert.ok(q.x > M.px(M.mirror(M.rimOuterX(ay))) - 6, 'revScale: right of the rim');
        }
    }
    /* clear of the tyre-pressure telltale, which the car draws beside the speed scale */
    const tyre = Panel.TELLTALES.find((z) => z.id === 'tyre');
    for (const id of ['speedScaleA', 'speedScaleB']) assert.ok(!hits(layer(build({ units: 'metric' }), id), tyre), id);
});

test('the red field follows the redline; the speed dial has none', () => {
    const zone = (cfg, id) => { const t = build(cfg); return layer(t, id).uniforms(state(t, {})).u_zone; };
    assert.deepStrictEqual(zone({}, 'speedDial'), [0, 0, 0, 0]);
    const z = zone({}, 'revDial');                       /* this car: 6750 */
    assert.ok(Math.abs(z[0] - 6.84) < 1e-9 && z[1] > 7.9 && z[1] <= 8, 'red from just past the redline to the top');
    assert.ok(z[2] < z[3] && z[3] < z[0], 'the amber field ends before the red starts');
    assert.ok(Math.abs(zone({ rpmRedline: 7000 }, 'revDial')[0] - 7.09) < 1e-9, 'it moves with the setting');
    const high = zone({ rpmRedline: 8000 }, 'revDial');
    assert.ok(high[0] < high[1], 'a redline at the top of the scale still leaves a field to see');
});

test('the limiter flashes the rev dial and the edges only when asked', () => {
    const warn = (cfg, lim) => { const t = build(cfg); return layer(t, 'revDial').uniforms(state(t, {}, { rpm: 7000, limiter: lim })).u_warn; };
    assert.strictEqual(warn({}, 1), 1);
    assert.strictEqual(warn({}, 0), 0);
    assert.strictEqual(warn({ revFlash: 'edges' }, 1), 0, 'edges only: the dial keeps still');
    const off = build({ revFlash: 'off' });
    assert.strictEqual(layer(off, 'revDial').uniforms(state(off, {}, { rpm: 7000, limiter: 1 })).u_warn, 0);
    assert.ok(!off.layers.some((L) => L.id === 'flash'));
    assert.ok(build({ revFlash: 'both' }).layers.some((L) => L.id === 'flash'));
    /* the speed dial never flashes */
    const t = build();
    assert.strictEqual(layer(t, 'speedDial').uniforms(state(t, {}, { limiter: 1 })).u_warn, 0);
});

/* ------------------------------------------------------------ a diesel */

const DIESEL = { engine: 'diesel' };
/* a scale numeral's glyphs with the mark each belongs to, by a diesel dial's own sum (mnum6) */
const marksOf = (q, step) => q.map((g) => Math.floor((M.SCALE.y0 - ((g.y + g.h / 2) - M.ART.oy) / M.ART.s) / (M.SCALE.dy * step) + 0.5));

test('a diesel: the rev scale is 0 - 6 over the same dial, and a petrol\'s is exactly what it was', () => {
    assert.deepStrictEqual(M.revScale('diesel'), { top: 6000, marks: 6, step: 8 / 6 });
    assert.deepStrictEqual(M.revScale('petrol'), { top: 8000, marks: 8, step: 1 });
    assert.deepStrictEqual(M.revScale(), M.revScale('petrol'));
    assert.deepStrictEqual(M.revScale('nonsense'), M.revScale('petrol'));
    /* a height on the dial, in ticks: a diesel's 6,000 is the top of it */
    assert.deepStrictEqual([0, 750, 1500, 3000, 4500, 6000, 9000, undefined].map((r) => M.rpmTicks(r, 6000)), [0, 1, 2, 4, 6, 8, 8, 0]);
    /* ... and a petrol's is the same sum as ever, to the last bit */
    for (let r = 0; r <= 9000; r += 37.3) assert.strictEqual(M.rpmTicks(r), Math.max(0, Math.min(8, r / 1000)));

    for (const style of M_STYLES) {
        const p = build({ style }), d = build(Object.assign({ style }, DIESEL));
        assert.deepStrictEqual([p.settings.engine, d.settings.engine], ['petrol', 'diesel']);
        assert.strictEqual(build({ style, engine: 'nonsense' }).settings.engine, 'petrol', 'petrol unless the owner says diesel');
        /* petrol unless asked: the same shaders as ever, and no layer differs from a build that names no engine */
        assert.deepStrictEqual([layer(p, 'revDial').shader, layer(p, 'revScale').shader, layer(p, 'speedDial').shader], ['mgauge', 'mnum', 'mgauge']);
        const named = build({ style, engine: 'petrol' });
        const sp = state(p, BUSY, { centre: CENTRES[1], limiter: 1 }), sn = state(named, BUSY, { centre: CENTRES[1], limiter: 1 });
        assert.deepStrictEqual(named.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h, L.z]), p.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h, L.z]));
        p.layers.forEach((L, i) => assert.deepStrictEqual(named.layers[i].uniforms(sn, 0), L.uniforms(sp, 0), L.id));
        /* a diesel: only the rev dial and its numerals are other shaders - everything else is the same layer in the same place */
        assert.deepStrictEqual([layer(d, 'revDial').shader, layer(d, 'revScale').shader, layer(d, 'speedDial').shader], ['mgauge6', 'mnum6', 'mgauge']);
        assert.deepStrictEqual(d.layers.map((L) => [L.id, L.x, L.y, L.w, L.h, L.z]), p.layers.map((L) => [L.id, L.x, L.y, L.w, L.h, L.z]));
        assert.deepStrictEqual(d.layers.filter((L, i) => L.shader !== p.layers[i].shader).map((L) => L.id), ['revDial', 'revScale']);
        /* and at rest nothing but those two is told anything else */
        const s0p = state(p, { rpm: 0 }), s0d = state(d, { rpm: 0 });
        for (const [i, L] of p.layers.entries()) {
            if (L.id === 'revDial' || L.id === 'revScale') continue;
            assert.deepStrictEqual(d.layers[i].uniforms(s0d, 0), L.uniforms(s0p, 0), style + '/' + L.id);
        }
    }

    /* the marker: a diesel's 3,000 stands where a petrol's 4,000 does, and 6,000 is the top */
    const d = build(DIESEL), R = layer(d, 'revDial');
    const val = (rpm) => R.uniforms(state(d, { rpm })).u_val;
    assert.deepStrictEqual([0, 750, 3000, 4500, 6000, 7200].map(val), [0, 1, 4, 6, 8, 8]);
    assert.strictEqual(R.uniforms(state(d, {})).u_side, 1);
    /* the speed dial is not touched */
    const p = build();
    for (const speed of [0, 37, 80, 200]) {
        assert.deepStrictEqual(layer(d, 'speedDial').uniforms(state(d, {}, { speed })), layer(p, 'speedDial').uniforms(state(p, {}, { speed })));
    }
});

test('a diesel: seven numerals, each level with its own mark and as far off the rail as the frame\'s, the two beside the value lit', () => {
    const step = M.revScale('diesel').step;
    /* the frame's own numerals: how far from the rim's outer edge their ink starts (the shoulder's own tick apart) */
    const frameGaps = Track.REV_EDGE.map((x, k) => x - M.mirror(M.rimOuterX(M.tickY(k)))).filter((g, k) => k !== 5);
    assert.ok(Math.min(...frameGaps) > 15 && Math.max(...frameGaps) < 23.5, 'measured: ' + frameGaps.map((g) => g.toFixed(1)).join(' '));
    assert.ok(Track.REV_GAP.figure > 17 && Track.REV_GAP.figure < 19.2 && Math.abs(Track.REV_GAP.one - frameGaps[1]) < 0.1, 'the frame\'s own spacing');

    for (const style of M_STYLES) for (const units of ['imperial', 'metric']) for (const mPop of ['on', 'off']) {
        const t = build(Object.assign({ style, units, mPop }, DIESEL)), L = layer(t, 'revScale');
        const u = L.uniforms(state(t, {}), 0), str = read(L, u), q = quads(L, u);
        assert.strictEqual(str, '6543210', 'top of the scale first');
        const marks = marksOf(q, step);
        assert.deepStrictEqual(marks, [6, 5, 4, 3, 2, 1, 0], 'the shader finds each numeral at its own mark');
        const size = q[0].h / atlas.faces.mw.glyphs['0'].h;
        const pad = (atlas.faces.mw.glyphs['0'].h - 0.70) / 2 * size;          /* a glyph's box is this much wider than its ink */
        q.forEach((g, i) => {
            const j = marks[i], ay = M.tickY(j * step);
            /* level with its mark: the figure's middle on the mark's height (which is where the dial draws its tick) */
            const base = g.y - atlas.faces.mw.glyphs[str[i]].by * size, mid = base - 0.35 * size;
            assert.ok(Math.abs(mid - M.py(ay)) < 0.75, `"${str[i]}" is level with mark ${j}`);
            /* outside the rail on the right, as far off it as the frame's stand */
            const rim = M.px(M.mirror(M.rimOuterX(ay)));
            const gap = (g.x + pad - rim) / M.ART.s;
            assert.ok(g.x > rim - 6, `"${str[i]}" is right of the rim`);
            assert.ok(gap > 14 && gap < 25, `"${str[i]}": its ink starts ${gap.toFixed(1)} units off the rim`);
            /* inside its layer, on the panel, above the cut */
            assert.ok(g.x >= L.x && g.y >= L.y && g.x + g.w <= L.x + L.w && g.y + g.h <= L.y + L.h, `"${str[i]}" inside its layer`);
            /* the point it grows about is level with its own mark */
            assert.ok(Math.abs(L.y + u.u_ax[i * 4 + 1] - M.py(ay)) < 1e-6, `"${str[i]}" grows about its mark`);
            assert.ok(L.x + u.u_ax[i * 4] > g.x && L.x + u.u_ax[i * 4] < g.x + g.w, 'anchored inside itself');
        });
        /* evenly spread: a third further apart than a petrol's marks */
        for (let i = 1; i < q.length; i++) {
            assert.ok(Math.abs((q[i].y - q[i - 1].y) / M.ART.s - M.SCALE.dy * step) < 1e-6, 'a mark every 67.6 units');
        }
        assert.strictEqual(u.u_grow, mPop === 'on' ? Track.GROW : 0);
        assert.strictEqual(u.u_cfg[0], 7);
        /* grown to its largest, each still inside the layer and clear of every factory box */
        const s = 1 + u.u_grow;
        q.forEach((g, i) => {
            const ax = L.x + u.u_ax[i * 4], ay2 = L.y + u.u_ax[i * 4 + 1];
            const big = { x: ax + (g.x - ax) * s, y: ay2 + (g.y - ay2) * s, w: g.w * s, h: g.h * s };
            assert.ok(big.x >= L.x - 1 && big.y >= L.y - 1 && big.x + big.w <= L.x + L.w + 1 && big.y + big.h <= L.y + L.h + 1, `"${str[i]}" grown, inside`);
            for (const id of Object.keys(Panel.PROFILES)) {
                for (const z of Panel.keepClear(id).filter((zz) => zz.id !== 'bottomStrip')) assert.ok(!hits(big, z), `"${str[i]}" under ${z.name}`);
            }
            for (const [x, y] of [[big.x, big.y], [big.x + big.w, big.y], [big.x, big.y + big.h], [big.x + big.w, big.y + big.h]]) {
                assert.ok(!Panel.inCutCorner(x, y), `"${str[i]}" in a cut corner`);
            }
        });
    }

    /* what lights: the value comes in marks (thousands of rpm), and the shader's rule is the same one */
    assert.ok(mShaders.mnum6.includes('float k = floor((Y0 - gy) / (DY * 8.0 / 6.0) + 0.5);'));
    assert.strictEqual(mShaders.mnum6.replace('(DY * 8.0 / 6.0)', 'DY'), mShaders.mnum, 'the numerals\' shader, with the marks further apart and nothing else');
    const t = build(DIESEL), L = layer(t, 'revScale');
    const at = (rpm) => L.uniforms(state(t, { rpm }), 0).u_cfg[2];
    assert.ok(Math.abs(at(738) - 0.738) < 1e-12 && Math.abs(at(4500) - 4.5) < 1e-12 && at(6000) === 6 && at(7500) === 6);
    assert.strictEqual(at(3000), 3, '3,000: the 3 is lit, its neighbours not yet');
});

test('a diesel: the dial\'s marks stand where its numerals do, and it is the same dial otherwise', () => {
    const lines = (src) => src.split('\n');
    const a = lines(mShaders.mgauge), b = lines(mShaders.mgauge6);
    const added = b.filter((l) => !a.includes(l)), gone = a.filter((l) => !b.includes(l));
    assert.deepStrictEqual(added, ['const float STEP = 8.0 / 6.0;', '  float k = floor(kf / STEP + 0.5);', '  float yk = Y0 - k * STEP * DY;',
        '  if (k < -0.5 || k > 6.5) dT = 1000.0;']);
    assert.deepStrictEqual(gone, ['  float k = floor(kf + 0.5);', '  float yk = Y0 - k * DY;', '  if (k < -0.5 || k > 8.5) dT = 1000.0;']);
    assert.strictEqual(b.length, a.length + 1, 'nothing else moved');
    /* the marker, the fill, the fields and the rim are told heights in ticks, as ever */
    for (const need of ['float ym = Y0 - u_val * DY;', 'float kf = (Y0 - p.y) / DY;', 'max(kf - u_zone.y, u_zone.x - kf) * DY']) {
        assert.ok(mShaders.mgauge6.includes(need), need);
    }
    /* the shader's marks, mark by mark, are the heights the numerals were laid out at */
    const step = 8.0 / 6.0;
    for (let j = 0; j <= 6; j++) {
        const y = M.tickY(j * step), kf = (M.SCALE.y0 - y) / M.SCALE.dy;
        assert.strictEqual(Math.floor(kf / step + 0.5), j);
        assert.ok(Math.abs((M.SCALE.y0 - j * step * M.SCALE.dy) - y) < 1e-9);
    }
    assert.ok(Math.abs(M.tickY(6 * step) - M.tickY(8)) < 1e-9, 'the 6 stands where a petrol\'s 8 does: the top of the dial');
});

test('a diesel: red from 4,500 and the limit at 5,000 unless set, the field and the flash following', () => {
    const zone = (cfg) => { const t = build(Object.assign({}, DIESEL, cfg)); return layer(t, 'revDial').uniforms(state(t, {})).u_zone; };
    const t = build(DIESEL);
    assert.deepStrictEqual([t.settings.rpmRedline, t.settings.rpmLimiter, t.settings.flashFromRpm, t.settings.scaleMaxRpm], [4500, 5000, 4850, 6000]);
    /* 4,500 of 6,000 is three quarters up the dial: tick 6 of 8 */
    const z = zone({});
    assert.ok(Math.abs(z[0] - 6.09) < 1e-9 && z[1] > 7.9 && z[1] <= 8, 'red from just past the redline to the top');
    assert.ok(z[2] < z[3] && z[3] < z[0], 'the amber field ends before the red starts');
    assert.ok(Math.abs(zone({ rpmRedline: 5000 })[0] - (5000 / 750 + 0.09)) < 1e-9, 'it moves with the setting');
    /* as the app sends them: "From the car" is the engine's own */
    assert.deepStrictEqual(zone({ rpmRedline: 'auto', rpmLimiter: 'auto', scaleMaxRpm: '8000' }), z);
    /* a petrol's figure, left in the settings, is no diesel's redline */
    assert.deepStrictEqual(zone({ rpmRedline: '7000', rpmLimiter: '7250' }), z);
    /* the limiter: the dial's band and the screen's edges flash from 4,850, full at 5,000 */
    const lim = (rpm) => state(t, { rpm }).limiter;
    assert.deepStrictEqual([lim(4000), lim(4850), lim(5000), lim(5400)], [0, 0, 1, 1]);
    assert.ok(lim(4925) > 0.49 && lim(4925) < 0.51);
    assert.strictEqual(layer(t, 'revDial').uniforms(state(t, { rpm: 5000 })).u_warn, 1);
    assert.strictEqual(layer(t, 'revDial').uniforms(state(t, { rpm: 4000 })).u_warn, 0);
    /* a petrol at the same revs is nowhere near its own */
    const p = build();
    assert.strictEqual(state(p, { rpm: 5000 }).limiter, 0);
    assert.strictEqual(layer(p, 'revDial').uniforms(state(p, { rpm: 5000 })).u_warn, 0);
});

test('a diesel: every layer is given what its shader declares, finite, and no readout moves onto a picture', () => {
    const BUILT_IN = ['u_size', 'u_time', 'u_keep', 'u_atlas', 'u_atlasSize'];
    for (const cfg of [{ mFixture: true, revFlash: 'both', clock12: true }, { style: 'mplus', units: 'metric', mPanel: 'mode' },
                       { centre: 'waze', centreSize: 'more' }, { style: 'mplus', centre: 'map', centreSize: 'most', mGear: 'rpm' }]) {
        const t = build(Object.assign({}, DIESEL, cfg));
        for (const rpm of [0, 780, 2600, 4480, 5200, 6400]) {
            const st = state(t, { rpm, speedKmh: 120, gear: 'D', driveMode: 'SPORT', fuelPct: 40, oilTempC: 100,
                                  rangeKm: 207, ambientC: 12.5, clock: { h: 12, m: 4 } }, { centre: CENTRES[1] });
            for (const L of t.layers) {
                const src = allShaders[L.shader];
                assert.ok(src, `${L.id}: no shader called ${L.shader}`);
                const u = L.uniforms(st, 0);
                if (!u) continue;
                const declared = [...src.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1]).filter((k) => !BUILT_IN.includes(k)).sort();
                assert.deepStrictEqual(Object.keys(u).sort(), declared, `${L.id} (${L.shader})`);
                for (const [k, v] of Object.entries(u)) {
                    for (const n of (typeof v === 'number' ? [v] : v)) assert.ok(Number.isFinite(n), `${L.id}.${k} = ${n}`);
                }
                if (!isText(L)) continue;
                const reveal = Track.revealOf(t);
                for (const q of quads(L, u)) {
                    for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h], [q.x + q.w / 2, q.y + q.h / 2]]) {
                        assert.strictEqual(reveal((x - M.ART.ox) / M.ART.s, (y - M.ART.oy) / M.ART.s), 0, `${L.id} over the picture`);
                    }
                }
            }
        }
        assert.ok(t.layers.length <= 64);
    }
});

/* ------------------------------------------------------------ the readouts */

test('both speeds are shown, each under its own unit', () => {
    const imp = build({ units: 'imperial' }), met = build({ units: 'metric' });
    const at = (t, speed) => state(t, {}, { speed });
    assert.strictEqual(says(imp, 'speed', at(imp, 60)), '60');
    assert.strictEqual(says(imp, 'speedUnit', at(imp, 60)), 'mph');
    assert.strictEqual(says(imp, 'speed2', at(imp, 60)), '97');
    assert.strictEqual(says(imp, 'speed2Unit', at(imp, 60)), 'km/h');
    assert.strictEqual(says(imp, 'speedTitle', at(imp, 60)), 'mph', 'the dial is titled in its own unit');
    assert.strictEqual(says(met, 'speed', at(met, 100)), '100');
    assert.strictEqual(says(met, 'speedUnit', at(met, 100)), 'km/h');
    assert.strictEqual(says(met, 'speed2', at(met, 100)), '62');
    assert.strictEqual(says(met, 'speed2Unit', at(met, 100)), 'mph');
    assert.strictEqual(says(met, 'speedTitle', at(met, 100)), 'km/h');
    assert.strictEqual(says(met, 'revTitle', at(met, 0)), '1/minx1000');
    /* a standing car reads 0 twice, as in the reference frame */
    assert.strictEqual(says(met, 'speed', at(met, 0)), '0');
    assert.strictEqual(says(met, 'speed2', at(met, 0)), '0');
    assert.strictEqual(says(met, 'speed', at(met, -2)), '0', 'never a negative speed');
});

test('the speed is flush right over its unit and keeps clear of the dial at three figures', () => {
    for (const units of ['imperial', 'metric']) {
        const t = build({ units }), L = layer(t, 'speed');
        const right = (n) => { const q = quads(L, L.uniforms(state(t, {}, { speed: n }), 0)); return q[q.length - 1].x + q[q.length - 1].w; };
        assert.ok(Math.abs(right(0) - right(330)) < 0.01 && Math.abs(right(0) - right(88)) < 0.01, 'one right edge for 0, 88 and 330');
        const q = quads(L, L.uniforms(state(t, {}, { speed: 330 }), 0))[0];
        for (let y = q.y; y <= q.y + q.h; y += 4) {
            const ay = (y - M.ART.oy) / M.ART.s;
            assert.ok(q.x > M.px(M.contourX(ay) + M.DIAL.conW) + 40, `330 starts at ${Math.round(q.x)}, on the dial`);
        }
    }
});

test('the gear is shown as the car names it', () => {
    const t = build();
    for (const g of ['P', 'R', 'N', 'D', 'D8', 'S5', 'M3', '1']) assert.strictEqual(says(t, 'gear', state(t, {}, { gear: g })), g);
    assert.strictEqual(says(t, 'gear', state(t, {})), 'P', 'P until the car says otherwise');
});

test('fuel and oil: lit from the foot to the reading, dark with no reading', () => {
    const t = build({ units: 'metric' });
    const fuel = (raw) => layer(t, 'fuelStrip').uniforms(state(t, raw));
    assert.deepStrictEqual([fuel({ fuelPct: 40 }).u_level, fuel({ fuelPct: 40 }).u_on], [0.4, 1]);
    assert.deepStrictEqual([fuel({}).u_level, fuel({}).u_on], [0, 0], 'no reading: nothing lit, not an empty tank');
    assert.strictEqual(fuel({ fuelPct: 100 }).u_level, 1);
    assert.strictEqual(fuel({}).u_side, 0);
    /* oil: the strip runs between its own end marks, in either unit */
    const oil = (cfg, c) => { const x = build(cfg); return layer(x, 'oilStrip').uniforms(state(x, c === null ? {} : { oilTempC: c })); };
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
    near(oil({ units: 'metric' }, 50).u_level, 0);
    near(oil({ units: 'metric' }, 100).u_level, 0.5);
    near(oil({ units: 'metric' }, 150).u_level, 1);
    near(oil({ units: 'imperial' }, (120 - 32) / 1.8).u_level, 0);          /* 120 F */
    near(oil({ units: 'imperial' }, (210 - 32) / 1.8).u_level, 0.5);        /* 210 F */
    near(oil({ units: 'imperial' }, (300 - 32) / 1.8).u_level, 1);          /* 300 F */
    assert.strictEqual(oil({ units: 'metric' }, 20).u_level, 0, 'a cold engine reads the foot, not below it');
    assert.strictEqual(oil({ units: 'metric' }, 190).u_level, 1);
    assert.strictEqual(oil({ units: 'metric' }, null).u_on, 0);
    assert.strictEqual(oil({ units: 'metric' }, 100).u_side, 1, 'the oil strip is the fuel strip mirrored');
    /* and the marks say what the strip measures */
    const marks = (cfg) => { const x = build(cfg); return says(x, 'oilLabels', state(x, {})); };
    assert.strictEqual(marks({ units: 'metric' }), '15010050');
    assert.strictEqual(marks({ units: 'imperial' }), '300210120');
    const unit = (cfg) => { const x = build(cfg); return says(x, 'oilUnit', state(x, {})); };
    assert.deepStrictEqual([unit({ units: 'metric' }), unit({ units: 'imperial' })], ['°C', '°F']);
    assert.strictEqual(says(t, 'fuelLabels', state(t, {})), '11/20');
});

test('the footer: clock, range and outside temperature, each only when the car has told us', () => {
    const t = build({ units: 'metric', clock12: true });
    const full = state(t, { rangeKm: 207, ambientC: 12.5, clock: { h: 12, m: 4 } });
    assert.strictEqual(says(t, 'clock', full), '12:04');
    assert.strictEqual(says(t, 'clockHalf', full), 'pm');
    assert.strictEqual(says(t, 'range', full), '207');
    assert.strictEqual(says(t, 'rangeUnit', full), 'km');
    assert.strictEqual(says(t, 'ambient', full), '+12.5');
    assert.strictEqual(says(t, 'ambientUnit', full), '°C');
    assert.strictEqual(says(t, 'ambient', state(t, { ambientC: -3.5 })), '-3.5', 'frost keeps its own sign');
    const none = state(t, {});
    for (const id of ['clock', 'clockHalf', 'range', 'rangeUnit', 'rangeIcon', 'ambient', 'ambientUnit']) {
        assert.strictEqual(layer(t, id).uniforms(none, 0), null, id + ' is dark with no reading');
    }
    /* am / pm follows the figures, however many there are */
    for (const clock of [{ h: 9, m: 41 }, { h: 12, m: 4 }, { h: 0, m: 0 }, { h: 23, m: 59 }]) {
        const st = state(t, { clock });
        const C = layer(t, 'clock'), H = layer(t, 'clockHalf');
        const cq = quads(C, C.uniforms(st, 0)), hq = quads(H, H.uniforms(st, 0));
        const gap = hq[0].x - (cq[cq.length - 1].x + cq[cq.length - 1].w);
        assert.ok(gap > -6 && gap < 14, `"${says(t, 'clock', st)} ${says(t, 'clockHalf', st)}": gap ${gap}`);
        assert.strictEqual(says(t, 'clockHalf', st), clock.h < 12 ? 'am' : 'pm');
    }
    /* the 24-hour clock has no am / pm */
    const t24 = build({ units: 'imperial' }), st24 = state(t24, { rangeKm: 207, ambientC: 12.5, clock: { h: 15, m: 7 } });
    assert.strictEqual(says(t24, 'clock', st24), '15:07');
    assert.strictEqual(layer(t24, 'clockHalf').uniforms(st24, 0), null);
    assert.strictEqual(says(t24, 'range', st24), '129');
    assert.strictEqual(says(t24, 'rangeUnit', st24), 'mi');
    assert.strictEqual(says(t24, 'ambient', st24), '+55');
    assert.strictEqual(says(t24, 'ambientUnit', st24), '°F');
});

test('the footer\'s three places: each can hold any reading, with its unit and its name, or nothing', () => {
    assert.deepStrictEqual(Track.FOOT_KINDS, ['time', 'range', 'economy', 'outside', 'iat', 'rpm', 'oil', 'coolant', 'boost', 'volts',
        'erange', 'charge', 'hvtemp', 'off']);
    const RAW = { evRangeKm: 43, socPct: 78, rpm: 2456, speedKmh: 80, gear: '4', oilTempC: 104, coolantC: 91, boostBar: 0.86, rangeKm: 259, ambientC: 3,
                  clock: { h: 15, m: 7 }, avgL100: 9.6, iatC: 38, batteryV: 14.13 };
    /* what each reading says: [figures, unit, the word before it] - imperial, then metric */
    const WANT = {
        time: [['3:07', 'pm', null], ['3:07', 'pm', null]],
        range: [['161', 'mi', null], ['259', 'km', null]],
        economy: [['24.5', 'mpg', 'AVG'], ['9.6', 'l/100km', null]],
        outside: [['+37', '°F', null], ['+3.0', '°C', null]],
        iat: [['100', '°F', 'IAT'], ['38', '°C', 'IAT']],
        rpm: [['2460', 'rpm', null], ['2460', 'rpm', null]],
        oil: [['219', '°F', 'OIL'], ['104', '°C', 'OIL']],
        coolant: [['196', '°F', 'WATER'], ['91', '°C', 'WATER']],
        boost: [['12.5', 'psi', 'BOOST'], ['0.86', 'bar', 'BOOST']],
        volts: [['14.1', 'v', 'BATT'], ['14.1', 'v', 'BATT']],
        /* a plug-in hybrid's (General: Electric range) */
        erange: [['27', 'mi', 'EV'], ['43', 'km', 'EV']]
    };
    const HOME = { L: 'time', M: 'range', R: 'outside' };
    for (const style of M_STYLES) for (const [ui, units] of [[0, 'imperial'], [1, 'metric']]) {
        for (const place of ['L', 'M', 'R']) for (const kind of Object.keys(WANT)) {
            if (kind === HOME[place]) continue;             /* the frame's own: the test above */
            const t = build({ style, units, clock12: true, electric: 'hybrid', ['foot' + place]: kind });
            const st = state(t, RAW);
            const id = 'slot' + place, [fig, unit, tag] = WANT[kind][ui];
            assert.strictEqual(says(t, id, st), fig, `${style} ${units} ${place} ${kind}`);
            assert.strictEqual(says(t, id + 'Unit', st), unit, `${style} ${units} ${place} ${kind}: unit`);
            if (tag) assert.strictEqual(says(t, id + 'Tag', st), tag, `${place} ${kind}: the word before it`);
            else assert.strictEqual(layer(t, id + 'Tag'), undefined);
            assert.strictEqual(!!layer(t, id + 'Icon'), kind === 'range', 'the pump stands by the range alone');
            /* the frame's own layers for that place are gone, the other two places are as the frame has them */
            const own = { L: ['clock', 'clockHalf'], M: ['rangeIcon', 'range', 'rangeUnit'], R: ['ambient', 'ambientUnit'] };
            own[place].forEach((x) => assert.strictEqual(layer(t, x), undefined, x));
            Object.keys(own).filter((p) => p !== place).forEach((p) => own[p].forEach((x) => assert.ok(layer(t, x), x)));
            /* set in order with room between: [word] figures unit, none on another */
            const parts = [id + 'Icon', id + 'Tag', id, id + 'Unit'].map((x) => layer(t, x)).filter(Boolean)
                .map((L) => { const u = L.uniforms(st, 0), q = quads(L, u); return [q[0].x, q[q.length - 1].x + q[q.length - 1].w, L.id]; })
                .sort((a, b) => a[0] - b[0]);
            for (let i = 1; i < parts.length; i++) {
                /* (a glyph's box is wider than its ink: boxes may touch, the ink does not) */
                assert.ok(parts[i][0] - parts[i - 1][1] > -9, `${parts[i - 1][2]} runs into ${parts[i][2]} (${style} ${units} ${place} ${kind})`);
                assert.ok(parts[i][0] - parts[i - 1][1] < 26, `${parts[i - 1][2]} and ${parts[i][2]} have drifted apart`);
            }
            if (tag) assert.strictEqual(parts[0][2], id + 'Tag', 'the word comes first');
            assert.strictEqual(parts[parts.length - 1][2], id + 'Unit', 'the unit last');
        }
    }
    /* the drive battery's charge: a figure under its name, in per cent, with no unit after it */
    for (const style of M_STYLES) {
        const t = build({ style, electric: 'bev', footR: 'charge' });
        assert.deepStrictEqual([says(t, 'slotR', state(t, RAW)), says(t, 'slotRTag', state(t, RAW)), says(t, 'slotRUnit', state(t, RAW))], ['78', 'CHARGE', null]);
        /* an electric car: the frame's own range place carries the electric range, without the fuel pump */
        const st = state(t, RAW);
        assert.strictEqual(says(t, 'range', st), '27');
        assert.strictEqual(layer(t, 'rangeIcon').uniforms(st, 0), null);
        /* with the setting off these places show dashes: nothing of a battery is read as if it were there */
        const off = build({ style, footR: 'erange' });
        assert.strictEqual(says(off, 'slotR', state(off, RAW)), '--');
        assert.strictEqual(says(off, 'range', state(off, RAW)), '161');
    }
});

test('a place left empty draws nothing; a named reading with no value shows dashes, the others go dark', () => {
    for (const style of M_STYLES) {
        const t = build({ style, footL: 'off', footM: 'off', footR: 'off', mPanel: 'off' });
        assert.deepStrictEqual(t.layers.filter((L) => /^(slot|clock|range|ambient|footPanel|drive)/.test(L.id)).map((L) => L.id), [],
            'an empty footer: nothing under the rails but the M');
        assert.deepStrictEqual([t.settings.footL, t.settings.footM, t.settings.footR], ['off', 'off', 'off']);
        /* nothing to say: the car is silent */
        const q = build({ style, units: 'imperial', footL: 'iat', footM: 'economy', footR: 'rpm' });
        const none = state(q, {});
        assert.strictEqual(says(q, 'slotL', none), '--', 'IAT without BeeM-Flash: dashes, under its name');
        assert.strictEqual(says(q, 'slotLTag', none), 'IAT');
        assert.strictEqual(says(q, 'slotM', none), '--');
        assert.strictEqual(layer(q, 'slotR').uniforms(none, 0), null, 'an unnamed reading with no value is dark');
        assert.strictEqual(layer(q, 'slotRUnit').uniforms(none, 0), null);
        /* anything not on the list is the frame's own */
        const d = build({ style, footL: 'nonsense', footM: null, footR: undefined });
        assert.deepStrictEqual([d.settings.footL, d.settings.footM, d.settings.footR], ['time', 'range', 'outside']);
    }
});

test('the footer\'s places keep to themselves: inside their boxes, the panel and each other left alone, at any value', () => {
    const EXTREMES = [
        { rpm: 0, oilTempC: -40, coolantC: -40, boostBar: 0, rangeKm: 0, ambientC: -40, clock: { h: 0, m: 0 }, avgL100: 0.6, iatC: -40, batteryV: 8.0 },
        { rpm: 8990, oilTempC: 170, coolantC: 130, boostBar: 2.99, rangeKm: 1999, ambientC: 55.5, clock: { h: 23, m: 59 }, avgL100: 98.9, iatC: 150, batteryV: 16.4 },
        { rpm: 7777, oilTempC: 111, coolantC: 111, boostBar: 1.11, rangeKm: 1111, ambientC: -11.5, clock: { h: 11, m: 11 }, avgL100: 2.4, iatC: 111, batteryV: 11.1 }
    ];
    const kinds = Track.FOOT_KINDS.filter((k) => k !== 'off');
    let checked = 0;
    for (const style of M_STYLES) for (const units of ['imperial', 'metric']) for (const kind of kinds) {
        const t = build({ style, units, clock12: true, mFixture: true, footL: kind, footM: kind, footR: kind });
        const panel = layer(t, 'footPanel'), mark = layer(t, 'mMark');
        for (const raw of EXTREMES) {
            const st = state(t, raw);
            const ink = { L: [], M: [], R: [] };
            for (const L of t.layers.filter(isText)) {
                const place = /^slot([LMR])/.exec(L.id) || (/^clock/.test(L.id) && [0, 'L']) || (/^range/.test(L.id) && [0, 'M']) ||
                    (/^ambient/.test(L.id) && [0, 'R']);
                if (!place) continue;
                const u = L.uniforms(st, 0);
                if (!u) continue;
                assert.ok(countOf(L, u) <= Text.MAX_GLYPHS, L.id);
                for (const q of quads(L, u)) {
                    checked++;
                    assert.ok(q.x >= L.x - 1 && q.y >= L.y - 1 && q.x + q.w <= L.x + L.w + 1 && q.y + q.h <= L.y + L.h + 1,
                        `${style}/${L.id} (${units}, ${kind}): a glyph outside its ${L.w}x${L.h} layer`);
                    assert.ok(q.x >= 0 && q.x + q.w <= Panel.PANEL_WIDTH && q.y + q.h <= Panel.BOTTOM_CUT, L.id + ' off the panel or past the cut');
                    assert.ok(!hits(q, panel), `${L.id} on the footer's panel`);
                    assert.ok(!hits(q, mark) || q.y > mark.y + mark.h - 6, `${L.id} on the M`);
                    ink[place[1]].push(q);
                }
            }
            const span = (qs) => [Math.min(...qs.map((q) => q.x)), Math.max(...qs.map((q) => q.x + q.w))];
            if (ink.L.length && ink.M.length) assert.ok(span(ink.L)[1] <= span(ink.M)[0] + 8, `${kind}: the left place runs into the middle one (${units})`);
            if (ink.M.length && ink.R.length) assert.ok(span(ink.M)[1] < span(ink.R)[0], `${kind}: the middle place runs into the right one`);
        }
    }
    assert.ok(checked > 2500, 'glyphs checked: ' + checked);
    /* and with every place holding a named reading the styles are still inside the layer budget */
    for (const style of M_STYLES) {
        const t = build({ style, mFixture: true, holiday: true, revFlash: 'both', intro: true, clock12: true,
                          footL: 'boost', footM: 'economy', footR: 'coolant', bottomExtra: 'hide' });
        assert.ok(t.layers.length <= 64, `${style}: ${t.layers.length} layers`);
        assert.strictEqual(new Set(t.layers.map((L) => L.id)).size, t.layers.length, 'no two layers share a name');
    }
});

test('the readings a footer can show: figures only, in the units chosen, dashes when the car is not saying', () => {
    const P = PROFILE;
    const imp = State.present({ rpm: 2456.4, oilTempC: 104, coolantC: 91, boostBar: 0.86, avgL100: 9.6, iatC: 38, batteryV: 14.13 }, P, { units: 'imperial' }).info;
    assert.deepStrictEqual(imp, { rpm: '2460', economy: '24.5', iat: '100', oil: '219', coolant: '196', boost: '12.5', volts: '14.1', erange: '--', charge: '--', hvtemp: '--' });
    const met = State.present({ rpm: 2456.4, oilTempC: 104, coolantC: 91, boostBar: 0.86, avgL100: 9.6, iatC: 38, batteryV: 14.13 }, P, { units: 'metric' }).info;
    assert.deepStrictEqual(met, { rpm: '2460', economy: '9.6', iat: '38', oil: '104', coolant: '91', boost: '0.86', volts: '14.1', erange: '--', charge: '--', hvtemp: '--' });
    const none = State.present({}, P, {}).info;
    Object.keys(none).forEach((k) => assert.strictEqual(none[k], '--', k));
    /* the trip computer's average, whatever unit the car shows it in, as l/100 km */
    const avg = (raw, unit) => Vehicle.averageL100({ consumptionAverage1BC1: raw, statusUnitOfMeasurementConsumptionBC: unit });
    assert.ok(Math.abs(avg(96, 1) - 9.6) < 1e-9);
    assert.ok(Math.abs(avg(96, 'VERBRAUCH_IN_L_S_100KM') - 9.6) < 1e-9);
    assert.ok(Math.abs(avg(245, 'VERBRAUCH_IN_MPG_US') - 235.215 / 24.5) < 1e-9, '24.5 mpg (US)');
    assert.ok(Math.abs(avg(294, 2) - 282.481 / 29.4) < 1e-9, '29.4 mpg (UK)');
    assert.ok(Math.abs(avg(104, 4) - 100 / 10.4) < 1e-9, '10.4 km/l');
    assert.strictEqual(avg(65535, 1), undefined, 'no value');
    assert.strictEqual(avg(0, 1), undefined);
    assert.strictEqual(avg(96, 7), undefined, 'a unit we cannot name is no figure at all');
    assert.strictEqual(avg(96, undefined), undefined);
    /* through the reader: held (the trip computer is polled every few seconds), and US mpg back out */
    const r = Vehicle.createReader({});
    r.receive('de.bmw.infotainment.KombiIF', 'statusBordcomputerAverage',
        { consumptionAverage1BC1: 245, statusUnitOfMeasurementConsumptionBC: 'VERBRAUCH_IN_MPG_US' }, 1000);
    assert.strictEqual(State.present(r.raw(60000, 65), P, { units: 'imperial' }).info.economy, '24.5');
    assert.ok(Vehicle.SIGNALS['de.bmw.infotainment.KombiIF'].statusBordcomputerAverage, 'the app subscribes to it');
    /* the intake air and the battery come from another app's feed, and age out with it */
    r.setFeed('iatC', 41, 1000); r.setFeed('batteryV', 13.9, 1000);
    assert.deepStrictEqual([r.raw(1500, 65).iatC, r.raw(1500, 65).batteryV], [41, 13.9]);
    assert.deepStrictEqual([r.raw(9000, 65).iatC, r.raw(9000, 65).batteryV], [undefined, undefined], 'a feed that stops leaves dashes');
    r.setFeed('rpm', 9999, 9000);
    assert.notStrictEqual(r.raw(9100, 65).rpm, 9999, 'a feed cannot set anything else');
});

test('the footer\'s panel names the drive, the driving mode, or is left out', () => {
    const fig = (cfg, st) => { const t = build(cfg); return says(t, 'driveFig', state(t, {}, st)) + says(t, 'driveWord', state(t, {}, st)); };
    assert.strictEqual(fig({}), '4WD', 'as in the reference frame, by default');
    assert.strictEqual(fig({ mPanel: '2wd' }), '2WD');
    const mode = build({ mPanel: 'mode' });
    assert.ok(!mode.layers.some((L) => /^drive(Fig|Word)$/.test(L.id)));
    assert.strictEqual(layer(mode, 'driveMode').uniforms(state(mode, {}), 0), null, 'nothing until the car names a mode');
    const sp = state(mode, { driveMode: 'SPORT_PLUS' });
    assert.ok(sp.modeLabel && !/CORSA/.test(sp.modeLabel), 'BMW\'s own names, not Toro\'s');
    assert.strictEqual(says(mode, 'driveMode', sp), sp.modeLabel.replace(/ /g, ''));
    const off = build({ mPanel: 'off' });
    assert.ok(!off.layers.some((L) => /^(footPanel|drive)/.test(L.id)), 'no panel, nothing on it');
    assert.strictEqual(build({ mPanel: 'nonsense' }).settings.mPanel, '4wd');
});

test('the car\'s own lamps are never imitated: they exist only in the reference fixture', () => {
    const LAMPS = /^(lamp|car|limit)/;
    for (const cfg of [{}, { units: 'metric' }, { mPanel: 'mode' }, { holiday: true }, { revFlash: 'both' }]) {
        assert.deepStrictEqual(build(cfg).layers.filter((L) => LAMPS.test(L.id)).map((L) => L.id), []);
    }
    const fx = build({ mFixture: true });
    assert.deepStrictEqual(fx.layers.filter((L) => LAMPS.test(L.id)).map((L) => L.id).sort(),
        ['carBody', 'carEdge', 'carSeats', 'lampBelt', 'lampBrake', 'lampLights', 'limitSign', 'limitWord']);
    /* and the fixture adds nothing else */
    assert.deepStrictEqual(fx.layers.filter((L) => !LAMPS.test(L.id)).map((L) => L.id), build().layers.map((L) => L.id));
    /* no logo of anyone's but the M mark the style is named for */
    assert.ok(!build().layers.some((L) => /brand|logo|roundel/i.test(L.id)));
});

/* --------------------------------------------------------- the centre */

test('the centre shows the right thing in each mode, and nothing of ours over a picture', () => {
    const t = build();
    const on = (id, centre) => layer(t, id).uniforms(state(t, {}, { centre })) !== null;
    for (const id of ['turnArrow', 'turnDist', 'turnSay']) {
        assert.ok(!on(id, CENTRES[0]), id + ': nothing with nothing to show');
        assert.ok(!on(id, CENTRES[1]), id + ': nothing over the map');
        assert.ok(!on(id, CENTRES[2]), id + ': nothing over the camera');
        assert.ok(on(id, CENTRES[3]), id + ': the turn card');
    }
    /* the card stands in the black field the window would open on */
    for (const id of ['turnArrow', 'turnDist', 'turnSay']) {
        const L = layer(t, id), w = t.window;
        assert.ok(L.x >= w.x && L.y >= w.y && L.x + L.w <= w.x + w.w && L.y + L.h <= w.y + w.h, id + ' inside the window');
    }
    const st = state(t, {}, { centre: CENTRES[4] });
    assert.strictEqual(says(t, 'turnDist', st), '1500ft');
    assert.strictEqual(says(t, 'turnSay', st), 'SHARPRIGHT');
});

test('maneuvers read as the right arrow and words', () => {
    const say = (m) => Track.turnOf(m).say;
    assert.strictEqual(say(TURNS[0]), 'TURN LEFT');
    assert.strictEqual(say(TURNS[1]), 'SHARP RIGHT');
    assert.strictEqual(Track.turnOf(TURNS[2]).kind, 1);
    assert.strictEqual(say(TURNS[3]), 'EXIT 3');
    assert.strictEqual(say(TURNS[4]), 'KEEP RIGHT');
    assert.strictEqual(Track.turnOf(TURNS[5]).kind, 3);
    assert.ok(Track.turnOf(TURNS[0]).angle < 0 && Track.turnOf(TURNS[1]).angle > 0, 'left is negative');
    for (const m of TURNS) assert.ok(say(m).replace(/\s/g, '').length <= 12, say(m));
    assert.strictEqual(Track.turnOf(null), null);
});

test('the holiday dressing keeps off the M style\'s instruments', () => {
    const t = build({ holiday: true, mFixture: true, clock12: true });
    const st = state(t, { rpm: 3000, speedKmh: 330, gear: 'M8', fuelPct: 40, oilTempC: 100, rangeKm: 999,
                          ambientC: -22.5, clock: { h: 23, m: 59 } });
    const tree = layer(t, 'tree');
    for (const L of t.layers) {
        if (/^(back|flash|snow\d|tree)$/.test(L.id)) continue;
        const ink = isText(L) ? (L.uniforms(st, 0) ? quads(L, L.uniforms(st, 0)) : []) : [L];
        assert.ok(!ink.some((r) => hits(r, tree)), L.id + ' behind the tree');
    }
    for (const z of Panel.keepClear('x3m40i')) assert.ok(!hits(tree, z), 'the tree under ' + z.name);
    /* the snow falls down the sides, outside the plates and the strips, and
       keeps off whatever is read there: each such layer is inside a box
       the snow leaves clear */
    for (const id of ['snow0', 'snow1']) {
        const S = layer(t, id), clear = S.uniforms().u_clear, boxes = [];
        assert.strictEqual(clear.length, 16, 'four boxes');
        for (let i = 0; i < 16; i += 4) if (clear[i + 2] > 0) boxes.push(clear.slice(i, i + 4));
        for (const L of t.layers.filter((x) => /^plates|Strip$|^speed$|^gear$/.test(x.id))) assert.ok(!hits(L, S), `${L.id} under ${id}`);
        const read = t.layers.filter((x) => t.places.clearOf.test(x.id) && hits(x, S));
        assert.ok(read.length >= 2, id + ' has instruments to keep off');
        for (const L of read) {
            /* the part of it under the snow */
            const x0 = Math.max(L.x, S.x) - S.x, y0 = Math.max(L.y, S.y) - S.y;
            const x1 = Math.min(L.x + L.w, S.x + S.w) - S.x, y1 = Math.min(L.y + L.h, S.y + S.h) - S.y;
            assert.ok(boxes.some((b) => x0 >= b[0] - 0.5 && y0 >= b[1] - 0.5 && x1 <= b[0] + b[2] + 0.5 && y1 <= b[1] + b[3] + 0.5),
                `${L.id} is kept clear by ${id}`);
        }
    }
});

/* ------------------------------------------------------- M Sport Plus */

const PLUS = M.PLUS;
const plusBuild = (cfg) => build(Object.assign({ style: 'mplus' }, cfg));
const artOfPanel = (x, y) => [(x - M.ART.ox) / M.ART.s, (y - M.ART.oy) / M.ART.s];
const BUSY = { rpm: 3000, speedKmh: 330, gear: 'M8', driveMode: 'SPORT_PLUS', fuelPct: 40, oilTempC: 100, rangeKm: 999,
               ambientC: -22.5, clock: { h: 23, m: 59 } };

test('M Sport Plus is M Sport with another middle, and nothing else', () => {
    /* the middle: the glass (its window), the plates, the rails' inner ends, the centre lines */
    const MIDDLE = /^(back|plates[LCR]|rails|centreLines)$/;
    for (const cfg of [{ units: 'metric', mFixture: true, clock12: true }, { units: 'imperial', mPanel: 'mode', revFlash: 'both' }]) {
        /* numerals as the car has them in both, so only the middle can differ */
        const a = build(Object.assign({ mPop: 'off' }, cfg)), b = plusBuild(Object.assign({ mPop: 'off' }, cfg));
        const rest = (t) => t.layers.filter((L) => !MIDDLE.test(L.id));
        assert.deepStrictEqual(rest(b).map((L) => L.id), rest(a).map((L) => L.id), 'the same layers, in the same order');
        assert.deepStrictEqual(a.layers.filter((L) => MIDDLE.test(L.id)).map((L) => L.id),
            ['back', 'platesL', 'platesR', 'rails', 'centreLines']);
        assert.deepStrictEqual(b.layers.filter((L) => MIDDLE.test(L.id)).map((L) => L.id),
            ['back', 'platesL', 'platesC', 'platesR', 'rails'], 'no centre lines: the rails meet instead');
        for (const centre of [CENTRES[0], CENTRES[1], CENTRES[4]]) {
            const sa = state(a, BUSY, { centre, limiter: 1 }), sb = state(b, BUSY, { centre, limiter: 1 });
            rest(a).forEach((L, i) => {
                const N = rest(b)[i];
                assert.deepStrictEqual([N.x, N.y, N.w, N.h, N.z, N.shader], [L.x, L.y, L.w, L.h, L.z, L.shader], L.id + ' is where it was');
                assert.deepStrictEqual(N.uniforms(sb, 0), L.uniforms(sa, 0), L.id + ' shows what it showed');
            });
        }
    }
    /* and M Sport itself draws with the shaders it always had */
    const shadersOf = (t) => [...new Set(t.layers.map((L) => L.shader))].sort();
    assert.deepStrictEqual(shadersOf(build({ revFlash: 'both', mFixture: true })),
        ['flash', 'mback', 'mbadge', 'mdiag', 'mfoot', 'mgauge', 'mnum', 'mplatesL', 'mplatesR', 'mrails', 'mstrip', 'text', 'tturn']);
    assert.deepStrictEqual(shadersOf(plusBuild({ revFlash: 'both' })),
        ['flash', 'mfoot', 'mgauge', 'mnum', 'mpback', 'mpcentre', 'mprails', 'mpsideL', 'mpsideR', 'mstrip', 'text', 'tturn']);
});

test('Plus plates: clockwise convex slabs on one lean, apart from each other, inside the dials', () => {
    const ids = Object.keys(PLUS.PLATES);
    assert.deepStrictEqual(ids, ['A', 'B', 'B2', 'C', 'D', 'F', 'E']);
    for (const id of ids) {
        const P = PLUS.PLATES[id], k = P.v.length, f = outline(P.v, P.r, true);
        const cx = P.v.reduce((a, v) => a + v[0], 0) / k, cy = P.v.reduce((a, v) => a + v[1], 0) / k;
        assert.ok(f([cx, cy]) < -10 && M.convexDist(P.v, cx, cy) < -10, `${id}: clockwise, its middle inside`);
        for (let i = 0; i < k; i++) {
            const a = P.v[(i + k - 1) % k], b = P.v[i], c = P.v[(i + 1) % k];
            assert.ok((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0, `${id}: corner ${i} is convex`);
            /* every edge is level or on the one lean (the foot of the left plate follows its dial instead) */
            const dx = c[0] - b[0], dy = c[1] - b[1];
            if (Math.abs(dy) > 1 && !(id === 'A' && i === 2)) {
                assert.ok(Math.abs(Math.abs(dx / dy) - PLUS.slope) < 0.012, `${id} edge ${i}: ${dx / dy}`);
            }
            /* the shader's outline and the plain sums agree, corner by corner */
            const u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]];
            const cos = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]));
            const want = P.r[i] * (1 / Math.sin(Math.acos(cos) / 2) - 1);
            assert.ok(Math.abs(f(b) - want) < 0.05 && Math.abs(M.roundDist(P.v, P.r, b[0], b[1]) - want) < 1e-9, `${id} corner ${i}`);
        }
        /* inside the dials: clear of both fine contours, under the top line, over the rails */
        for (const v of P.v) {
            assert.ok(v[0] > M.contourX(v[1]) + 20 && v[0] < M.mirror(M.contourX(v[1])) - 20, `${id} keeps off the dials`);
            assert.ok(v[1] >= PLUS.top && v[1] <= PLUS.bottom && PLUS.top > M.DIAL.topY1 + 20 && PLUS.bottom < M.DIAL.railTop - 20);
        }
    }
    /* no two plates share a point; the black between neighbours is at least a few units */
    for (let y = 100; y < 475; y += 2.5) {
        for (let x = 290; x < 1500; x += 2.5) {
            const near = ids.filter((id) => M.roundDist(PLUS.PLATES[id].v, PLUS.PLATES[id].r, x, y) < 2.5);
            assert.ok(near.length <= 1, `plates ${near} meet at ${x}, ${y}`);
        }
    }
    /* the shaders are written from these numbers */
    for (const [sh, set] of [['mpsideL', ['A', 'B', 'B2']], ['mpcentre', ['C']], ['mpsideR', ['D', 'F', 'E']]]) {
        for (const id of set) assert.ok(mShaders[sh].includes(mShaders.chain('pp' + id, PLUS.PLATES[id].v, PLUS.PLATES[id].r, true)), sh + ' ' + id);
    }
    /* and every plate is inside its layer */
    const t = plusBuild();
    for (const [lid, set] of [['platesL', ['A', 'B', 'B2']], ['platesC', ['C']], ['platesR', ['D', 'F', 'E']]]) {
        const L = layer(t, lid);
        for (const id of set) for (const v of PLUS.PLATES[id].v) {
            assert.ok(M.px(v[0]) >= L.x && M.px(v[0]) <= L.x + L.w && M.py(v[1]) >= L.y && M.py(v[1]) <= L.y + L.h, `${id} in ${lid}`);
        }
    }
});

test('Plus lattice and stripes: fine lines on the plates\' lean, two bands on the centre plate', () => {
    for (const [i, L] of PLUS.LATTICE.entries()) {
        const dx = L[2] - L[0], dy = L[3] - L[1];
        assert.ok(dy === 0 || Math.abs(Math.abs(dx / dy) - PLUS.slope) < 0.012, `line ${i} is level or on the lean`);
        assert.ok(Math.min(L[1], L[3]) >= PLUS.top - 0.01 && Math.max(L[1], L[3]) <= PLUS.bottom + 0.01, `line ${i} within the plates' height`);
        /* a line starts and stops on a plate (it is not seen in the black between) */
        for (const [x, y] of [[L[0], L[1]], [L[2], L[3]]]) {
            const d = Math.min(...Object.values(PLUS.PLATES).map((P) => M.roundDist(P.v, P.r, x, y)));
            assert.ok(d < 4, `line ${i} ends ${d.toFixed(1)} from a plate`);
        }
    }
    const num = (v) => (v % 1 ? String(v) : v + '.0');
    for (const sh of ['mpsideL', 'mpcentre', 'mpsideR']) {
        for (const L of PLUS.LATTICE) {
            assert.ok(mShaders[sh].includes(`sdSegment(p, vec2(${num(L[0])}, ${num(L[1])}), vec2(${num(L[2])}, ${num(L[3])}), 0.0)`),
                sh + ' draws every line');
        }
    }
    /* the stripes: equal bands with a band of plate between, inside the centre plate at their strongest */
    const S = PLUS.STRIPES, C = PLUS.PLATES.C;
    const wb = S.blue[1] - S.blue[0], wr = S.red[1] - S.red[0], gap = S.red[0] - S.blue[1];
    assert.ok(Math.abs(wb - wr) < 1 && Math.abs(gap - wb) < 3, 'blue, plate, red: three bands alike');
    for (const b of [S.blue[0], S.blue[1], S.red[0], S.red[1]]) {
        assert.ok(M.roundDist(C.v, C.r, b - PLUS.slope * S.peak, S.peak) < -10, 'a stripe edge at its strongest is on the centre plate');
    }
    assert.ok(S.rise < PLUS.top && S.peak > PLUS.top && S.gone < PLUS.bottom, 'already showing at the plate\'s top, gone before its foot');
    /* they stand back for a turn card, which is read over them */
    const t = plusBuild(), Cn = layer(t, 'platesC');
    assert.strictEqual(Cn.uniforms(state(t, {}, { centre: CENTRES[0] })).u_calm, 0);
    assert.strictEqual(Cn.uniforms(state(t, {}, { centre: CENTRES[1] })).u_calm, 0);
    assert.strictEqual(Cn.uniforms(state(t, {}, { centre: CENTRES[3] })).u_calm, 1);
    assert.match(mShaders.mpcentre, /lit \*= 1\.0 - 0\.8 \* u_calm;/);
    for (const id of ['turnArrow', 'turnDist', 'turnSay']) {
        const L = layer(t, id), w = t.window;
        assert.ok(L.x >= w.x && L.y >= w.y && L.x + L.w <= w.x + w.w && L.y + L.h <= w.y + w.h, id + ' on the centre plate');
    }
});

test('Plus rails meet in the middle, each cut on the lean', () => {
    const R = PLUS.RAILS;
    assert.ok(Math.abs((R.blueEnd + R.redStart) / 2 - M.AX) < 0.5, 'the gap is about the dials\' axis');
    assert.ok(R.redStart - R.blueEnd > 60 && R.redStart - R.blueEnd < 140);
    assert.ok(R.y > M.DIAL.railTop && R.y < M.DIAL.railBottom);
    assert.ok(mShaders.mprails.includes(`float endB = ${R.blueEnd} - (p.y - ${R.y}) * ${PLUS.slope};`));
    assert.ok(mShaders.mprails.includes(`float endR = ${R.redStart} + (p.y - ${R.y}) * ${PLUS.slope};`));
    /* everything else about the rails is M Sport's own source */
    const strip = (src) => src.split('\n').filter((l) => !/float end[BR] =/.test(l)).join('\n');
    assert.strictEqual(strip(mShaders.mprails), strip(mShaders.mrails));
});

test('Plus window: a band across the plates - the picture up through them on a curve with no corner, wide, soft at both ends', () => {
    const W = PLUS.WINDOW, C = PLUS.PLATES.C, S = PLUS.slope;
    /* the curve: level at both ends, and its slope too; half-way at half */
    assert.deepStrictEqual([M.smoother(-1), M.smoother(0), M.smoother(0.5), M.smoother(1), M.smoother(2)], [0, 0, 0.5, 1, 1]);
    for (const e of [1e-3, 1e-2]) {
        assert.ok(M.smoother(e) < 12 * e * e * e && 1 - M.smoother(1 - e) < 12 * e * e * e, 'no corner where the fade starts or ends');
    }
    for (let t = 0; t < 1; t += 0.01) assert.ok(M.smoother(t + 0.01) > M.smoother(t), 'it only ever rises');

    /* down: in from the plates' top and from their foot, the same curve */
    const x = 950;
    for (const d of [-4, 0, W.insetV, W.insetV + W.featherV / 4, W.insetV + W.featherV / 2, W.insetV + W.featherV, 90]) {
        const want = M.smoother((d - W.insetV) / W.featherV);
        assert.ok(Math.abs(Track.plusRevealAt(x - S * d, PLUS.top + d) - want) < 1e-9, `${d} in from the top`);
        assert.ok(Math.abs(Track.plusRevealAt(x + S * d, PLUS.bottom - d) - want) < 1e-9, `${d} in from the foot`);
    }
    assert.strictEqual(Track.plusRevealAt(M.AX, 280), 1, 'wide open in the middle');

    /* the left end: nothing left of the owner's line, soft over featherL (level) to its right */
    const y = 290, L = M.plusLeftLine(), xl = L[0] * y + L[1];
    assert.ok(Math.abs(M.at(L, W.leftLine[0][1]) - W.leftLine[0][0]) < 1e-9 && Math.abs(M.at(L, W.leftLine[1][1]) - W.leftLine[1][0]) < 1e-9);
    assert.ok(Math.abs(L[0]) < S, 'steeper than the plates\' lean: it keeps clear of the two speeds');
    assert.strictEqual(Track.plusRevealAt(xl - 1, y), 0);
    assert.ok(Math.abs(Track.plusRevealAt(xl + W.featherL / 2, y) - 0.5) < 1e-9, 'half-way in at half the fade');
    assert.strictEqual(Track.plusRevealAt(xl + W.featherL + 1, y), 1);
    for (let x1 = xl; x1 < xl + W.featherL; x1 += 6) assert.ok(M.plusBand(x1 + 6, y) >= M.plusBand(x1, y), 'the left end only rises');
    /* the right end, along the plates' own lean (u = x + slope * y): all of it up to right - featherR,
       then soft - and long - out to `right` */
    const band = (u) => M.plusBand(u - S * y, y);
    assert.strictEqual(band(W.right - W.featherR - 1), 1);
    assert.ok(Math.abs(band(W.right - W.featherR / 2) - 0.5) < 1e-9);
    assert.strictEqual(band(W.right + 1), 0);
    for (let u = W.right - W.featherR; u < W.right; u += 7) assert.ok(band(u + 7) <= band(u), 'the right end only falls');
    /* "more view, and blend in more on the left and the right": both ends fade far more gently than the
       first window's 40 units, and the picture is wider than the 484 its outline was */
    assert.ok(W.featherL >= 90 && W.featherR >= 200, 'long fades at both ends');
    assert.ok((W.right - W.featherR / 2 - S * y) - (xl + W.featherL / 2) > 484, 'wider between its half-strength lines');
    /* it runs on, fainter, through the two plates by the gear */
    assert.deepStrictEqual(W.plates, ['C', 'D', 'E']);
    assert.ok(Track.plusRevealAt(1290, 160) > 0.2 && Track.plusRevealAt(1290, 160) < 0.6, 'in the plate above the gear');
    assert.ok(Track.plusRevealAt(1200, 400) > 0.05 && Track.plusRevealAt(1200, 400) < 0.4, 'in the plate below it');
    assert.ok(Track.plusRevealAt(1225, 150) > 0.6, 'and strong at the centre plate\'s own right edge');

    /* where it shows: only under one of its plates, two units in; never on another plate or in the black */
    let shown = 0;
    const others = ['A', 'B', 'B2', 'F'];
    for (let yy = 95; yy < 480; yy += 2) {
        for (let xx = 280; xx < 1510; xx += 2) {
            const r = Track.plusRevealAt(xx, yy);
            if (r <= 0) continue;
            shown++;
            assert.ok(M.plusPlateDist(xx, yy) < -2, `the picture at ${xx}, ${yy} is not under a plate of the window`);
            others.forEach((id) => assert.ok(M.roundDist(PLUS.PLATES[id].v, PLUS.PLATES[id].r, xx, yy) > 0, `on plate ${id} at ${xx}, ${yy}`));
        }
    }
    assert.ok(shown > 30000, 'a real window: ' + shown + ' samples');
    /* the black bar where the gear stands never opens */
    for (let xx = 1215; xx < 1420; xx += 5) assert.strictEqual(Track.plusRevealAt(xx, 270), 0, 'the gear\'s bar at ' + xx);

    /* the glass's hole is the band under its plates, two units in: its edge is always under a plate, and
       where that edge is the band's own (not a plate's outline) the plate there is still whole */
    const COSD = 1 / Math.hypot(1, S);
    for (let yy = 100; yy < 475; yy += 1.5) {
        for (let xx = 540; xx < 1440; xx += 1.5) {
            const u = xx + S * yy;
            const dBand = Math.max(PLUS.top + W.insetV - yy, yy - (PLUS.bottom - W.insetV),
                (M.at(M.plusLeftLine(), yy) - xx) * COSD, (u - W.right) * COSD);
            const dPlate = M.plusPlateDist(xx, yy);
            const hole = Math.max(dBand, dPlate + 2);                    /* the shader's own sum */
            if (hole >= 0.5 || hole < -1.5) continue;                    /* on the hole's edge */
            assert.ok(dPlate < -0.5, 'the hole\'s edge is under a plate');
            if (dPlate + 2 < dBand - 0.75) assert.ok(M.plusBand(xx, yy) < 0.02, `the band's own edge at ${xx}, ${yy}: the plate is still whole`);
        }
    }

    /* the shaders work it out from the same numbers */
    const bandSrc = 'float band(vec2 p) {';
    for (const id of ['mpcentre', 'mpsideR']) {
        const src = mShaders[id];
        assert.ok(src.includes(bandSrc), id);
        assert.ok(src.includes('if (u_open > 0.001) a *= 1.0 - u_open * band(p);'), id);
        assert.ok(src.includes('float smoother(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }'), id);
        assert.ok(src.includes(`) / ${W.featherL}.0`) && src.includes(`(${W.right}.0 - u) / ${W.featherR}.0`), id);
        assert.ok(src.includes('p.x - (' + (Math.round(M.plusLeftLine()[0] * 100000) / 100000) + ' * p.y + '), id + ': the left line');
        assert.ok(src.includes(`- ${W.insetV}.0) / ${W.featherV}.0`), id);
        assert.ok(src.includes('float u = p.x + ' + S + ' * p.y;'), id);
    }
    assert.ok(!mShaders.mpsideL.includes(bandSrc), 'the plates by the speed have no window in them');
    assert.ok(mShaders.mpback.includes('a = 1.0 - ac(max(dBand, dPlate + 2.0)) * inSlot(p);'));
    W.plates.forEach((id) => assert.ok(mShaders.mpback.includes(mShaders.chain('pp' + id, PLUS.PLATES[id].v, PLUS.PLATES[id].r, true)), id));
});

test('Plus window: on the panel it is inside BMW\'s map window, opens with the map, and no readout stands in it', () => {
    const t = plusBuild(), m = Track.MAP_WINDOW, w = t.window;
    assert.ok(w.x >= m.x && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w));
    /* its outline starts a little above BMW's window; the picture itself never does */
    for (let y = 100; y < 640; y += 1) {
        for (let x = 380; x < 1540; x += 3) {
            const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
            if (Track.plusRevealAt(ax, ay) > 0) {
                assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `the picture at ${x}, ${y} is outside BMW's map window`);
            }
        }
    }
    /* the glass and the window's plates open together, by the centre's mode */
    for (const id of ['back', 'platesC', 'platesR']) {
        const open = (centre) => layer(t, id).uniforms(state(t, {}, { centre })).u_open;
        assert.deepStrictEqual([open(CENTRES[0]), open(CENTRES[1]), open(CENTRES[2]), open(CENTRES[3])], [0, 1, 0.5, 0], id);
        assert.strictEqual(layer(t, id).uniforms(state(t, {})).u_open, 0);
    }
    assert.ok(t.layers.every((L) => L.z >= layer(t, 'back').z), 'nothing of ours under the glass');
    /* no figure, word or symbol where the picture shows - grown numerals included */
    for (const units of ['imperial', 'metric']) {
        const tt = plusBuild({ units, mFixture: true, clock12: true });
        const st = state(tt, BUSY, { centre: CENTRES[1] });
        for (const L of tt.layers.filter(isText)) {
            const u = L.uniforms(st, 0);
            for (const q of (u ? inkOf(L, u) : [])) {
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h], [q.x + q.w / 2, q.y + q.h / 2]]) {
                    const [ax, ay] = artOfPanel(x, y);
                    assert.strictEqual(Track.plusRevealAt(ax, ay), 0, `${L.id} over the map at ${Math.round(x)}, ${Math.round(y)}`);
                }
            }
        }
    }
});

/* ------------------------------------------- more of the picture (a setting) */

/* every corner and the middle of everything a style can put ink on, busy, in a state: artboard points */
function inkPoints(t, st) {
    const out = [];
    for (const L of t.layers.filter(isText)) {
        const u = L.uniforms(st, 0);
        for (const q of (u ? inkOf(L, u) : [])) {
            for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h], [q.x + q.w / 2, q.y + q.h / 2]]) {
                out.push({ id: L.id, x, y, art: artOfPanel(x, y) });
            }
        }
    }
    return out;
}
/* each way a style can be set that moves or changes a readout */
const READOUT_WAYS = [];
for (const units of ['imperial', 'metric']) for (const mGear of Track.GEAR_KINDS) for (const mPop of ['on', 'off']) {
    READOUT_WAYS.push({ units, mGear, mPop, mFixture: true, clock12: true, footL: 'oil', footM: 'boost', footR: 'volts' });
}

test('the larger window is a setting of each style\'s own, and the standard one is what a style has without it', () => {
    const shaders = (cfg) => { const t = build(cfg); return ['back', 'platesL', 'platesC', 'platesR'].map((id) => layer(t, id) && layer(t, id).shader); };
    assert.deepStrictEqual(shaders({}), ['mback', 'mplatesL', undefined, 'mplatesR']);
    assert.deepStrictEqual(shaders({ style: 'mplus' }), ['mpback', 'mpsideL', 'mpcentre', 'mpsideR']);
    assert.deepStrictEqual(shaders({ centreSize: 'more' }), ['mbackWide', 'mplatesLWide', undefined, 'mplatesRWide']);
    assert.deepStrictEqual(shaders({ style: 'mplus', centreSize: 'more' }), ['mpbackWide', 'mpsideLWide', 'mpcentreWide', 'mpsideRWide']);
    /* M Sport has the one step: Toro's "most", or anything unknown, is handled. M Sport Plus has a third */
    assert.strictEqual(build({ centreSize: 'most' }).settings.centreSize, 'more');
    assert.strictEqual(build({ style: 'mplus', centreSize: 'most' }).settings.centreSize, 'most');
    assert.deepStrictEqual(shaders({ style: 'mplus', centreSize: 'most' }), ['mpbackMost', 'mpsideLMost', 'mpcentreMost', 'mpsideRMost']);
    const sizes = (key) => require('../app/app.base.json').settings.find((x) => x.key === key).options.map((o) => o[0]);
    assert.deepStrictEqual([sizes('mCentreSize'), sizes('pCentreSize')], [['standard', 'more', 'full'], ['standard', 'more', 'most', 'full']]);
    /* ... and both have the widest, whose glass is one shader for the two */
    assert.deepStrictEqual(shaders({ centreSize: 'full' }), ['mbackFull', 'mplatesLFull', undefined, 'mplatesRFull']);
    assert.deepStrictEqual(shaders({ style: 'mplus', centreSize: 'full' }), ['mbackFull', 'mpsideLFull', 'mpcentreFull', 'mpsideRFull']);
    assert.deepStrictEqual([build({ centreSize: 'full' }).settings.centreSize, build({ style: 'mplus', centreSize: 'full' }).settings.centreSize], ['full', 'full']);
    /* (it is not one of Toro's openings, nor M Track Mode's: Toro's largest is "most") */
    assert.strictEqual(build({ style: 'toro', centreSize: 'full' }).settings.centreSize, 'most');
    assert.deepStrictEqual(build({ style: 'toro', centreSize: 'full' }).settings.hole, build({ style: 'toro', centreSize: 'most' }).settings.hole);
    assert.strictEqual(build({ style: 'mtrack', centreSize: 'full' }).settings.centreSize, 'standard');
    assert.strictEqual(build({ centreSize: 'huge' }).settings.centreSize, 'standard');
    assert.strictEqual(build({}).settings.centreSize, 'standard');
    /* each style keeps its own, under its own name */
    const own = (cfg) => Themes.build(atlas, 'x3m40i', cfg).settings.centreSize;
    const all = { tCentreSize: 'most', mCentreSize: 'more', pCentreSize: 'standard' };
    assert.strictEqual(own(Object.assign({ style: 'toro' }, all)), 'most');
    assert.strictEqual(own(Object.assign({ style: 'track' }, all)), 'more');
    assert.strictEqual(own(Object.assign({ style: 'mplus' }, all)), 'standard');
    assert.deepStrictEqual(['toro', 'track', 'mplus'].map((st) => Themes.keyFor(st, 'centreSize')), ['tCentreSize', 'mCentreSize', 'pCentreSize']);
    /* the standard shaders are not touched by the larger window's: neither has the other's outline */
    assert.ok(!/win2\(/.test(mShaders.mback + mShaders.mplatesL + mShaders.mplatesR));
    /* every plate layer is told how far the window is open exactly when its shader has one */
    for (const cfg of [{}, { centreSize: 'more' }, { style: 'mplus' }, { style: 'mplus', centreSize: 'more' }, { style: 'mplus', centreSize: 'most' },
                       { centreSize: 'full' }, { style: 'mplus', centreSize: 'full' }]) {
        const t = build(cfg);
        for (const id of ['back', 'platesL', 'platesC', 'platesR']) {
            const L = layer(t, id);
            if (!L) continue;
            const u = L.uniforms(state(t, {}, { centre: CENTRES[2] }));
            assert.strictEqual('u_open' in u, /u_open/.test(mShaders[L.shader]), `${JSON.stringify(cfg)} ${id}`);
            if ('u_open' in u) assert.strictEqual(u.u_open, 0.5);
        }
    }
});

test('M Sport, more of the picture: the V clear almost to its edge, and a band over the plate above each figure', () => {
    const W = M.WINDOW_MORE, V = M.WINDOW;
    assert.deepStrictEqual(W.polys[0], V.poly, 'the same V');
    assert.deepStrictEqual(W.r[0], V.r);
    /* the band: level, from the V's top down to the upper plates' foot, its sides those plates' outer sides */
    const [tl, tr, br, bl] = W.polys[1];
    const LU2 = M.PLATES.LU2.v, RU1 = M.PLATES.RU1.v;
    assert.deepStrictEqual([tl[1], tr[1]], [V.poly[0][1], V.poly[1][1]], 'its top is the V\'s: the picture\'s own top edge');
    assert.deepStrictEqual([bl, br], [LU2[3], RU1[2]], 'its foot runs from the left plate\'s outer corner to the right one\'s');
    assert.strictEqual(bl[1], br[1]);
    const onLine = (p, a, b) => Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(onLine(tl, LU2[0], LU2[3]) < 0.2, 'the left side lies along LU2\'s outer side');
    assert.ok(onLine(tr, RU1[1], RU1[2]) < 0.2, 'the right side along RU1\'s');
    /* a shorter fade: clear from 20 units in, where the standard window takes 50 */
    assert.ok(W.inset + W.feather <= 20 && V.inset + V.feather >= 50);
    assert.strictEqual(M.revealMoreAt(M.AX, V.poly[0][1] + W.inset + W.feather / 2), 0.5, 'half-way through its fade');
    for (const d of [-3, 0, W.inset, W.inset + W.feather / 4, W.inset + W.feather, 60]) {
        assert.ok(Math.abs(M.revealMoreAt(M.AX, V.poly[0][1] + d) - M.smoother((d - W.inset) / W.feather)) < 1e-9, `${d} in from the top`);
    }
    /* everywhere at least what the standard window shows, and over two fifths as much again in all */
    let std = 0, more = 0;
    const touched = new Set();
    for (let y = 60; y < 560; y += 2) {
        for (let x = 250; x < 1560; x += 2) {
            const a = M.revealAt(x, y), b = M.revealMoreAt(x, y);
            assert.ok(b >= a - 1e-9, `less of the picture at ${x}, ${y}`);
            std += a * 4; more += b * 4;
            if (b <= 0.02) continue;
            const plate = Object.keys(M.PLATES).find((id) => M.roundDist(M.PLATES[id].v, M.PLATES[id].r, x, y) < 0);
            if (plate) touched.add(plate);
        }
    }
    assert.ok(more > 1.4 * std, `the open area: ${Math.round(more)} against ${Math.round(std)}`);
    /* the plates that thin out: the two in the V, and the one above each figure - no other */
    assert.deepStrictEqual([...touched].sort(), W.plates.slice().sort());
    assert.deepStrictEqual(W.plates.slice().sort(), ['LL2', 'LU2', 'RL2', 'RU1']);
    /* the black bars the speed and the gear are written in stay shut, right across */
    for (let x = 300; x < 620; x += 4) assert.strictEqual(M.revealMoreAt(x, 270), 0, 'the speed\'s bar at ' + x);
    for (let x = 1170; x < 1500; x += 4) assert.strictEqual(M.revealMoreAt(x, 270), 0, 'the gear\'s bar at ' + x);

    /* the shaders work it out from the same two outlines and numbers */
    for (const id of ['mbackWide', 'mplatesLWide', 'mplatesRWide']) {
        const src = mShaders[id];
        assert.ok(src.includes(mShaders.chain('win', W.polys[0], W.r[0], true)), id + ': the V');
        assert.ok(src.includes(mShaders.chain('win2', W.polys[1], W.r[1], true)), id + ': the band');
        assert.ok(src.includes(`return smoother(clamp((-min(win(p), win2(p)) - ${W.inset}.0) / ${W.feather}.0, 0.0, 1.0));`), id);
        /* and apart from the window itself (its outlines, and how far in it has thinned) they are the
           standard shaders, character for character */
        const rest = (text) => {
            const from = text.indexOf('float win(vec2 p) {'), fn = text.indexOf('float reveal(vec2 p) {');
            assert.ok(from > 0 && fn > from);
            return text.slice(0, from) + text.slice(text.indexOf('\n}', fn) + 2);
        };
        assert.strictEqual(rest(src), rest(mShaders[id.replace('Wide', '')]), id);
    }
});

test('M Sport, more: inside BMW\'s map window, and no readout stands where the picture shows, however the style is set', () => {
    const t = build({ centreSize: 'more' }), m = Track.MAP_WINDOW, w = t.window;
    assert.ok(w.x >= m.x && w.y >= m.y && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w) + ' not inside ' + JSON.stringify(m));
    const b = M.windowMoreBox();
    assert.ok(w.x <= M.px(b.x0) && w.x + w.w >= M.px(b.x1) && w.y <= M.py(b.y0) && w.y + w.h >= M.py(b.y1), 'the window\'s own bounds');
    const std = build().window;
    assert.ok(w.w > std.w && w.x < std.x, 'wider than the standard one');
    const reveal = Track.revealOf(t);
    assert.strictEqual(reveal, M.revealMoreAt);
    assert.strictEqual(Track.revealOf(build()), M.revealAt);
    /* the picture itself never shows outside BMW's window */
    for (let y = 100; y < 640; y += 2) {
        for (let x = 380; x < 1540; x += 3) {
            const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
            if (reveal(ax, ay) > 0) assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `the picture at ${x}, ${y}`);
        }
    }
    let checked = 0;
    for (const way of READOUT_WAYS) {
        const tt = build(Object.assign({ centreSize: 'more' }, way));
        for (const raw of [BUSY, { rpm: 7990, speedKmh: 8, gear: '1', fuelPct: 100, oilTempC: 150, rangeKm: 5, ambientC: 38, clock: { h: 1, m: 1 } }]) {
            for (const pt of inkPoints(tt, state(tt, raw, { centre: CENTRES[1] }))) {
                assert.strictEqual(reveal(pt.art[0], pt.art[1]), 0, `${JSON.stringify(way)}: ${pt.id} over the picture at ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 5000, 'every readout was looked at: ' + checked);
});

test('M Sport Plus, more of the picture: the same band at full strength to its edges, and the plate above the speed', () => {
    const W = PLUS.WINDOW_MORE, V = PLUS.WINDOW, S = PLUS.slope;
    /* the same band: between the same lines */
    assert.deepStrictEqual(W.leftLine, V.leftLine, 'the owner\'s line still keeps the picture off the two speeds');
    assert.strictEqual(W.right, V.right, 'and it still ends before the oil gauge\'s figures');
    assert.deepStrictEqual(W.plates, V.plates);
    /* in over much shorter fades */
    assert.ok(W.featherV <= V.featherV / 2 && W.featherL <= V.featherL / 3 && W.featherR <= V.featherR / 2);
    const more = (x, y) => M.plusRevealAt(x, y, W);
    const y = 290, L = M.plusLeftLine(W), xl = L[0] * y + L[1];
    assert.strictEqual(more(xl - 1, y), 0);
    assert.ok(Math.abs(more(xl + W.featherL / 2, y) - 0.5) < 1e-9);
    assert.strictEqual(more(xl + W.featherL + 1, y), 1);
    const band = (u) => M.plusBand(u - S * y, y, W);
    assert.strictEqual(band(W.right - W.featherR - 1), 1);
    assert.ok(Math.abs(band(W.right - W.featherR / 2) - 0.5) < 1e-9);
    assert.strictEqual(band(W.right + 1), 0);
    /* the plates by the gear now carry it nearly whole, where the standard band has it faint */
    assert.ok(more(1290, 160) > 0.95 && Track.plusRevealAt(1290, 160) < 0.6, 'the plate above the gear');
    assert.ok(more(1200, 400) > 0.7 && Track.plusRevealAt(1200, 400) < 0.4, 'the plate below it');
    /* the plate above the speed: all of it, in from its own outline */
    assert.strictEqual(W.ear.plate, 'B');
    const B = PLUS.PLATES.B, E = W.ear;
    /* from far enough in that none of it is under the top of the speed's figures, just below the plate */
    assert.ok(E.inset >= 6 && E.inset + E.feather <= 30);
    assert.strictEqual(more(520, 180), 1, 'open in its middle');
    assert.strictEqual(Track.plusRevealAt(520, 180), 0, '... and shut in the standard window');
    for (let yy = 95; yy < 260; yy += 3) {
        for (let xx = 380; xx < 640; xx += 3) {
            const d = M.roundDist(B.v, B.r, xx, yy), r = M.plusEar(xx, yy, W);
            assert.ok(Math.abs(r - M.smoother((-d - E.inset) / E.feather)) < 1e-9);
            if (d > -E.inset) assert.strictEqual(r, 0, 'nothing past the plate\'s own edge');
        }
    }
    assert.strictEqual(M.plusEar(520, 180), 0, 'the standard window has no such plate');

    /* everywhere at least the standard band, and a third as much again in all; only under its own plates */
    let std = 0, wide = 0, shown = 0;
    const shut = ['A', 'B2', 'F'];
    for (let yy = 95; yy < 480; yy += 2) {
        for (let xx = 280; xx < 1510; xx += 2) {
            const a = Track.plusRevealAt(xx, yy), r = more(xx, yy);
            assert.ok(r >= a - 1e-9, `less of the picture at ${xx}, ${yy}`);
            std += a * 4; wide += r * 4;
            if (r <= 0) continue;
            shown++;
            const underBand = M.plusPlateDist(xx, yy, W) < -2, underEar = M.roundDist(B.v, B.r, xx, yy) < -2;
            assert.ok(underBand || underEar, `the picture at ${xx}, ${yy} is not under a plate of the window`);
            shut.forEach((id) => assert.ok(M.roundDist(PLUS.PLATES[id].v, PLUS.PLATES[id].r, xx, yy) > 0, `on plate ${id} at ${xx}, ${yy}`));
        }
    }
    assert.ok(wide > 1.3 * std && shown > 40000, `the open area: ${Math.round(wide)} against ${Math.round(std)}`);
    /* the black bars the speed and the gear stand in never open */
    for (let xx = 1215; xx < 1420; xx += 5) assert.strictEqual(more(xx, 270), 0, 'the gear\'s bar at ' + xx);
    for (let xx = 380; xx < 600; xx += 5) assert.strictEqual(more(xx, 248.5), 0, 'the speed\'s bar at ' + xx);

    /* the glass: its hole is the band under its plates and the added plate, two units in, the edge always under plate */
    const COSD = 1 / Math.hypot(1, S);
    for (let yy = 100; yy < 475; yy += 1.5) {
        for (let xx = 390; xx < 1440; xx += 1.5) {
            const u = xx + S * yy;
            const dBand = Math.max(PLUS.top + W.insetV - yy, yy - (PLUS.bottom - W.insetV), (M.at(L, yy) - xx) * COSD, (u - W.right) * COSD);
            const dB = M.roundDist(B.v, B.r, xx, yy), dPlate = M.plusPlateDist(xx, yy, W);
            const hole = Math.min(Math.max(dBand, dPlate + 2), dB + 2);                           /* the shader's own sum */
            if (hole >= 0.5 || hole < -1.5) continue;                                             /* on the hole's edge */
            assert.ok(Math.min(dPlate, dB) < -0.5, 'the hole\'s edge is under a plate');
            /* the added plate's hole ends where that plate has not begun to thin */
            if (dB + 2 < 0.5 && dB + 2 >= -1.5) assert.strictEqual(M.plusEar(xx, yy, W), 0, `the added plate at ${xx}, ${yy}`);
            /* and where the edge is the band's own (not a plate's outline) the plate there is still whole */
            else if (dPlate + 2 < dBand - 0.75) assert.ok(M.plusBand(xx, yy, W) < 0.02, `the band's own edge at ${xx}, ${yy}`);
        }
    }

    /* the shaders work it out from the same numbers */
    for (const id of ['mpcentreWide', 'mpsideRWide']) {
        const src = mShaders[id];
        assert.ok(src.includes('if (u_open > 0.001) a *= 1.0 - u_open * band(p);'), id);
        assert.ok(src.includes(`) / ${W.featherL}.0`) && src.includes(`(${W.right}.0 - u) / ${W.featherR}.0`), id);
        assert.ok(src.includes(`- ${W.insetV}.0) / ${W.featherV}.0`), id);
        assert.ok(src.includes('p.x - (' + (Math.round(L[0] * 100000) / 100000) + ' * p.y + '), id + ': the left line');
        /* apart from the band's numbers, the standard shader line for line */
        const a = mShaders[id.replace('Wide', '')].split('\n'), b = src.split('\n');
        assert.strictEqual(a.length, b.length, id);
        a.forEach((line, i) => { if (line !== b[i]) assert.ok(/smoother\(clamp/.test(line), id + ': ' + line); });
    }
    const left = mShaders.mpsideLWide;
    assert.ok(left.includes('uniform float u_open;'));
    assert.ok(left.includes(`  return smoother(clamp((-ppB(p) - ${E.inset}.0) / ${E.feather}.0, 0.0, 1.0));`), 'the plate above the speed, in from its outline');
    assert.ok(left.includes('if (u_open > 0.001) a *= 1.0 - u_open * band(p);'));
    assert.ok(!/u_open/.test(mShaders.mpsideL), 'the standard plates by the speed have no window in them');
    assert.ok(mShaders.mpbackWide.includes('a = 1.0 - ac(min(max(dBand, dPlate + 2.0), ppB(p) + 2.0)) * inSlot(p);'));
    ['B', 'C', 'D', 'E'].forEach((id) => assert.ok(mShaders.mpbackWide.includes(mShaders.chain('pp' + id, PLUS.PLATES[id].v, PLUS.PLATES[id].r, true)), id));
});

test('M Sport Plus, more: inside BMW\'s map window, and no readout stands where the picture shows, however the style is set', () => {
    const t = plusBuild({ centreSize: 'more' }), m = Track.MAP_WINDOW, w = t.window;
    assert.ok(w.x >= m.x && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w));
    assert.ok(w.x < plusBuild().window.x, 'it reaches further left: the plate above the speed');
    const reveal = Track.revealOf(t);
    assert.strictEqual(reveal(520, 180), 1);
    assert.strictEqual(Track.revealOf(plusBuild())(520, 180), 0);
    for (let y = 100; y < 640; y += 2) {
        for (let x = 380; x < 1540; x += 3) {
            const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
            if (reveal(ax, ay) > 0) assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `the picture at ${x}, ${y} is outside BMW's map window`);
        }
    }
    /* the glass and every plate group with a window open together */
    for (const id of ['back', 'platesL', 'platesC', 'platesR']) {
        const open = (centre) => layer(t, id).uniforms(state(t, {}, { centre })).u_open;
        assert.deepStrictEqual([open(CENTRES[0]), open(CENTRES[1]), open(CENTRES[2]), open(CENTRES[3])], [0, 1, 0.5, 0], id);
    }
    let checked = 0;
    for (const way of READOUT_WAYS) {
        const tt = plusBuild(Object.assign({ centreSize: 'more' }, way));
        for (const raw of [BUSY, { rpm: 7990, speedKmh: 8, gear: '1', fuelPct: 100, oilTempC: 150, rangeKm: 5, ambientC: 38, clock: { h: 1, m: 1 } }]) {
            for (const pt of inkPoints(tt, state(tt, raw, { centre: CENTRES[1] }))) {
                assert.strictEqual(reveal(pt.art[0], pt.art[1]), 0, `${JSON.stringify(way)}: ${pt.id} over the picture at ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 5000, 'every readout was looked at: ' + checked);
});

test('M Sport Plus, fullest: one blended picture - the spot between the plates filled, soft at every edge, further down', () => {
    const W = PLUS.WINDOW_MOST, MORE = PLUS.WINDOW_MORE, S = PLUS.slope;
    const pads = M.plusMostPads({});
    const most = (x, y) => M.plusMostAt(x, y, pads), more = (x, y) => M.plusRevealAt(x, y, MORE);
    /* the spot that stayed shut in "more": the strip of the centre plate left of the owner's line, and the black cut
       between it and the plate above the speed - open now, and that plate no longer an island */
    assert.strictEqual(more(660, 170), 0, 'the centre plate\'s left strip was shut');
    assert.strictEqual(more(620, 180), 0, 'and so was the cut');
    assert.ok(most(660, 170) > 0.95 && most(620, 180) > 0.95, 'both carry the picture now');
    assert.ok(most(520, 180) > 0.3 && most(440, 180) < most(520, 180), 'the plate above the speed: part of the fade to the left, not a patch of its own');
    for (let x = 460; x < 700; x += 4) assert.ok(most(x + 4, 180) >= most(x, 180) - 1e-9, 'rising all the way across it, with no gap');
    /* soft at every edge: nowhere does the picture's strength step (a seventh at most across two units) */
    let steepest = 0, area = 0, areaMore = 0;
    for (let y = 100; y < 540; y += 2) {
        for (let x = 380; x < 1440; x += 2) {
            const v = most(x, y);
            steepest = Math.max(steepest, Math.abs(most(x + 2, y) - v), Math.abs(most(x, y + 2) - v));
            area += v * 4; areaMore += more(x, y) * 4;
        }
    }
    assert.ok(steepest < 0.15, 'the steepest step: ' + steepest.toFixed(3));
    /* (the hardest edge in "more" was its plates' own outline: a step of the whole strength) */
    assert.ok(area > 1.1 * areaMore, `more of the picture: ${Math.round(area)} against ${Math.round(areaMore)}`);
    /* the top and the foot: far more gradual than "more"'s, and the foot well under the plates' own */
    assert.ok(W.featherT >= 2 * MORE.featherV && W.featherB >= 5 * MORE.featherV);
    assert.ok(Math.abs(most(900, W.top + W.featherT / 2) - 0.5) < 1e-6, 'half-way in at half the top\'s fade');
    assert.ok(W.bottom > PLUS.bottom + 50, 'it runs on under the plates\' foot');
    assert.ok(most(850, PLUS.bottom + 20) > 0.3 && more(850, PLUS.bottom + 20) === 0, 'picture below the plates, where there was none');
    assert.strictEqual(most(850, W.bottom + 1), 0);
    /* there is no picture above its own top edge, so the top cannot go further up: it starts on that edge */
    assert.ok(Math.abs(M.py(W.top) - Track.MAP_WINDOW.y) < 1.5, 'the top is the picture\'s own');
    assert.strictEqual(most(900, W.top - 1), 0);
    /* the right end blends as before, a little softer; the left is two lines meeting in a point */
    assert.strictEqual(W.right, MORE.right);
    assert.ok(W.featherR > MORE.featherR);
    const yPoint = (W.u0 - W.w0) / (2 * S);
    /* (the point: level with the plate above the speed, inside BMW's window) */
    assert.ok(yPoint > 110 && yPoint < 200 && M.px(W.u0 - S * yPoint) >= Track.MAP_WINDOW.x);
    for (let y = 112; y < 520; y += 6) {
        const edge = Math.max(W.u0 - S * y, W.w0 + S * y);
        assert.strictEqual(most(edge - 1, y), 0, 'nothing left of the left lines at ' + y);
    }
    /* a plate is gone once the picture is at three tenths of its strength, so none of its edges shows in the picture */
    assert.deepStrictEqual([M.plusMostPlate(0), M.plusMostPlate(W.plateGone), M.plusMostPlate(1)], [0, 1, 1]);
    assert.ok(M.plusMostPlate(W.plateGone / 2) === 0.5);

    /* the shaders work it out from the same numbers: the glass by the field, the plates by how far that has taken them */
    const lines = [
        `  if (p.y < ${W.top}.0 || p.y > ${W.bottom}.0) return 0.0;`,
        `  float v = smoother(clamp((p.y - ${W.top}.0) / ${W.featherT}.0, 0.0, 1.0))`,
        `          * smoother(clamp((${W.bottom}.0 - p.y) / ${W.featherB}.0, 0.0, 1.0));`,
        `  v *= smoother(clamp(min(u - ${W.u0}.0, w - ${W.w0}.0) / ${W.featherL}.0, 0.0, 1.0));`,
        `  v *= smoother(clamp((${W.right}.0 - u) / ${W.featherR}.0, 0.0, 1.0));`,
        '  return v * pad(p, u_pad1) * pad(p, u_pad2);',
        `  return smoother(clamp(d / ${W.padSoft}.0, 0.0, 1.0));`,
        '  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);'
    ];
    for (const id of ['mpbackMost', 'mpsideLMost', 'mpcentreMost', 'mpsideRMost']) {
        lines.forEach((l) => assert.ok(mShaders[id].includes(l), id + ': ' + l));
        assert.ok(mShaders[id].includes('float u = p.x + ' + S + ' * p.y;') && mShaders[id].includes('float w = p.x - ' + S + ' * p.y;'), id);
    }
    assert.ok(mShaders.mpbackMost.includes('if (u_open > 0.001) a = 1.0 - u_open * most(p) * inSlot(p);'));
    for (const id of ['mpsideLMost', 'mpcentreMost', 'mpsideRMost']) {
        assert.ok(mShaders[id].includes(`float band(vec2 p) { return smoother(clamp(most(p) / ${W.plateGone}, 0.0, 1.0)); }`), id);
        assert.ok(mShaders[id].includes('if (u_open > 0.001) a *= 1.0 - u_open * band(p);'), id);
    }
});

test('M Sport Plus, fullest: the speeds and the gear keep their own ground, whatever the style is set to show there', () => {
    const m = Track.MAP_WINDOW;
    /* the pads follow the settings: one speed needs less than two, the revs more than the gear, nothing none */
    const both = M.plusMostPads({}), one = M.plusMostPads({ speed2: false });
    assert.ok(one[0][3] < both[0][3] && one[0][1] < both[0][1], 'one speed: a shorter pad');
    assert.deepStrictEqual(M.plusMostPads({ gear: 'off' })[1], [0, 0, 0, 0]);
    assert.ok(M.plusMostPads({ gear: 'rpm' })[1][2] > both[1][2]);
    assert.strictEqual(M.plusMostAt(1240, 296, both), 0, 'the gear\'s place is shut');
    assert.ok(M.plusMostAt(1240, 296, M.plusMostPads({ gear: 'off' })) > 0.3, 'with nothing shown there it is the picture\'s');
    assert.strictEqual(M.plusMostAt(560, 380, both), 0, 'the second speed\'s place is shut');
    assert.ok(M.plusMostAt(560, 392, one) > 0, 'with one speed the picture comes up under it');
    /* a pad: nothing on or inside its box, everything from its soft edge out */
    const soft = PLUS.WINDOW_MOST.padSoft;
    assert.deepStrictEqual([M.padAt(494, 316, both[0], soft), M.padAt(494 + 128, 316, both[0], soft), M.padAt(494 + 128 + soft, 316, both[0], soft)], [0, 0, 1]);
    assert.strictEqual(M.padAt(0, 0, [0, 0, 0, 0], soft), 1, 'no pad: no shade');

    let checked = 0;
    const ways = READOUT_WAYS.concat(READOUT_WAYS.map((w) => Object.assign({}, w, { speed2: false })));
    for (const way of ways) {
        const t = plusBuild(Object.assign({ centreSize: 'most' }, way));
        const reveal = Track.revealOf(t);
        assert.deepStrictEqual(t.pads, M.plusMostPads({ speed2: way.speed2 !== false, gear: way.mGear }));
        /* the layers are told the same pads the test measures by */
        for (const id of ['back', 'platesL', 'platesC', 'platesR']) {
            const u = layer(t, id).uniforms(state(t, {}, { centre: CENTRES[1] }));
            assert.deepStrictEqual([u.u_pad1, u.u_pad2, u.u_open], [t.pads[0], t.pads[1], 1], id);
        }
        for (const raw of [BUSY, { rpm: 7990, speedKmh: 8, gear: '1', fuelPct: 100, oilTempC: 150, rangeKm: 5, ambientC: 38, clock: { h: 1, m: 1 } }]) {
            for (const pt of inkPoints(t, state(t, raw, { centre: CENTRES[1] }))) {
                assert.strictEqual(reveal(pt.art[0], pt.art[1]), 0, `${JSON.stringify(way)}: ${pt.id} over the picture at ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
                checked++;
            }
        }
        /* the picture itself never shows outside BMW's window, and the window the style reports holds all of it */
        const w = t.window;
        assert.ok(w.x >= m.x && w.y >= m.y - 1 && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w));
        if (way === ways[0]) {
            for (let y = 100; y < 640; y += 2) {
                for (let x = 380; x < 1540; x += 3) {
                    const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
                    if (reveal(ax, ay) > 0) assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `the picture at ${x}, ${y} is outside BMW's map window`);
                }
            }
        }
    }
    assert.ok(checked > 10000, 'every readout was looked at: ' + checked);
    /* the footer and its panel are under the picture's foot */
    assert.ok(PLUS.WINDOW_MOST.bottom < M.FOOT.panel.top);
});

/* ------------------------------------------- the widest window (either M style) */

/* the two strips' own shapes as artboard points: the fine line and the segments beside it, fuel and its mirror */
function stripPoints() {
    const ST = M.STRIP, out = [];
    for (let y = ST.top; y <= ST.bottom + 0.01; y += 3.5) {
        const x0 = M.at(ST.line, y), x1 = M.at(ST.seg, y) + ST.segW;
        for (const x of [x0, (x0 + x1) / 2, x1]) out.push([x, y], [M.mirror(x), y]);
    }
    return out;
}

test('the widest window, either M style: all of the car\'s picture, soft at every edge, far more of it than any other window', () => {
    const W = M.WINDOW_FULL, m = Track.MAP_WINDOW;
    const area = (f) => { let a = 0; for (let y = 100; y < 560; y += 2) for (let x = 370; x < 1440; x += 2) a += f(x, y) * 4; return a; };
    for (const style of M_STYLES) {
        const t = build({ style, centreSize: 'full' }), f = t.field, at = Track.revealOf(t);
        const bare = (x, y) => M.fullAt(x, y, f, null);
        /* the field is the picture's own rectangle - BMW's window, to the pixel - down to a foot of its own */
        assert.ok(Math.abs(M.px(f[0]) - m.x) < 1e-6 && Math.abs(M.py(f[1]) - m.y) < 1e-6 && Math.abs(M.px(f[2]) - (m.x + m.w)) < 1e-6, style);
        assert.strictEqual(f[3], W.bottom);
        assert.deepStrictEqual(f, M.fullField([f[0], f[1], f[2], (m.y + m.h - M.ART.oy) / M.ART.s]));
        /* ... which is under the rails and above the footer's panel, and inside the picture */
        assert.ok(W.bottom > M.DIAL.railBottom && W.bottom < M.FOOT.panel.top && M.py(W.bottom) < m.y + m.h);
        /* nothing on or outside its edges; whole across the middle */
        for (const [x, y] of [[f[0], 300], [f[0] - 1, 300], [f[2], 300], [f[2] + 1, 300], [900, f[1]], [900, f[1] - 1], [900, f[3]], [900, f[3] + 1]]) {
            assert.strictEqual(bare(x, y), 0, `${x}, ${y}`);
            assert.strictEqual(at(x, y), 0);
        }
        assert.strictEqual(bare(900, 300), 1);
        assert.strictEqual(at(900, 300), 1, 'the middle of the picture is the picture, whole');
        /* each edge fades on the curve with no corner: half-way in at half its fade, rising all the way */
        assert.ok(Math.abs(bare(f[0] + W.featherX / 2, 300) - 0.5) < 1e-9 && Math.abs(bare(f[2] - W.featherX / 2, 300) - 0.5) < 1e-9);
        assert.ok(Math.abs(bare(900, f[1] + W.featherT / 2) - 0.5) < 1e-9 && Math.abs(bare(900, f[3] - W.featherB / 2) - 0.5) < 1e-9);
        for (let d = 0; d < W.featherX; d += 2) {
            assert.ok(bare(f[0] + d + 2, 300) >= bare(f[0] + d, 300) && bare(f[2] - d - 2, 300) >= bare(f[2] - d, 300));
        }
        for (let d = 0; d < W.featherT; d += 2) assert.ok(bare(900, f[1] + d + 2) >= bare(900, f[1] + d) && bare(900, f[3] - d - 2) >= bare(900, f[3] - d));
        assert.ok(bare(f[0] + W.featherX, 300) > 1 - 1e-9 && bare(900, f[1] + W.featherT) > 1 - 1e-9 && bare(900, f[3] - W.featherB) > 1 - 1e-9);
        /* soft everywhere, the pads' edges included: nowhere does the picture's strength step (a tenth at most across two units) */
        let steepest = 0;
        for (let y = 100; y < 540; y += 2) {
            for (let x = 370; x < 1440; x += 2) {
                const v = at(x, y);
                steepest = Math.max(steepest, Math.abs(at(x + 2, y) - v), Math.abs(at(x, y + 2) - v));
            }
        }
        assert.ok(steepest < 0.1, style + ': the steepest step: ' + steepest.toFixed(3));
        /* the fades are generous: the sides the longest, none shorter than the pads' */
        assert.ok(W.featherX >= 80 && W.featherT >= W.padSoft && W.featherB >= W.padSoft && W.padSoft >= 40);
        /* far more of the picture than the style's other windows show */
        const wide = area(at);
        const others = style === 'mplus' ? ['standard', 'more', 'most'] : ['standard', 'more'];
        const most = Math.max(...others.map((centreSize) => area(Track.revealOf(build({ style, centreSize })))));
        assert.ok(wide > (style === 'mplus' ? 1.12 : 1.45) * most, `${style}: ${Math.round(wide)} against ${Math.round(most)}`);
        /* ... and more than half of everything BMW's window holds, strength for strength */
        assert.ok(wide > 0.5 * (f[2] - f[0]) * ((m.y + m.h - M.ART.oy) / M.ART.s - f[1]), style + ': ' + Math.round(wide));
        /* the window the style reports is BMW's own, to the field's foot */
        assert.deepStrictEqual(t.window, { x: m.x, y: m.y, w: m.w, h: Math.ceil(M.py(W.bottom)) - m.y });
    }

    /* the shaders work it out from the same numbers: one glass for both styles */
    const src = mShaders.mbackFull;
    for (const l of [
        `  float v = smoother(clamp(a.x / ${W.featherX}.0, 0.0, 1.0)) * smoother(clamp(b.x / ${W.featherX}.0, 0.0, 1.0))`,
        `          * smoother(clamp(a.y / ${W.featherT}.0, 0.0, 1.0)) * smoother(clamp(b.y / ${W.featherB}.0, 0.0, 1.0));`,
        '  vec2 a = p - u_field.xy;', '  vec2 b = u_field.zw - p;',
        '  if (min(min(a.x, b.x), min(a.y, b.y)) <= 0.0) return 0.0;',
        '  return v * padL(p, u_pad1, 0.0) * padL(p, u_pad2, 0.0)',
        `           * padL(p, u_pad3, ${W.lean}) * padL(p, u_pad4, -${W.lean});`,
        '  vec2 q = abs(vec2(p.x - lean * (p.y - b.y) - b.x, p.y - b.y)) - b.zw;',
        '  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);',
        `  return smoother(clamp(d / ${W.padSoft}.0, 0.0, 1.0));`,
        'float smoother(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }',
        'float reveal(vec2 p) { return whole(p); }',
        '  if (u_open > 0.001) a = 1.0 - u_open * reveal(p);'
    ]) assert.ok(src.includes(l), 'mbackFull: ' + l);
    assert.strictEqual(W.lean, M.STRIP.line[0], 'the strips\' pads lean as the strips do');
    /* shut, it is the glass every M style has: the same colour, the same fade into a covered strip */
    const tail = (x) => x.slice(x.indexOf('void main() {'));
    assert.strictEqual(tail(src), tail(mShaders.mback));
    assert.ok(!/u_slot|inSlot/.test(src), 'the field is told where the picture is: it needs no other hold at its edge');
});

test('the widest window: the plates and M Sport\'s lines make way as the picture comes up, and are not drawn once it is open', () => {
    const SHUT = CENTRES[0], OPEN = CENTRES[1], HALF = CENTRES[2], TURN = CENTRES[3];
    for (const style of M_STYLES) {
        /* (a centre that can hold a picture: M Sport's lines fade only then) */
        const t = build({ style, centre: 'waze', centreSize: 'full' }), std = build({ style, centre: 'waze' });
        const ids = style === 'mplus' ? ['platesL', 'platesC', 'platesR'] : ['platesL', 'platesR', 'centreLines'];
        for (const id of ids) {
            const L = layer(t, id), u = (centre) => L.uniforms(state(t, {}, { centre }));
            assert.strictEqual(u(OPEN), null, `${style} ${id}: not drawn over an open picture`);
            assert.strictEqual(u(HALF).u_open, 0.5, id + ': going as it opens');
            assert.strictEqual(u(SHUT).u_open, 0, id + ': whole with nothing to show');
            assert.strictEqual(u(TURN).u_open, 0, id + ': whole under our own turn card');
            /* its shader takes it away evenly, by how far the picture is open - it has no outline to end on */
            const src = mShaders[L.shader];
            assert.ok(/float (reveal|band)\(vec2 p\) \{ return 1\.0; \}/.test(src), L.shader);
            assert.ok(/if \(u_open > 0\.001\) (c\.)?a \*= 1\.0 - u_open \* (reveal|band)\(p\);/.test(src), L.shader);
            assert.ok(!/u_field|u_pad|whole\(/.test(src), L.shader + ': nothing of the field in it');
            /* and is otherwise the standard one, shape for shape: everything before its window, and its colours */
            /* (M Sport Plus's plates by the speed are in no window as the style comes: theirs has no such line at all) */
            const plain = mShaders[layer(std, id).shader];
            const body = (x) => x.slice(x.indexOf('void main() {')).replace(/\n {2}if \(u_open > 0\.001\) (c\.)?a \*= 1\.0 - u_open \* (reveal|band)\(p\);/, '');
            assert.strictEqual(body(src), body(plain), L.shader);
            assert.notStrictEqual(body(src), src.slice(src.indexOf('void main() {')));
        }
        /* shut - nothing to show, or a turn card - the style is the one it is with any other window, layer for layer */
        assert.deepStrictEqual(t.layers.map((L) => [L.id, L.x, L.y, L.w, L.h, L.z]), std.layers.map((L) => [L.id, L.x, L.y, L.w, L.h, L.z]));
        for (const centre of [SHUT, TURN]) {
            const st = state(t, BUSY, { centre });
            t.layers.forEach((L, i) => {
                const a = L.uniforms(st, 0), b = std.layers[i].uniforms(state(std, BUSY, { centre }), 0);
                if (a === null || b === null) { assert.strictEqual(a, b, L.id); return; }
                for (const k of Object.keys(b)) if (k !== 'u_slot') assert.deepStrictEqual(a[k], b[k], `${style} ${L.id}.${k}`);
                /* (M Sport Plus's plates by the speed are told how far it is open here; as the style comes they are in no window) */
                assert.deepStrictEqual(Object.keys(a).filter((k) => !(k in b)), L.id === 'back' ? ['u_field', 'u_pad1', 'u_pad2', 'u_pad3', 'u_pad4']
                    : style === 'mplus' && L.id === 'platesL' ? ['u_open'] : [], L.id);
            });
        }
        /* the glass is told the field and the four pads the tests measure by */
        const g = layer(t, 'back').uniforms(state(t, {}, { centre: OPEN }));
        assert.deepStrictEqual([g.u_field, g.u_pad1, g.u_pad2, g.u_pad3, g.u_pad4, g.u_open], [t.field, t.pads[0], t.pads[1], t.pads[2], t.pads[3], 1]);
        /* open, the style asks the renderer for less than with its standard window: fewer layers drawn, fewer pixels */
        const drawn = (th, centre) => th.layers.filter((L) => L.uniforms(state(th, BUSY, { centre }), 0) !== null);
        const px = (Ls) => Ls.reduce((n, L) => n + L.w * L.h, 0);
        assert.strictEqual(drawn(std, OPEN).length - drawn(t, OPEN).length, ids.length, style);
        assert.ok(px(drawn(t, OPEN)) < 0.9 * px(drawn(std, OPEN)), `${style}: ${px(drawn(t, OPEN))} px against ${px(drawn(std, OPEN))}`);
    }
    /* M Sport's two lines, kept: they are the plain ones, over the picture, as with any window */
    const kept = build({ centre: 'waze', centreSize: 'full', mLines: 'keep' }), lines = layer(kept, 'centreLines');
    assert.strictEqual(lines.shader, 'mdiag');
    assert.deepStrictEqual(Object.keys(lines.uniforms(state(kept, {}, { centre: OPEN }))).sort(), ['u_art', 'u_cyan', 'u_red']);
    assert.strictEqual(layer(build({ centre: 'waze', centreSize: 'full' }), 'centreLines').shader, 'mdiagFadeFull');
    /* a centre that holds no picture has the plain lines whatever the size */
    assert.strictEqual(layer(build({ centreSize: 'full', centre: 'turn' }), 'centreLines').shader, 'mdiag');
});

test('the widest window: every figure keeps its own dark ground however the style is set, and the picture never leaves BMW\'s window', () => {
    const m = Track.MAP_WINDOW, W = M.WINDOW_FULL, F = M.FULL_PADS;
    /* the pads follow the settings: one speed needs less than two, the revs more than the gear, nothing none */
    const both = M.fullPads({}), one = M.fullPads({ speed2: false });
    assert.strictEqual(both.length, 4);
    assert.ok(one[0][3] < both[0][3] && one[0][1] < both[0][1], 'one speed: a shorter pad');
    assert.deepStrictEqual(M.fullPads({ gear: 'off' })[1], [0, 0, 0, 0]);
    assert.ok(M.fullPads({ gear: 'rpm' })[1][2] > both[1][2]);
    /* the strips' pads: the same height, the oil's the fuel's mirrored about the dials' axis and a little wider (its marks have three figures) */
    assert.deepStrictEqual([both[2][1], both[2][3]], [both[3][1], both[3][3]]);
    assert.ok(both[3][2] > both[2][2]);
    assert.ok(Math.abs((both[2][0] - both[2][2]) - (M.mirror(both[3][0]) - both[3][2])) < 1e-9, 'their outer sides are a mirror pair');
    assert.deepStrictEqual([F.strip.fuel[0], F.strip.oil[0]], [F.strip.fuel[0], F.strip.fuel[0]]);
    /* a pad leans with its strip: its side is the strip's own line moved level, at every height */
    const field = build({ centreSize: 'full' }).field;
    for (const y of [345, 400, 460, 498]) {
        const side = both[2][0] - both[2][2] + W.lean * (y - both[2][1]);
        assert.ok(Math.abs((M.at(M.STRIP.line, y) - side) - (M.at(M.STRIP.line, 420.5) - (both[2][0] - both[2][2]))) < 1e-9, 'at ' + y);
        assert.strictEqual(M.leanPadAt(side + 1, y, both[2], W.padSoft, W.lean), 0, 'on the pad');
        assert.ok(M.leanPadAt(side + 2 * both[2][2] + W.padSoft + 0.5, y, both[2], W.padSoft, W.lean) === 1, 'clear of it');
    }
    /* with nothing in the gear's place the picture has it; with one speed it comes up under the first */
    const openAt = (x, y, pads) => M.fullAt(x, y, field, pads);
    assert.strictEqual(openAt(1309, 269, both), 0);
    assert.strictEqual(openAt(1309, 269, M.fullPads({ gear: 'off' })), 1);
    assert.strictEqual(openAt(560, 380, both), 0);
    assert.ok(openAt(560, 392, one) > 0.5);

    let checked = 0;
    const ways = READOUT_WAYS.concat(READOUT_WAYS.map((w) => Object.assign({}, w, { speed2: false })),
        READOUT_WAYS.map((w) => Object.assign({}, w, { electric: 'bev' })));
    const RAWS = [BUSY, { rpm: 7990, speedKmh: 8, gear: '1', fuelPct: 100, oilTempC: 150, rangeKm: 5, ambientC: 38, clock: { h: 1, m: 1 } },
        { rpm: 888, speedKmh: 322, gear: 'D8', fuelPct: 3, oilTempC: 60, rangeKm: 55, ambientC: -38, clock: { h: 23, m: 58 } }];
    for (const style of M_STYLES) {
        for (const way of ways) {
            const t = build(Object.assign({ style, centreSize: 'full' }, way));
            const reveal = Track.revealOf(t);
            assert.deepStrictEqual(t.pads, M.fullPads({ speed2: way.speed2 !== false, gear: way.mGear }));
            for (const raw of RAWS) {
                for (const pt of inkPoints(t, state(t, raw, { centre: CENTRES[1] }))) {
                    assert.strictEqual(reveal(pt.art[0], pt.art[1]), 0, `${style} ${JSON.stringify(way)}: ${pt.id} over the picture at ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
                    checked++;
                }
            }
            /* the strips themselves - their lit segments are white - stand on their pads too */
            for (const [x, y] of stripPoints()) assert.strictEqual(reveal(x, y), 0, `${style}: a strip over the picture at ${Math.round(x)}, ${Math.round(y)}`);
            /* the picture never shows outside BMW's window */
            const w = t.window;
            assert.ok(w.x >= m.x && w.y >= m.y && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w));
            if (way === ways[0]) {
                for (let y = 100; y < 640; y += 2) {
                    for (let x = 380; x < 1540; x += 3) {
                        const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
                        if (reveal(ax, ay) > 0) assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `the picture at ${x}, ${y} is outside BMW's map window`);
                    }
                }
            }
        }
    }
    assert.ok(checked > 40000, 'every readout was looked at: ' + checked);
    /* no pad is larger than its figures need by much: the dark round a figure is the pad's soft edge */
    assert.ok(both[0][2] * 2 < 240 && both[0][3] * 2 < 168 && both[1][2] * 2 < 172 && both[1][3] * 2 < 72);

    /* lowered (BETA), the style is larger than the picture it stands round: the field stays on the picture, the pads on the figures */
    for (const style of M_STYLES) {
        const t = build({ style, centreSize: 'full', lower: 74, mFixture: true, clock12: true });
        const reveal = Track.revealOf(t), f = t.field;
        assert.ok(Math.abs(M.px(f[0]) - m.x) < 1e-6 && Math.abs(M.py(f[1]) - m.y) < 1e-6 && Math.abs(M.px(f[2]) - (m.x + m.w)) < 1e-6, style);
        assert.ok(M.py(f[3]) <= m.y + m.h + 1e-6 && f[3] <= W.bottom);
        for (const pt of inkPoints(t, state(t, BUSY, { centre: CENTRES[1] }))) assert.strictEqual(reveal(pt.art[0], pt.art[1]), 0, `${style} lowered: ${pt.id}`);
        for (let y = 100; y < 720; y += 2) {
            for (let x = 380; x < 1540; x += 3) {
                const [ax, ay] = artOfPanel(x + 0.5, y + 0.5);
                if (reveal(ax, ay) > 0) assert.ok(x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h, `lowered: the picture at ${x}, ${y} is outside BMW's map window`);
            }
        }
        assert.ok(reveal(900, 300) === 1);
        const w = t.window;
        assert.ok(w.x >= m.x && w.y >= m.y && w.x + w.w <= m.x + m.w && w.y + w.h <= m.y + m.h, JSON.stringify(w));
    }
    build({});          /* (the geometry is left as the style comes, for the tests after this one) */
});

/* -------------------------------------------------- numerals at the marker */

test('the numerals grow as the marker passes: on in M Sport Plus, the car\'s size in M Sport, a setting in both', () => {
    const grow = (cfg) => { const t = build(cfg); return layer(t, 'revScale').uniforms(state(t, {})).u_grow; };
    assert.strictEqual(grow({}), 0, 'M Sport: as the car has them');
    assert.strictEqual(grow({ style: 'mplus' }), Track.GROW);
    assert.strictEqual(grow({ mPop: 'on' }), Track.GROW);
    assert.strictEqual(grow({ style: 'mplus', mPop: 'off' }), 0);
    assert.strictEqual(grow({ mPop: 'nonsense' }), 0);
    assert.ok(Track.GROW >= 0.15 && Track.GROW <= 0.3, 'enough to see, not enough to crowd the rim');
    /* the shader's rule: full size a tick away, largest with the marker level, smooth between */
    assert.match(mShaders.mnum, /float near = clamp\(1\.0 - abs\(k - u_cfg\.z\), 0\.0, 1\.0\);/);
    assert.match(mShaders.mnum, /float s = 1\.0 \+ u_grow \* near \* near \* \(3\.0 - 2\.0 \* near\);/);
    assert.match(mShaders.mnum, /vec2 pp = u_grow > 0\.0 \? an \+ \(p - an\) \/ s : p;/, 'with no growth a numeral is drawn exactly as before');
    /* a numeral grows about one point, all of its figures together, from inside itself */
    for (const units of ['imperial', 'metric']) {
        const t = plusBuild({ units });
        for (const id of ['speedScaleA', 'speedScaleB', 'revScale']) {
            const L = layer(t, id), u = L.uniforms(state(t, {}), 0), q = quads(L, u), big = grownQuads(L, u);
            assert.strictEqual(u.u_ax.length, Text.MAX_GLYPHS * 4, 'a vec4 a glyph, as every uniform array is sent');
            const byTick = {};
            big.forEach((g, i) => { (byTick[g.k] = byTick[g.k] || []).push(i); });
            for (const [k, is] of Object.entries(byTick)) {
                assert.strictEqual(new Set(is.map((i) => u.u_ax[i * 4])).size, 1, `${id} tick ${k}: one anchor`);
                const x0 = Math.min(...is.map((i) => q[i].x)), x1 = Math.max(...is.map((i) => q[i].x + q[i].w));
                assert.ok(L.x + u.u_ax[is[0] * 4] > x0 && L.x + u.u_ax[is[0] * 4] < x1, `${id} tick ${k}: anchored inside itself`);
                /* and level with its own tick: the shader's tick for the glyph, and the layout's, agree */
                for (const i of is) assert.ok(Math.abs(L.y + u.u_ax[i * 4 + 1] - M.py(M.tickY(Number(k)))) < 1e-6, `${id} tick ${k}: level`);
                /* it stays level with its tick: as much above as below */
                for (const i of is) {
                    assert.ok(Math.abs((big[i].y + big[i].h / 2) - (q[i].y + q[i].h / 2)) < 0.05);
                    assert.ok(Math.abs(big[i].h / q[i].h - (1 + Track.GROW)) < 1e-9);
                }
                /* grown, it is still clear of its rail: left of the speed dial's rim, right of the rev dial's */
                const ay = M.tickY(Number(k));
                if (id === 'revScale') {
                    assert.ok(Math.min(...is.map((i) => big[i].x)) > M.px(M.mirror(M.rimOuterX(ay))) + 4, `${id} tick ${k} off the rim`);
                } else {
                    assert.ok(Math.max(...is.map((i) => big[i].x + big[i].w)) < M.px(M.rimOuterX(ay)) + 4.5, `${id} tick ${k} off the rim`);
                }
            }
        }
        /* beside the tyre-pressure telltale the numeral grows away from it, not into it */
        const A = layer(t, 'speedScaleA'), uA = A.uniforms(state(t, {}), 0), tyre = Panel.TELLTALES.find((z) => z.id === 'tyre');
        const five = grownQuads(A, uA).filter((g) => g.k === 5);
        assert.ok(five.length === 3 && five.every((g) => !hits(g, tyre)), 'the numeral beside the telltale keeps out of it');
        const plain = quads(A, uA).filter((_, i) => grownQuads(A, uA)[i].k === 5);
        const midOf = (qs) => (Math.min(...qs.map((g) => g.x)) + Math.max(...qs.map((g) => g.x + g.w))) / 2;
        assert.ok(A.x + uA.u_ax[9 * 4] < midOf(plain) - 3, 'its anchor is nearer the telltale than its middle is');
        /* every other numeral grows about its own middle */
        const R = layer(t, 'revScale'), uR = R.uniforms(state(t, {}), 0), qR = quads(R, uR);
        qR.forEach((g, i) => assert.ok(Math.abs(R.x + uR.u_ax[i * 4] - (g.x + g.w / 2)) < 1e-6));
    }
});

/* ---------------------------------------------------------------- the 7 */

test('the 7: its leg hangs from the squared end of its bar, in both cuts', () => {
    const zlib = require('zlib'), fs = require('fs'), path = require('path');
    const px = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'atlas.r8.gz')));
    assert.strictEqual(px.length, atlas.size * atlas.size);
    for (const face of ['mw', 'mn']) {
        const g = atlas.faces[face].glyphs['7'], zero = atlas.faces[face].glyphs['0'];
        assert.deepStrictEqual([g.tw, g.th], [zero.tw, zero.th], face + ': as wide and as tall as its neighbours');
        const H = 0.70 * atlas.emPx, pad = (g.th - H) / 2, W = g.tw - 2 * pad;
        /* ink at a point of the figure's own box (in figure heights), from the distance field */
        const ink = (fx, fy) => px[(g.v + Math.round(pad + fy * H)) * atlas.size + g.u + Math.round(pad + fx * H)] > 127;
        const w = W / H;
        assert.ok(ink(0.06, 0.09) && ink(w / 2, 0.09) && ink(w - 0.06, 0.09), face + ': a bar the full width');
        assert.ok(ink(w - 0.05, 0.215), face + ': the bar\'s right end runs on down, square');
        assert.ok(!ink(w - 0.52, 0.215), face + ': and nothing hangs from the bar further left (the old leg did)');
        assert.ok(!ink(w - 0.03, 0.42), face + ': then the leg leans away from that side');
        assert.ok(ink(0.36, 0.93) && !ink(0.08, 0.93) && !ink(w - 0.35, 0.93), face + ': down to a foot left of the middle');
    }
});

/* ------------------------------------------------------------- the clock */

test('the time of day comes from the cluster\'s own clock, not the head unit\'s', () => {
    const UTC = Date.UTC(2026, 10, 21, 17, 4, 20);              /* the head unit runs on UTC */
    const H = 3600000, MIN = 60000;
    const show = (h, m, s, status) => ({ displayHour: h, displayMinute: m, displaySecond: s, statusDisplayClockTimeDate: status });
    assert.strictEqual(Vehicle.clockOffset(show(12, 4, 20, 1), UTC), 19 * H, 'five hours behind UTC, kept as time ahead');
    assert.strictEqual(Vehicle.clockOffset(show(17, 4, 20, 1), UTC), 0);
    assert.strictEqual(Vehicle.clockOffset(show(22, 34, 20, 3), UTC), 5 * H + 30 * MIN, 'half-hour zones too');
    assert.strictEqual(Vehicle.clockOffset(show(12, 11, 50, 1), UTC), 19 * H + 7 * MIN + 30000,
        'a clock the owner keeps fast stays as fast as the car shows it');
    assert.strictEqual(Vehicle.clockOffset(show(12, 4, 255, 1), UTC), 19 * H - 20000, 'no seconds given: the minute as it stands');
    assert.strictEqual(Vehicle.clockOffset(show(12, 4, 0, 2), UTC), null, 'the cluster shows --:--: so do we');
    assert.strictEqual(Vehicle.clockOffset(show(12, 4, 0, 15), UTC), undefined, 'not filled in: leave what we had');
    assert.strictEqual(Vehicle.clockOffset(show(31, 4, 0, 1), UTC), null, 'an hour that is not one');
    assert.strictEqual(Vehicle.clockOffset(show(12, -1, 0, 1), UTC), null);
    assert.strictEqual(Vehicle.clockOffset(undefined, UTC), undefined);

    /* through the reader: no time until the cluster has told us, the car's time after */
    const r = Vehicle.createReader({});
    const KOMBI = 'de.bmw.infotainment.KombiIF';
    assert.ok(Vehicle.SIGNALS[KOMBI].statusShowTimeDate, 'the reader asks the cluster for its time');
    assert.strictEqual(r.raw(UTC).clock, undefined, 'no time is better than the wrong one');
    r.receive(KOMBI, 'statusShowTimeDate', show(12, 4, 52, 1), UTC);
    assert.deepStrictEqual(r.raw(UTC).clock, { h: 12, m: 4 });
    assert.deepStrictEqual(r.raw(UTC + 7999).clock, { h: 12, m: 4 }, 'the minute turns over with the car\'s own');
    assert.deepStrictEqual(r.raw(UTC + 8000).clock, { h: 12, m: 5 });
    assert.deepStrictEqual(r.raw(UTC + 12 * H).clock, { h: 0, m: 4 }, 'and it runs on past midnight');
    r.receive(KOMBI, 'statusShowTimeDate', show(12, 4, 0, 15), UTC + 1000);
    assert.deepStrictEqual(r.raw(UTC + 1000).clock, { h: 12, m: 4 }, 'an empty message changes nothing');
    r.receive(KOMBI, 'statusShowTimeDate', show(12, 4, 0, 2), UTC + 2000);
    assert.strictEqual(r.raw(UTC + 2000).clock, undefined, 'the cluster\'s clock is unset: ours goes dark');
});

/* ------------------------------------------------------ the gear's place */

test('the gear\'s place: the gear, the revs as a figure, or nothing - a setting of each M style', () => {
    assert.deepStrictEqual(Track.GEAR_KINDS, ['gear', 'rpm', 'off']);
    const rest = (t) => t.layers.filter((L) => L.id !== 'gear').map((L) => L.id);
    for (const style of M_STYLES) {
        const g = build({ style }), r = build({ style, mGear: 'rpm' }), o = build({ style, mGear: 'off' });
        assert.strictEqual(g.settings.mGear, 'gear', 'the M View\'s own unless asked');
        assert.strictEqual(build({ style, mGear: 'sixth' }).settings.mGear, 'gear', 'anything else is the gear');
        assert.strictEqual(says(g, 'gear', state(g, { rpm: 5544, gear: 'D4' })), 'D4');
        /* the revs: to the nearest ten, nothing until the car has sent them */
        assert.strictEqual(says(r, 'gear', state(r, { rpm: 5544, gear: 'D4' })), '5540');
        assert.strictEqual(says(r, 'gear', state(r, { rpm: 738 })), '740');
        assert.strictEqual(says(r, 'gear', state(r, { rpm: 0 })), '0', 'ignition on, engine off');
        assert.strictEqual(layer(r, 'gear').uniforms(state(r, {}), 0), null, 'no reading, no figure');
        /* nothing: BMW's own gear letter, which cannot be covered, is the only one */
        assert.ok(!layer(o, 'gear'), 'no layer at all');
        assert.deepStrictEqual(rest(r), rest(g), 'nothing else changes');
        assert.deepStrictEqual(rest(o), rest(g));
    }
    /* each style keeps its own, as the app's tabs save them */
    const own = (cfg) => Themes.build(atlas, 'x3m40i', cfg).settings.mGear;
    assert.strictEqual(own({ style: 'track', mGear: 'rpm', pGear: 'off' }), 'rpm');
    assert.strictEqual(own({ style: 'mplus', mGear: 'rpm', pGear: 'off' }), 'off');
    assert.strictEqual(Themes.keyFor('track', 'mGear'), 'mGear');
    assert.strictEqual(Themes.keyFor('mplus', 'mGear'), 'pGear');
});

test('the revs in the gear\'s place stand on the black bar: inside their layer, on no plate, never where a picture shows', () => {
    for (const style of M_STYLES) {
        const t = build({ style, mGear: 'rpm' }), L = layer(t, 'gear');
        const plates = style === 'mplus' ? PLUS.PLATES : M.PLATES;
        const reveal = style === 'mplus' ? Track.plusRevealAt : Track.revealAt;
        for (const rpm of [0, 740, 1000, 1110, 4440, 5540, 6660, 7770, 7990, 8880]) {
            const u = L.uniforms(state(t, { rpm }, { centre: CENTRES[1] }), 0);
            assert.ok(u, style + ' at ' + rpm);
            for (const q of quads(L, u)) {
                assert.ok(q.x >= L.x - 0.5 && q.y >= L.y - 0.5 && q.x + q.w <= L.x + L.w + 0.5 && q.y + q.h <= L.y + L.h + 0.5,
                    `${style} at ${rpm}: a glyph outside its layer`);
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h], [q.x + q.w / 2, q.y + q.h / 2]]) {
                    const [ax, ay] = artOfPanel(x, y);
                    assert.strictEqual(reveal(ax, ay), 0, `${style} at ${rpm}: over the picture at ${Math.round(x)}, ${Math.round(y)}`);
                }
            }
            /* the figures' own ink (the glyph boxes less the field's margin) is on the bar, clear of every plate */
            /* (a glyph's box stands the field's spread out from its ink: half of u_sharp, src/engine/text.js) */
            const boxes = quads(L, u), pad = u.u_sharp / 2;
            const x0 = Math.min(...boxes.map((q) => q.x)) + pad, x1 = Math.max(...boxes.map((q) => q.x + q.w)) - pad;
            const y0 = Math.min(...boxes.map((q) => q.y)) + pad, y1 = Math.max(...boxes.map((q) => q.y + q.h)) - pad;
            for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
                const [ax, ay] = artOfPanel(x, y);
                for (const id of Object.keys(plates)) {
                    assert.ok(M.roundDist(plates[id].v, plates[id].r, ax, ay) > 0, `${style} at ${rpm}: ink on plate ${id} at ${Math.round(ax)}, ${Math.round(ay)}`);
                }
            }
        }
    }
});
